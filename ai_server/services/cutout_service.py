"""
cutout_service.py
-----------------
옷장 아이템 사진 -> (YOLO로 의류 검출 + SAM으로 누끼) -> 흰 배경 코디 합성 이미지.

사용 위치
  - 사용자가 추천받은 코디 중 하나를 "선택"했을 때만 호출.
  - 옷장 화면에는 계속 원본 사진을 쓰고, 누끼 이미지는 합성 결과물을 만들 때만 사용.
    (이 모듈은 원본을 수정/저장하지 않음. 입력 이미지를 읽어 합성 결과만 리턴.)

처리 규칙
  1. 아이템의 카테고리(상의/하의/아우터/원피스)에 해당하는 의류 클래스 검출만 사용.
       상의     -> top_short_sleeve, top_long_sleeve
       하의     -> pants, skirt
       아우터   -> outer
       원피스   -> onepiece
     한 사진에 상의/하의가 같이 있어도, 옷장에 "상의"로 저장된 아이템이면 상의만 추출.
  2. hand / arm_upper / arm_lower / leg_thigh / leg_calf 는 의류가 아니라
     "마스크에서 제외할 영역"으로만 사용. (의류 마스크에서 이 영역을 제외.)
  3. 해당 카테고리 의류를 못 찾으면 아래 순서로 대체 시도 후, 모두 실패하면 원본 그대로 배치.
     (YOLO가 옷 이름을 틀려도 옷장 카테고리는 사용자가 정했으므로, 옷의 "위치"만 맞으면 누끼 가능)
       a. 비슷한 카테고리 클래스 사용 (상의<->아우터/원피스, 하의->원피스, 원피스->아우터)   method="yolo_sam_related"
       b. 사람(손/팔/다리)이 없고 검출된 옷이 모두 한 벌을 가리킬 때, 가장 확실한 옷 검출 사용   method="yolo_sam_any"
       c. 사람도 옷도 검출되지 않으면(옷만 찍은 상품 사진 가정) 사진 거의 전체 박스로 SAM 실행   method="sam_full_box"
       d. 위가 모두 안 되면 원본 사용                                                      method="original"
  4. SAM에 준 박스가 사진의 대부분(60% 이상)을 덮는데, 마스크가 그 박스 테두리 세 변 이상에 넓게 닿으면
     옷이 아니라 배경(벽/문 등)을 잡은 것으로 판단. SAM의 다른 후보 마스크 중 배경이 아닌 것을 쓰고, 없으면 원본 사용.
     (YOLO가 사진 전체에 가까운 박스를 낸 밝은 옷 + 밝은 배경 사진에서 누끼가 반대로 따지는 문제 대응.
      몸에 맞는 작은 박스는 정상 마스크도 박스 네 변에 닿을 수 있어 검사하지 않음)

모델 교체
  - YOLO 가중치 경로/임계값은 환경변수로만 지정. (코드 수정 없이 best.pt 교체 가능)
      YOLO_WEIGHTS_PATH, YOLO_CONF, YOLO_IMGSZ, YOLO_DEVICE
  - 클래스는 번호가 아니라 model.names 의 "이름"으로 매칭.
    (Roboflow가 클래스 순서를 알파벳순으로 바꾸거나 새 데이터셋에서 순서가 달라져도 안전)
  - 새 모델의 클래스 이름이 위 이름과 다르면 아래 CLOTHING_CLASSES_BY_SLOT / BODY_CLASSES 만 수정하면 됨.

테스트 용이성
  - ultralytics / segment_anything 는 실제 추론이 필요할 때만 import 하면 됨.
  - detector / segmenter 를 주입할 수 있어 모델 없이도 나머지 로직을 테스트 가능.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import threading
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageOps

logger = logging.getLogger("cutout")

# ─────────────────────────────────────────────
# 설정 (환경변수)
# ─────────────────────────────────────────────
YOLO_WEIGHTS_PATH = os.environ.get(
    "YOLO_WEIGHTS_PATH",
    os.path.join(os.path.dirname(__file__), "../models/clothes_yolo.pt"),
)
YOLO_CONF = float(os.environ.get("YOLO_CONF", "0.25"))
# 비워두면 가중치에 저장된 학습 imgsz 사용. 최종 모델을 다른 imgsz로 학습했다면 여기만 변경하면 됨.
YOLO_IMGSZ = int(os.environ["YOLO_IMGSZ"]) if os.environ.get("YOLO_IMGSZ") else None
# 학습 중 MPS에서 NMS 시간 초과 경고가 반복됐기 때문에 YOLO 추론은 기본 CPU로 설정.
# (YOLOv8n은 작아서 CPU로도 충분히 빠르다고 알려져 있지만, 이 프로젝트에서 실측한 값은 아니긴 함.)
YOLO_DEVICE = os.environ.get("YOLO_DEVICE", "cpu")

# ─────────────────────────────────────────────
# 클래스 / 카테고리 규칙
# ─────────────────────────────────────────────
CLOTHING_CLASSES_BY_SLOT: Dict[str, Tuple[str, ...]] = {
    "top": ("top_short_sleeve", "top_long_sleeve"),
    "bottom": ("pants", "skirt"),
    "outer": ("outer",),
    "onepiece": ("onepiece",),
}
BODY_CLASSES: Tuple[str, ...] = ("hand", "arm_upper", "arm_lower", "leg_thigh", "leg_calf")
ALL_CLOTHING_CLASSES: Tuple[str, ...] = tuple(c for names in CLOTHING_CLASSES_BY_SLOT.values() for c in names)

# 지정 카테고리 클래스가 없을 때 대신 써볼 슬롯 (앞에 있을수록 우선).
# 새 모델 confusion matrix에서 outer<->top_long_sleeve, pants->onepiece 혼동이 많아 이렇게 묶음.
# 주의: 사람이 아우터를 입고 찍은 "상의" 사진에서 상의가 검출되지 않으면 아우터를 대신 딸 수 있음.
RELATED_SLOTS: Dict[str, Tuple[str, ...]] = {
    "top": ("outer", "onepiece"),
    "outer": ("top", "onepiece"),
    "bottom": ("onepiece",),
    "onepiece": ("outer",),
}

# 옷장 category(한글/영문/자유 입력) -> 슬롯. frontend normalizeCategory 의 키워드와 같은 기준.
# 위에서부터 먼저 맞는 슬롯 사용. ("니트 원피스"가 상의로 잡히지 않도록 원피스를 앞에 둠)
_CATEGORY_KEYWORDS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("onepiece", ("원피스", "드레스", "dress", "onepiece")),
    ("outer", ("아우터", "자켓", "재킷", "코트", "패딩", "점퍼", "가디건", "outer", "jacket", "coat")),
    ("bottom", ("하의", "팬츠", "바지", "스커트", "치마", "반바지", "bottom", "pants", "skirt")),
    ("top", ("상의", "탑", "티셔츠", "셔츠", "니트", "블라우스", "후드", "맨투맨", "top", "shirt")),
)

# ─────────────────────────────────────────────
# 후처리 / 합성 파라미터
# ─────────────────────────────────────────────
MAX_INPUT_SIDE = 1600            # 이보다 큰 입력은 줄여서 처리 (SAM은 어차피 1024로 리사이즈)
MIN_MASK_AREA_RATIO = 0.05       # 마스크가 검출 박스 면적의 5% 미만이면 실패로 보고 원본 사용
MAX_BODY_SUBTRACT_RATIO = 0.35   # 신체 마스크가 의류 마스크의 35% 넘게 깎으면 SAM이 옷까지 잡은 것으로 보고 무시
MIN_ISLAND_RATIO = 0.02          # 가장 큰 덩어리의 2% 미만 조각은 노이즈로 제거
CROP_PAD_RATIO = 0.02
SAME_GARMENT_OVERLAP = 0.6       # 두 옷 박스의 겹친 면적이 작은 박스의 60% 이상이면 같은 옷 한 벌로 판단
FULL_BOX_INSET_RATIO = 0.02      # 사진 전체 박스 대체 시 가장자리에서 2%씩 안쪽으로
FULL_BOX_MIN_AREA_RATIO = 0.05   # 사진 전체 박스 대체 결과 마스크가 사진의 5% 미만이면 실패
FULL_BOX_MAX_AREA_RATIO = 0.90   # 90% 초과면 배경까지 잡은 것으로 보고 실패
LARGE_BOX_AREA_RATIO = 0.6      # 박스가 사진의 60% 이상이면 배경을 잡았을 위험이 있는 "큰 박스"로 보고 검사
EDGE_BAND_RATIO = 0.02           # 박스 테두리 검사 두께 (박스 짧은 변의 2%, 최소 2px, 테두리에서 안쪽으로)
EDGE_COVER_RATIO = 0.5           # 한 변의 테두리를 50% 넘게 덮으면 "그 변에 닿음"
BACKGROUND_MIN_SIDES = 3         # 세 변 이상에 닿으면 배경 마스크로 판단
CANVAS_SIZE = (1080, 1350)       # 4:5
CANVAS_BG = (255, 255, 255)
MAX_UPSCALE = 2.0                # 작은 누끼를 칸에 맞추려고 너무 키우면 흐려지므로 제한
CELL_PADDING_PX = 24             # 칸 안쪽 여백 (위아래로 붙은 상의/하의가 서로 닿지 않게)
JPEG_QUALITY = 92


# ─────────────────────────────────────────────
# 데이터 구조
# ─────────────────────────────────────────────
@dataclass(frozen=True)
class Detection:
    cls_name: str
    conf: float
    box: Tuple[float, float, float, float]  # x1, y1, x2, y2 (원본 이미지 픽셀)


@dataclass
class ItemCutout:
    image: Image.Image            # RGBA
    method: str                   # "yolo_sam" | "yolo_sam_related" | "yolo_sam_any" | "sam_full_box" | "original"
    detected_class: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None


# ─────────────────────────────────────────────
# 순수 함수 (모델 없이 테스트 가능)
# ─────────────────────────────────────────────
def normalize_category(category: Optional[str]) -> Optional[str]:
    """옷장 category 문자열을 슬롯(top/bottom/outer/onepiece)으로 변경. 알 수 없으면 None."""
    if not category:
        return None
    c = category.strip().lower()
    for slot, keywords in _CATEGORY_KEYWORDS:
        if any(k.lower() in c for k in keywords):
            return slot
    return None


def select_target_detection(detections: Iterable[Detection], slot: str) -> Optional[Detection]:
    """해당 슬롯의 의류 클래스 중 confidence가 가장 높은 검출 하나를 선택."""
    names = CLOTHING_CLASSES_BY_SLOT.get(slot, ())
    candidates = [d for d in detections if d.cls_name in names]
    if not candidates:
        return None
    return max(candidates, key=lambda d: d.conf)


def select_related_detection(detections: Iterable[Detection], slot: str) -> Optional[Detection]:
    """지정 슬롯 클래스가 없을 때, RELATED_SLOTS 순서대로 비슷한 슬롯의 검출을 찾음. (각 슬롯 안에서는 confidence 최고)"""
    detections = list(detections)
    for related in RELATED_SLOTS.get(slot, ()):
        found = select_target_detection(detections, related)
        if found is not None:
            return found
    return None


def _box_area(b: Sequence[float]) -> float:
    return max(b[2] - b[0], 0.0) * max(b[3] - b[1], 0.0)


def _overlap_of_smaller(a: Sequence[float], b: Sequence[float]) -> float:
    """겹친 면적 / 두 박스 중 작은 박스 면적. (0~1)"""
    iw = min(a[2], b[2]) - max(a[0], b[0])
    ih = min(a[3], b[3]) - max(a[1], b[1])
    if iw <= 0 or ih <= 0:
        return 0.0
    smaller = min(_box_area(a), _box_area(b))
    return (iw * ih) / smaller if smaller > 0 else 0.0


def select_single_garment_detection(detections: Iterable[Detection]) -> Optional[Detection]:
    """사람(신체 클래스)이 없고, 검출된 옷 박스가 모두 같은 옷 한 벌을 가리킬 때만 가장 확실한 옷 검출을 반환.
    (옷만 찍은 사진에서 클래스 이름만 틀린 경우용. 여러 벌이 따로 검출되면 어느 옷인지 알 수 없으므로 None)"""
    detections = list(detections)
    if any(d.cls_name in BODY_CLASSES for d in detections):
        return None
    clothes = [d for d in detections if d.cls_name in ALL_CLOTHING_CLASSES]
    if not clothes:
        return None
    best = max(clothes, key=lambda d: d.conf)
    if all(_overlap_of_smaller(best.box, d.box) >= SAME_GARMENT_OVERLAP for d in clothes):
        return best
    return None


def looks_like_background(mask: np.ndarray, box: Optional[Sequence[float]] = None) -> bool:
    """SAM에 준 박스(없으면 사진 전체)가 사진의 LARGE_BOX_AREA_RATIO 이상일 때,
    마스크가 그 박스 테두리 BACKGROUND_MIN_SIDES 변 이상을 EDGE_COVER_RATIO 넘게 덮으면 True.
    SAM 마스크는 박스 안에만 생기므로 사진 테두리가 아니라 박스 테두리를 기준으로 검사.
    (실패 사례 측정값: 박스 테두리 기준 위 0.92~0.99 / 아래 0.71~0.74 / 왼쪽 0.42~0.64 / 오른쪽 0.67~0.86)"""
    h, w = mask.shape
    if box is None:
        box = (0, 0, w, h)
    x1 = int(max(0, min(w, round(box[0]))))
    y1 = int(max(0, min(h, round(box[1]))))
    x2 = int(max(0, min(w, round(box[2]))))
    y2 = int(max(0, min(h, round(box[3]))))
    bw, bh = x2 - x1, y2 - y1
    if bw <= 0 or bh <= 0 or (bw * bh) < LARGE_BOX_AREA_RATIO * w * h:
        return False
    band = max(2, int(round(min(bw, bh) * EDGE_BAND_RATIO)))
    region = mask[y1:y2, x1:x2]
    sides = (region[:band, :], region[-band:, :], region[:, :band], region[:, -band:])
    touched = sum(1 for s in sides if s.size and float(s.mean()) > EDGE_COVER_RATIO)
    return touched >= BACKGROUND_MIN_SIDES


def full_image_box(size: Tuple[int, int], inset: float = FULL_BOX_INSET_RATIO) -> Tuple[float, float, float, float]:
    """사진 가장자리를 inset 비율만큼 뺀 박스 (x1, y1, x2, y2)."""
    w, h = size
    return (w * inset, h * inset, w * (1 - inset), h * (1 - inset))


def _boxes_intersect(a: Sequence[float], b: Sequence[float]) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def subtract_body_masks(
    item_mask: np.ndarray,
    body_masks: Sequence[np.ndarray],
    max_ratio: float = MAX_BODY_SUBTRACT_RATIO,
) -> np.ndarray:
    """의류 마스크에서 신체(손/팔/다리) 마스크 제외.
    한 신체 마스크가 의류 마스크를 max_ratio 넘게 지우면(= SAM이 옷까지 신체로 잡은 경우) 그 마스크는 무시하도록 설정."""
    result = item_mask.copy()
    base_area = int(item_mask.sum())
    if base_area == 0:
        return result
    for body in body_masks:
        removed = int((result & body).sum())
        if removed / base_area > max_ratio:
            logger.warning("신체 마스크가 의류 마스크의 %.0f%%를 지워서 무시합니다.", 100 * removed / base_area)
            continue
        result &= ~body
    return result


def drop_small_islands(mask: np.ndarray, min_ratio: float = MIN_ISLAND_RATIO) -> np.ndarray:
    """가장 큰 덩어리 대비 너무 작은 조각을 삭제. (구멍 메우기는 하지 않음:
    ㄱ자 자세에서 팔과 몸통 사이의 빈 공간까지 메워질 수 있기 때문)"""
    try:
        from scipy import ndimage
    except ImportError:  # scipy 없이도 동작은 하도록
        return mask
    labeled, n = ndimage.label(mask)
    if n <= 1:
        return mask
    areas = ndimage.sum(mask, labeled, index=range(1, n + 1))
    largest = float(max(areas))
    keep = [i + 1 for i, a in enumerate(areas) if a >= largest * min_ratio]
    return np.isin(labeled, keep)


def mask_to_rgba(image_np: np.ndarray, mask: np.ndarray, pad_ratio: float = CROP_PAD_RATIO) -> Image.Image:
    """마스크 바깥을 투명하게 만들고 마스크 영역 크기로 잘라낸 RGBA 이미지를 반환."""
    ys, xs = np.where(mask)
    if len(ys) == 0:
        raise ValueError("빈 마스크입니다.")
    h, w = mask.shape
    pad_y = int(round((ys.max() - ys.min() + 1) * pad_ratio))
    pad_x = int(round((xs.max() - xs.min() + 1) * pad_ratio))
    y0, y1 = max(ys.min() - pad_y, 0), min(ys.max() + 1 + pad_y, h)
    x0, x1 = max(xs.min() - pad_x, 0), min(xs.max() + 1 + pad_x, w)

    alpha = Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1))
    rgba = Image.fromarray(np.ascontiguousarray(image_np)).convert("RGBA")
    rgba.putalpha(alpha)
    return rgba.crop((x0, y0, x1, y1))


def compute_layout(
    slots: Iterable[str],
    size: Tuple[int, int] = CANVAS_SIZE,
    margin: float = 0.05,
    gap: float = 0.02,
) -> Dict[str, Tuple[float, float, float, float]]:
    """슬롯별 배치 칸(x0, y0, x1, y1)을 계산. (합성 레이아웃을 바꾸고 싶으면 이 함수만 수정하면 됨)

    - 아우터가 있고 다른 의류도 있으면: 왼쪽 열에 아우터, 오른쪽 열에 원피스 / 상의 / 하의 를 위에서 아래로.
    - 아우터가 없으면: 가운데 한 열에 위에서 아래로.
    - 아우터만 있으면: 가운데에 크게.
    """
    w, h = size
    present = set(slots)
    right_order = [s for s in ("onepiece", "top", "bottom") if s in present]
    cells: Dict[str, Tuple[float, float, float, float]] = {}

    def stack(x0: float, x1: float, order: List[str]) -> None:
        top, bottom = margin * h, h - margin * h
        cell_h = (bottom - top) / len(order)
        for i, s in enumerate(order):
            cells[s] = (x0, top + i * cell_h, x1, top + (i + 1) * cell_h)

    if "outer" in present and right_order:
        mid = w / 2
        stack(margin * w, mid - gap * w / 2, ["outer"])
        stack(mid + gap * w / 2, w - margin * w, right_order)
    elif "outer" in present:
        stack(0.15 * w, 0.85 * w, ["outer"])
    elif right_order:
        stack(0.15 * w, 0.85 * w, right_order)
    return cells


def _fit_into_cell(img: Image.Image, cell: Tuple[float, float, float, float]) -> Tuple[Image.Image, Tuple[int, int]]:
    x0, y0, x1, y1 = cell
    x0, y0, x1, y1 = x0 + CELL_PADDING_PX, y0 + CELL_PADDING_PX, x1 - CELL_PADDING_PX, y1 - CELL_PADDING_PX
    cw, ch = x1 - x0, y1 - y0
    iw, ih = img.size
    scale = min(cw / iw, ch / ih, MAX_UPSCALE)
    new_size = (max(1, int(round(iw * scale))), max(1, int(round(ih * scale))))
    resized = img.resize(new_size, Image.LANCZOS)
    px = int(round(x0 + (cw - new_size[0]) / 2))
    py = int(round(y0 + (ch - new_size[1]) / 2))
    return resized, (px, py)


def compose_outfit(
    cutouts: Dict[str, Image.Image],
    size: Tuple[int, int] = CANVAS_SIZE,
    bg: Tuple[int, int, int] = CANVAS_BG,
) -> Image.Image:
    """슬롯별 RGBA 이미지를 흰 배경 캔버스에 배치해 RGB 이미지 생성."""
    canvas = Image.new("RGB", size, bg)
    cells = compute_layout(cutouts.keys(), size)
    # 아우터를 먼저 그려 다른 아이템이 위에 오도록 (칸이 겹치지는 않지만 순서를 고정)
    for slot in ("outer", "onepiece", "top", "bottom"):
        if slot not in cutouts or slot not in cells:
            continue
        resized, pos = _fit_into_cell(cutouts[slot], cells[slot])
        canvas.paste(resized, pos, resized)
    return canvas


def decode_image(image_b64: str) -> Image.Image:
    """base64(data URL 허용) -> RGB PIL 이미지. EXIF 회전 반영, 너무 큰 이미지는 축소."""
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    img = Image.open(io.BytesIO(base64.b64decode(image_b64)))
    img = ImageOps.exif_transpose(img).convert("RGB")
    longest = max(img.size)
    if longest > MAX_INPUT_SIDE:
        ratio = MAX_INPUT_SIDE / longest
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    return img


def _original_as_rgba(image: Image.Image, note: str) -> ItemCutout:
    return ItemCutout(image=image.convert("RGBA"), method="original", note=note)


# ─────────────────────────────────────────────
# 모델 래퍼 (실제 추론 시에만 import)
# ─────────────────────────────────────────────
class YoloDetector:
    def __init__(
        self,
        weights_path: str = YOLO_WEIGHTS_PATH,
        conf: float = YOLO_CONF,
        imgsz: Optional[int] = YOLO_IMGSZ,
        device: str = YOLO_DEVICE,
    ):
        weights_path = os.path.abspath(weights_path)
        if not os.path.isfile(weights_path):
            raise FileNotFoundError(
                f"YOLO 가중치 파일이 없습니다: {weights_path} (환경변수 YOLO_WEIGHTS_PATH 확인)"
            )
        from ultralytics import YOLO

        logger.info("[YOLO] 로딩: %s (device=%s)", weights_path, device)
        self.model = YOLO(weights_path)
        self.names = self.model.names  # {id: name}
        self.conf, self.imgsz, self.device = conf, imgsz, device

    def detect(self, image: Image.Image) -> List[Detection]:
        kwargs = dict(conf=self.conf, device=self.device, verbose=False)
        if self.imgsz:
            kwargs["imgsz"] = self.imgsz
        # PIL(RGB)로 넘깁니다. numpy 배열은 Ultralytics가 BGR로 해석하므로 RGB 배열을 그대로 넣으면 채널이 뒤바뀜.
        result = self.model.predict(image, **kwargs)[0]
        boxes = result.boxes
        out: List[Detection] = []
        for xyxy, conf, cls in zip(
            boxes.xyxy.cpu().numpy(), boxes.conf.cpu().numpy(), boxes.cls.cpu().numpy()
        ):
            out.append(Detection(self.names[int(cls)], float(conf), tuple(float(v) for v in xyxy)))
        return out


class SamBoxSegmenter:
    """기존 sam_service 의 predictor를 재사용하고 박스 프롬프트로 마스크 생성.
    with 문으로 쓰면 predictor_lock 을 잡아 /ai/remove-background 와 동시에 predictor를 건드리지 않도록 설정."""

    def __init__(self):
        from services import sam_service

        self._sam_service = sam_service
        self._predictor = None

    def __enter__(self):
        self._sam_service.predictor_lock.acquire()
        self._predictor = self._sam_service.get_predictor()
        return self

    def __exit__(self, exc_type, exc, tb):
        self._sam_service.predictor_lock.release()
        return False

    def set_image(self, image_np: np.ndarray) -> None:
        self._predictor.set_image(image_np)

    def mask_for_box(self, box: Sequence[float]) -> np.ndarray:
        # 박스만 프롬프트로 사용. (박스 중심점을 같이 주면 ㄱ자/열린 아우터처럼 중심이 배경인 경우 마스크가 틀어질 수 있음)
        masks, _, _ = self._predictor.predict(
            box=np.array(box, dtype=np.float32)[None, :], multimask_output=False
        )
        return masks[0].astype(bool)

    def masks_for_box(self, box: Sequence[float]) -> List[np.ndarray]:
        """같은 박스로 SAM 후보 마스크 3개를 받아 점수 높은 순으로 반환. (첫 마스크가 배경일 때 대안으로 사용)"""
        masks, scores, _ = self._predictor.predict(
            box=np.array(box, dtype=np.float32)[None, :], multimask_output=True
        )
        order = np.argsort(-np.asarray(scores))
        return [masks[i].astype(bool) for i in order]


_default_detector: Optional[YoloDetector] = None
_detector_lock = threading.Lock()


def get_default_detector() -> YoloDetector:
    global _default_detector
    with _detector_lock:
        if _default_detector is None:
            _default_detector = YoloDetector()
        return _default_detector


# ─────────────────────────────────────────────
# 아이템 하나 누끼 / 코디 합성
# ─────────────────────────────────────────────
def cut_out_item(image: Image.Image, slot: str, detector, segmenter) -> ItemCutout:
    """image(RGB)에서 slot에 해당하는 의류만 누끼를 땀. 실패하면 원본을 그대로 return.
    segmenter는 이미 with 블록 안(= predictor 락을 잡은 상태)이어야 함.
    지정 클래스를 못 찾으면 모듈 설명의 3-a ~ 3-d 순서로 대체 시도."""
    detections = detector.detect(image)
    found = ", ".join(sorted({d.cls_name for d in detections})) or "없음"

    method, note = "yolo_sam", None
    target = select_target_detection(detections, slot)
    if target is None:
        target = select_related_detection(detections, slot)
        method = "yolo_sam_related"
        if target is None:
            target = select_single_garment_detection(detections)
            method = "yolo_sam_any"
        if target is not None:
            note = f"{slot} 클래스 없음 -> {target.cls_name} 검출로 대체 (검출된 클래스: {found})"
        elif not detections:
            return _cut_out_with_full_box(image, segmenter)
        else:
            return _original_as_rgba(image, f"{slot} 의류 검출 없음 (검출된 클래스: {found})")

    image_np = np.asarray(image)
    segmenter.set_image(image_np)
    item_mask = segmenter.mask_for_box(target.box)
    if looks_like_background(item_mask, target.box):
        item_mask = _pick_non_background_mask(segmenter, target.box)
        if item_mask is None:
            return _original_as_rgba(
                image, f"SAM이 옷이 아니라 배경을 잡은 것으로 보여 원본 사용 (박스 {target.cls_name} {target.conf:.2f})"
            )
        note = (note + " / " if note else "") + "첫 마스크가 배경이라 SAM의 다른 후보 마스크 사용"

    body_masks = [
        segmenter.mask_for_box(d.box)
        for d in detections
        if d.cls_name in BODY_CLASSES and _boxes_intersect(d.box, target.box)
    ]
    mask = drop_small_islands(subtract_body_masks(item_mask, body_masks))

    x1, y1, x2, y2 = target.box
    box_area = max((x2 - x1) * (y2 - y1), 1.0)
    if mask.sum() < MIN_MASK_AREA_RATIO * box_area:
        return _original_as_rgba(image, "마스크가 너무 작아 원본 사용")

    return ItemCutout(
        image=mask_to_rgba(image_np, mask),
        method=method,
        detected_class=target.cls_name,
        confidence=target.conf,
        note=note,
    )


def _pick_non_background_mask(segmenter, box: Sequence[float]) -> Optional[np.ndarray]:
    """SAM 후보 마스크(multimask) 중 배경이 아니고 너무 작지 않은 것을 점수 순으로 하나 고름. 없으면 None.
    segmenter에 masks_for_box 가 없으면(테스트용 가짜 등) 후보 없이 None."""
    if not hasattr(segmenter, "masks_for_box"):
        return None
    box_area = max(_box_area(box), 1.0)
    for candidate in segmenter.masks_for_box(box):
        if looks_like_background(candidate, box):
            continue
        if candidate.sum() < MIN_MASK_AREA_RATIO * box_area:
            continue
        return candidate
    return None


def _cut_out_with_full_box(image: Image.Image, segmenter) -> ItemCutout:
    """YOLO가 사람도 옷도 찾지 못했을 때: 옷만 찍은 상품 사진이라고 보고 사진 거의 전체 박스로 SAM 실행.
    마스크가 너무 작거나(실패) 너무 크면(배경까지 잡음) 원본 사용."""
    image_np = np.asarray(image)
    segmenter.set_image(image_np)
    box = full_image_box(image.size)
    mask = segmenter.mask_for_box(box)
    if looks_like_background(mask, box):
        mask = _pick_non_background_mask(segmenter, box)
        if mask is None:
            return _original_as_rgba(image, "검출 없음 -> 사진 전체 박스 시도, SAM이 배경을 잡아 원본 사용")
    mask = drop_small_islands(mask)
    ratio = float(mask.sum()) / float(image.size[0] * image.size[1])
    if ratio < FULL_BOX_MIN_AREA_RATIO:
        return _original_as_rgba(image, f"검출 없음 -> 사진 전체 박스 시도, 마스크 {ratio:.0%}로 너무 작아 원본 사용")
    if ratio > FULL_BOX_MAX_AREA_RATIO:
        return _original_as_rgba(image, f"검출 없음 -> 사진 전체 박스 시도, 마스크 {ratio:.0%}로 배경까지 잡혀 원본 사용")
    return ItemCutout(
        image=mask_to_rgba(image_np, mask),
        method="sam_full_box",
        note=f"검출 없음 -> 사진 전체 박스로 누끼 (마스크 {ratio:.0%})",
    )


def build_outfit_composite(
    items: Sequence[dict],
    detector=None,
    segmenter=None,
) -> Tuple[bytes, List[dict]]:
    """items: [{"category": "상의", "imageB64": "..."}, ...]
    Returns (JPEG bytes, 아이템별 처리 결과 목록).

    카테고리를 알 수 없거나(예: 기타) 같은 슬롯이 중복된 아이템은 합성에서 제외하고 결과 목록에 사유를 남기도록 설정.
    모델 로딩/추론 자체가 실패하면 예외를 그대로 업로드. (조용히 원본만 합성되는 일을 막기 위해)
    """
    detector = detector or get_default_detector()
    segmenter = segmenter or SamBoxSegmenter()

    cutouts: Dict[str, Image.Image] = {}
    infos: List[dict] = []

    with segmenter:
        for item in items:
            category = item.get("category")
            slot = normalize_category(category)
            if slot is None:
                infos.append({"category": category, "slot": None, "method": "skipped", "note": "알 수 없는 카테고리"})
                continue
            if slot in cutouts:
                infos.append({"category": category, "slot": slot, "method": "skipped", "note": "같은 슬롯 중복"})
                continue

            result = cut_out_item(decode_image(item["imageB64"]), slot, detector, segmenter)
            cutouts[slot] = result.image
            infos.append(
                {
                    "category": category,
                    "slot": slot,
                    "method": result.method,
                    "detectedClass": result.detected_class,
                    "confidence": result.confidence,
                    "note": result.note,
                }
            )

    if not cutouts:
        raise ValueError("합성할 수 있는 아이템이 없습니다.")

    buf = io.BytesIO()
    compose_outfit(cutouts).save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue(), infos