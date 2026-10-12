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
  3. 해당 카테고리 의류를 못 찾으면 그 아이템은 누끼 없이 원본 그대로 배치.
     (엉뚱한 마스크가 생기는 것보다 낫다고 판단. method="original" 로 표시됨)

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
    method: str                   # "yolo_sam" | "original"
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
    segmenter는 이미 with 블록 안(= predictor 락을 잡은 상태)이어야 함."""
    detections = detector.detect(image)
    target = select_target_detection(detections, slot)
    if target is None:
        found = sorted({d.cls_name for d in detections}) or ["없음"]
        return _original_as_rgba(image, f"{slot} 의류 검출 없음 (검출된 클래스: {', '.join(found)})")

    image_np = np.asarray(image)
    segmenter.set_image(image_np)
    item_mask = segmenter.mask_for_box(target.box)

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
        method="yolo_sam",
        detected_class=target.cls_name,
        confidence=target.conf,
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
