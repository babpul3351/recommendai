"""
color_moodboard_service.py  (v2, 2026-11-09)
--------------------------------------------
색상 보정 뷰어의 무드보드 + 옷장 색 매칭.

v1 대비 변경
  1. 옷장 아이템 색: YOLO + SAM 누끼로 "그 옷만" 잘라 색을 계산 (item_colors). 실패 시 v1의 박스 방식으로 대체.
     저장 형식에 "v2|" 접두사를 붙여, v1 방식으로 계산된 값은 다시 계산되도록 함.
  2. 매칭: 사용자가 고른 기준 색 1개와 아이템의 주 색(가장 큰 색, 35% 이상이면 두 번째 색까지)만 비교.
     상의/하의/아우터/원피스가 아닌 항목(저장한 코디 등)은 제외.
     채도가 있는 색끼리는 색상각(hue) 차이 30도 이하일 때만 같은 계열로 인정, 무채색과 유채색은 매칭하지 않음.
     기준: ΔE00 6 이하 "거의 같은 색", 12 이하 "비슷한 색" (v1의 8/15에서 낮춤, 검증 전 설계값)
  3. 색을 글로 설명 (describe_color): 색 계열, 밝기, 채도, 온도감. Gemini 없이 계산으로 만들어 항상 표시.
  3-1. (2026-11-09 추가) 같은 색이 없을 때를 위해 "같은 색 계열"(describe_color의 family가 같은) 옷도 따로 반환 (sameFamily).
  4. 색각 유형별 "비슷해 보이지만 실제로는 다른 색" 경고:
     daltonization_service와 같은 시뮬레이션 행렬로 계산. 실제 ΔE >= 15 이고 시뮬레이션 ΔE <= 8 이면 경고.
     (행렬 자체의 정확도는 이 프로젝트에서 검증하지 않음. 뷰어와 같은 공식이라는 일관성만 보장)
  5. 보정 색 (correctedHex): 뷰어의 보정 공식을 픽셀 하나에 적용한 값. 뷰어 오른쪽 이미지의 같은 색 픽셀과 같은 값.
     시뮬레이션 색은 사용자에게 내보내지 않음 (내부 계산에만 사용).

역할 분리 원칙 (v1과 동일)
  - 색 값(hex)은 전부 픽셀 계산. Gemini는 후보 색 번호 선택, 이름, 느낌 문장, 무드 장면만 담당.

적용 위치: ai_server/services/color_moodboard_service.py
"""

from __future__ import annotations

import base64
import colorsys
import io
import json
import logging
import math
import re
import threading
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger("color_moodboard")

# YOLO(Ultralytics) 모델 객체를 이 모듈 안에서 동시에 predict 하지 않도록 순서대로 실행.
_DETECT_LOCK = threading.Lock()

# ─────────────────────────────────────────────
# 설정값 (모두 검증 전 설계값)
# ─────────────────────────────────────────────
WORK_MAX_SIDE = 320
DETECT_MAX_SIDE = 640
PHOTO_K = 6
ITEM_K = 4
MIN_CLUSTER_RATIO = 0.04
MERGE_DE = 6.0
BG_DE = 10.0
BG_MIN_SHARE = 0.2
SKIN_EXCLUDE_MAX_RATIO = 0.2   # Gemini 실패 시, 피부색처럼 보여도 이 비율 이상이면 옷 색으로 유지

SAME_DE = 6.0
SIMILAR_DE = 12.0
ACHROMATIC_C = 8.0             # 이보다 채도가 낮으면 무채색
CHROMATIC_C = 15.0             # 이 이상이면 확실한 유채색 → 색상각 비교
MAX_HUE_DIFF = 30.0
SECOND_COLOR_MIN_RATIO = 0.35  # 아이템의 두 번째 색도 비교하는 최소 비율
CONFUSE_REAL_DE = 15.0         # 실제로는 이만큼 이상 다르고
CONFUSE_SEEN_DE = 8.0          # 색각 시뮬레이션에서는 이만큼 이하로 비슷하면 "헷갈림 주의"
MAX_MATCHES = 12

COLORS_VERSION = "v2|"
GARMENT_SLOTS = ("top", "bottom", "outer", "onepiece")
DEFICIENT_TYPES = ("protanopia", "deuteranopia", "tritanopia")
COLOR_TYPE_LABELS = {"protanopia": "적색맹", "deuteranopia": "녹색맹", "tritanopia": "청황색맹"}
MOOD_COUNT = 4

BASIC_COLOR_NAMES: List[Tuple[str, str]] = [
    ("블랙", "#1A1A1A"), ("화이트", "#F7F7F5"), ("아이보리", "#F1EBDD"), ("크림", "#F3E6C8"),
    ("라이트 그레이", "#C8C8C8"), ("그레이", "#808080"), ("차콜", "#3A4048"), ("그레이 베이지", "#B5A79E"),
    ("네이비", "#1E2A4A"), ("데님 블루", "#4A6A8F"), ("블루", "#2F5FBF"), ("스카이블루", "#8CC0E8"),
    ("민트", "#9AD8C6"), ("청록", "#2A8C8C"), ("그린", "#2E7D4F"), ("다크 그린", "#1F3D2E"),
    ("연두", "#A8C66C"), ("올리브", "#7A7A3A"), ("카키", "#6B6B3A"), ("옐로우", "#F0C93A"),
    ("머스타드", "#C9A227"), ("베이지", "#D8C3A5"), ("카멜", "#B07D48"), ("브라운", "#6E4528"),
    ("다크 브라운", "#3E2A1E"), ("오렌지", "#E8792B"), ("테라코타", "#B5543C"), ("코랄", "#F08070"),
    ("레드", "#C0392B"), ("와인", "#722F37"), ("버건디", "#6D1A2B"), ("핑크", "#F2A6B8"),
    ("라벤더", "#B8A6D9"), ("퍼플", "#6C4A9E"),
]


# ─────────────────────────────────────────────
# 색 공간 / 색 차이
# ─────────────────────────────────────────────
def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    h = hex_str.strip().lstrip("#")
    if len(h) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        raise ValueError(f"잘못된 hex 값: {hex_str}")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(rgb: Sequence[float]) -> str:
    r, g, b = [int(round(min(255, max(0, v)))) for v in rgb]
    return f"#{r:02X}{g:02X}{b:02X}"


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """(N,3) 0~255 sRGB -> (N,3) CIE Lab (D65)."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = (lin @ m.T) / np.array([0.95047, 1.0, 1.08883])
    eps, kappa = 216 / 24389, 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], axis=1)


def ciede2000(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """CIEDE2000 색차 (kL=kC=kH=1). 브로드캐스트 가능."""
    lab1 = np.asarray(lab1, dtype=np.float64)
    lab2 = np.asarray(lab2, dtype=np.float64)
    L1, a1, b1 = lab1[..., 0], lab1[..., 1], lab1[..., 2]
    L2, a2, b2 = lab2[..., 0], lab2[..., 1], lab2[..., 2]
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cbar = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = h2p - h1p
    dhp = np.where(dhp > 180, dhp - 360, dhp)
    dhp = np.where(dhp < -180, dhp + 360, dhp)
    dhp = np.where(C1p * C2p == 0, 0, dhp)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp / 2))
    Lbarp, Cbarp = (L1 + L2) / 2, (C1p + C2p) / 2
    hsum, habs = h1p + h2p, np.abs(h1p - h2p)
    hbarp = np.where(habs > 180, np.where(hsum < 360, (hsum + 360) / 2, (hsum - 360) / 2), hsum / 2)
    hbarp = np.where(C1p * C2p == 0, hsum, hbarp)
    T = (1 - 0.17 * np.cos(np.radians(hbarp - 30)) + 0.24 * np.cos(np.radians(2 * hbarp))
         + 0.32 * np.cos(np.radians(3 * hbarp + 6)) - 0.20 * np.cos(np.radians(4 * hbarp - 63)))
    dtheta = 30 * np.exp(-(((hbarp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7))
    Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / np.sqrt(20 + (Lbarp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbarp, 1 + 0.015 * Cbarp * T
    Rt = -np.sin(np.radians(2 * dtheta)) * Rc
    return np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def hex_to_lab(hex_str: str) -> np.ndarray:
    return srgb_to_lab(np.array([hex_to_rgb(hex_str)]))[0]


def de_hex(h1: str, h2: str) -> float:
    return float(ciede2000(hex_to_lab(h1), hex_to_lab(h2)))


def lch(hex_str: str) -> Tuple[float, float, float]:
    L, a, b = hex_to_lab(hex_str)
    return float(L), float(math.hypot(a, b)), float(math.degrees(math.atan2(b, a)) % 360)


def hue_diff(h1: float, h2: float) -> float:
    d = abs(h1 - h2) % 360
    return min(d, 360 - d)


def same_family(hex1: str, hex2: str) -> bool:
    """무채색 vs 유채색은 다른 계열, 둘 다 유채색이면 색상각 차이로 판단."""
    _, c1, h1 = lch(hex1)
    _, c2, h2 = lch(hex2)
    if (c1 < ACHROMATIC_C and c2 >= CHROMATIC_C) or (c2 < ACHROMATIC_C and c1 >= CHROMATIC_C):
        return False
    if c1 >= CHROMATIC_C and c2 >= CHROMATIC_C:
        return hue_diff(h1, h2) <= MAX_HUE_DIFF
    return True


# ─────────────────────────────────────────────
# 색을 글로 설명 (Gemini 없이 계산)
# ─────────────────────────────────────────────
def hsv_hue(hex_str: str) -> float:
    """색 이름 계열 판단용 HSV 색상각(0~360). Lab 색상각은 파랑/보라 구간이 겹쳐 이름 붙이기에 부적합했음."""
    r, g, b = [v / 255.0 for v in hex_to_rgb(hex_str)]
    return colorsys.rgb_to_hsv(r, g, b)[0] * 360


def color_family(L: float, C: float, hh: float) -> str:
    """L, C: Lab 밝기/채도, hh: HSV 색상각. 경계값은 기본 색 표로 맞춘 설계값 (검증 전)."""
    if C < ACHROMATIC_C:
        return "흰색 계열" if L >= 88 else "검정 계열" if L <= 22 else "회색 계열"
    if 20 <= hh < 60 and L >= 65 and C < 32:
        return "베이지 계열"
    if 10 <= hh < 50 and L < 65 and C < 55:
        return "갈색 계열"
    if hh >= 345 or hh < 15:
        return "분홍 계열" if L >= 72 else "자주·와인 계열" if L < 35 else "빨강 계열"
    if hh < 45:
        return "주황 계열"
    if hh < 58:
        return "노랑 계열"
    if hh < 100:
        return "연두·올리브 계열"
    if hh < 160:
        return "초록 계열"
    if hh < 200:
        return "청록 계열"
    if hh < 255:
        return "남색 계열" if L < 30 else "파랑 계열"
    if hh < 290:
        return "보라 계열"
    return "분홍 계열" if L >= 65 else "자주·와인 계열"


def describe_color(hex_str: str) -> dict:
    L, C, _ = lch(hex_str)
    hh = hsv_hue(hex_str)
    lightness = "밝은" if L >= 75 else "어두운" if L < 35 else "중간 밝기"
    chroma = "무채색" if C < ACHROMATIC_C else "탁한" if C < 20 else "중간 채도" if C < 40 else "선명한"
    if C < ACHROMATIC_C:
        temperature = "온도감 거의 없음"
    elif hh >= 330 or hh < 70:
        temperature = "따뜻한 느낌"
    elif 160 <= hh < 290:
        temperature = "차가운 느낌"
    else:
        temperature = "중간 온도"
    family = color_family(L, C, hh)
    chroma_text = "색기가 거의 없는 색" if chroma == "무채색" else f"{chroma} 색"
    return {
        "family": family, "lightness": lightness, "chroma": chroma, "temperature": temperature,
        "text": f"{family} · {lightness} · {chroma_text} · {temperature}",
    }


def nearest_basic_name(hex_str: str) -> str:
    lab = hex_to_lab(hex_str)
    return min(BASIC_COLOR_NAMES, key=lambda nh: float(ciede2000(lab, hex_to_lab(nh[1]))))[0]


# ─────────────────────────────────────────────
# 색각 시뮬레이션 / 보정 (daltonization_service와 같은 행렬, 픽셀 1개)
# ─────────────────────────────────────────────
def _sim_and_corrected(hex_str: str, color_type: str) -> Tuple[np.ndarray, np.ndarray]:
    from services.daltonization_service import SIMULATION_MATRIX, RGB_TO_LMS, LMS_TO_RGB
    px = np.array([hex_to_rgb(hex_str)], dtype=np.float64) / 255.0
    sim = (px @ np.array(RGB_TO_LMS).T) @ np.array(SIMULATION_MATRIX[color_type]).T @ np.array(LMS_TO_RGB).T
    err = px - sim
    corr = np.zeros_like(err)
    corr[:, 1] = err[:, 0] * 0.7 + err[:, 2] * 0.3
    corr[:, 2] = err[:, 2] * 0.7 + err[:, 0] * 0.3
    return np.clip(sim[0], 0, 1) * 255, np.clip(px[0] + corr[0], 0, 1) * 255


def corrected_hex(hex_str: str, color_type: str) -> Optional[str]:
    if color_type not in DEFICIENT_TYPES:
        return None
    return rgb_to_hex(_sim_and_corrected(hex_str, color_type)[1])


def seen_de(hex1: str, hex2: str, color_type: str) -> float:
    """색각 시뮬레이션 후의 색 차이 (내부 계산용, 사용자에게 시뮬레이션 색은 보여주지 않음)."""
    s1 = _sim_and_corrected(hex1, color_type)[0]
    s2 = _sim_and_corrected(hex2, color_type)[0]
    return float(ciede2000(srgb_to_lab(s1[None, :])[0], srgb_to_lab(s2[None, :])[0]))


# ─────────────────────────────────────────────
# 이미지 / 팔레트
# ─────────────────────────────────────────────
def decode_image(image_b64: str) -> Image.Image:
    if not image_b64:
        raise ValueError("이미지가 비어 있습니다.")
    data = image_b64.split(",", 1)[1] if "," in image_b64[:100] else image_b64
    try:
        img = Image.open(io.BytesIO(base64.b64decode(data)))
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except Exception as e:
        raise ValueError(f"이미지를 읽을 수 없습니다: {e}") from e


def _resized(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    scale = min(1.0, max_side / max(w, h))
    if scale >= 1.0:
        return img.copy()
    return img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)


def kmeans(points: np.ndarray, k: int, iters: int = 15, seed: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    n = len(points)
    if n == 0:
        return np.zeros((0, points.shape[1])), np.zeros(0, dtype=int)
    k = max(1, min(k, n))
    rng = np.random.default_rng(seed)
    centers = [points[rng.integers(n)]]
    for _ in range(1, k):
        d2 = np.min(((points[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(-1), axis=1)
        total = d2.sum()
        if total <= 0:
            break
        centers.append(points[rng.choice(n, p=d2 / total)])
    centers = np.array(centers, dtype=np.float64)
    labels = np.zeros(n, dtype=int)
    for it in range(iters):
        new_labels = ((points[:, None, :] - centers[None, :, :]) ** 2).sum(-1).argmin(1)
        if it > 0 and np.array_equal(new_labels, labels):
            break
        labels = new_labels
        for j in range(len(centers)):
            sel = points[labels == j]
            if len(sel):
                centers[j] = sel.mean(0)
    return centers, labels


def is_skin_rgb(rgb: Sequence[float]) -> bool:
    """RGB 피부색 규칙(Kovac 등). 카멜/베이지 옷도 걸릴 수 있어 힌트로만 사용."""
    r, g, b = rgb
    return (r > 95 and g > 40 and b > 20 and (max(rgb) - min(rgb)) > 15
            and abs(r - g) > 15 and r > g and r > b)


def palette_from_pixels(pixels: np.ndarray, k: int) -> List[dict]:
    if len(pixels) == 0:
        return []
    if len(pixels) > 6000:
        pixels = pixels[np.random.default_rng(1).choice(len(pixels), 6000, replace=False)]
    lab = srgb_to_lab(pixels)
    centers, labels = kmeans(lab, k)
    groups = []
    for j in range(len(centers)):
        mask = labels == j
        cnt = int(mask.sum())
        if cnt:
            rgb = pixels[mask].mean(0)
            groups.append({"rgb": rgb, "lab": srgb_to_lab(rgb[None, :])[0], "count": cnt})
    groups.sort(key=lambda g: -g["count"])
    merged: List[dict] = []
    for g in groups:
        for m in merged:
            if float(ciede2000(m["lab"], g["lab"])) < MERGE_DE:
                tot = m["count"] + g["count"]
                m["rgb"] = (m["rgb"] * m["count"] + g["rgb"] * g["count"]) / tot
                m["lab"] = srgb_to_lab(m["rgb"][None, :])[0]
                m["count"] = tot
                break
        else:
            merged.append(dict(g))
    total = sum(m["count"] for m in merged)
    out = []
    for m in sorted(merged, key=lambda x: -x["count"]):
        if m["count"] / total < MIN_CLUSTER_RATIO:
            continue
        out.append({"hex": rgb_to_hex(m["rgb"]), "rgb": [float(v) for v in m["rgb"]],
                    "lab": m["lab"], "ratio": m["count"] / total})
    s = sum(o["ratio"] for o in out) or 1.0
    for o in out:
        o["ratio"] = round(o["ratio"] / s, 3)
    return out


def _clothing_classes(slot: Optional[str]) -> Tuple[str, ...]:
    from services.cutout_service import CLOTHING_CLASSES_BY_SLOT
    if slot and slot in CLOTHING_CLASSES_BY_SLOT:
        return CLOTHING_CLASSES_BY_SLOT[slot]
    return tuple(c for names in CLOTHING_CLASSES_BY_SLOT.values() for c in names)


def _region_mask(img: Image.Image, detector, slot: Optional[str]) -> Tuple[np.ndarray, str]:
    w, h = img.size
    mask = np.zeros((h, w), dtype=bool)
    if detector is not None:
        try:
            det_img = _resized(img, DETECT_MAX_SIDE)
            sx, sy = w / det_img.size[0], h / det_img.size[1]
            names = _clothing_classes(slot)
            with _DETECT_LOCK:
                raw = detector.detect(det_img)
            dets = [d for d in raw if d.cls_name in names]
            if slot and dets:
                dets = [max(dets, key=lambda d: d.conf)]
            for d in dets:
                x1, y1, x2, y2 = d.box
                xa, xb = int(max(0, x1 * sx)), int(min(w, x2 * sx))
                ya, yb = int(max(0, y1 * sy)), int(min(h, y2 * sy))
                if xb > xa and yb > ya:
                    mask[ya:yb, xa:xb] = True
            if mask.sum() >= 0.02 * w * h:
                return mask, "yolo"
        except Exception as e:
            logger.warning("[moodboard] YOLO 사용 불가, 가운데 영역으로 대체: %s", e)
    mask[:] = False
    mask[int(h * 0.15):int(h * 0.9), int(w * 0.2):int(w * 0.8)] = True
    return mask, "center"


def _background_colors(arr: np.ndarray) -> List[np.ndarray]:
    h, w, _ = arr.shape
    t = max(1, int(min(h, w) * 0.04))
    border = np.concatenate([arr[:t].reshape(-1, 3), arr[-t:].reshape(-1, 3),
                             arr[:, :t].reshape(-1, 3), arr[:, -t:].reshape(-1, 3)])
    return [p["lab"] for p in palette_from_pixels(border, 3) if p["ratio"] >= BG_MIN_SHARE]


def extract_palette(img: Image.Image, detector=None, slot: Optional[str] = None, k: int = PHOTO_K) -> Tuple[List[dict], str]:
    """박스 + 배경 제거 방식 (업로드 사진용, 아이템 누끼 실패 시 대체용)."""
    work = _resized(img, WORK_MAX_SIDE)
    arr = np.asarray(work, dtype=np.float64)
    mask, method = _region_mask(work, detector, slot)
    pixels = arr[mask]
    bg = _background_colors(arr)
    if bg and len(pixels):
        lab = srgb_to_lab(pixels)
        keep = np.ones(len(pixels), dtype=bool)
        for b in bg:
            keep &= ciede2000(lab, b[None, :]) >= BG_DE
        if keep.sum() >= 0.15 * len(pixels):
            pixels = pixels[keep]
    return palette_from_pixels(pixels, k), method


# ─────────────────────────────────────────────
# 옷장 아이템 색 (SAM 누끼)
# ─────────────────────────────────────────────
def parse_item_colors(text: Optional[str]) -> Optional[List[Tuple[str, float]]]:
    """v2 저장값만 인정. v2가 아니면 None(다시 계산 필요), "v2|none"이면 빈 목록."""
    if not text or not text.startswith(COLORS_VERSION):
        return None
    out = []
    for part in text[len(COLORS_VERSION):].split(","):
        m = re.fullmatch(r"\s*(#[0-9A-Fa-f]{6}):([0-9.]+)\s*", part)
        if m:
            out.append((m.group(1).upper(), float(m.group(2))))
    return out


def format_item_colors(palette: List[dict], top: int = 3) -> str:
    if not palette:
        return COLORS_VERSION + "none"
    return COLORS_VERSION + ",".join(f"{p['hex']}:{p['ratio']:.2f}" for p in palette[:top])


def _palette_from_rgba(rgba: Image.Image, k: int) -> List[dict]:
    small = rgba.copy()
    small.thumbnail((WORK_MAX_SIDE, WORK_MAX_SIDE))
    arr = np.asarray(small, dtype=np.float64)
    pixels = arr[arr[..., 3] > 200][:, :3]   # 가장자리 반투명 픽셀(배경 섞임)은 제외
    return palette_from_pixels(pixels, k)


class _FixedDetections:
    """이미 구한 YOLO 검출 결과를 cut_out_item에 넘기기 위한 대체 검출기."""
    def __init__(self, dets):
        self._dets = dets

    def detect(self, image):
        return self._dets


def compute_item_colors(image_b64: str, category: str, detector_factory: Optional[Callable] = None,
                        segmenter_factory: Optional[Callable] = None) -> dict:
    """아이템 사진 1장의 색. 반환: {"colors": "v2|...", "method": "yolo_sam"|"yolo"|"center", "note": str}"""
    from services.cutout_service import normalize_category
    img = decode_image(image_b64)
    slot = normalize_category(category)
    detector = None
    try:
        if detector_factory is None:
            from services.cutout_service import get_default_detector
            detector_factory = get_default_detector
        detector = detector_factory()
    except Exception as e:
        logger.warning("[item-colors] 검출기 로드 실패: %s", e)

    note = ""
    if detector is not None and slot:
        try:
            if segmenter_factory is None:
                from services.cutout_service import SamBoxSegmenter
                segmenter_factory = SamBoxSegmenter
            from services.cutout_service import cut_out_item
            # YOLO 검출만 _DETECT_LOCK 안에서 하고, 오래 걸리는 SAM은 잠금 밖에서 실행.
            # (SAM 동안 잠금을 잡고 있으면 사진 업로드 쪽 YOLO 검출이 아이템 1개 처리 시간만큼 기다리게 됨)
            with _DETECT_LOCK:
                dets = detector.detect(img)
            with segmenter_factory() as seg:
                cut = cut_out_item(img, slot, _FixedDetections(dets), seg)
            # "original"(누끼 실패, 원본 그대로)만 아니면 누끼 결과 사용.
            # cutout_service의 대체 방식(yolo_sam_related / yolo_sam_any / sam_full_box)도 옷만 잘라낸 결과이므로 포함.
            if cut.method != "original":
                pal = _palette_from_rgba(cut.image, ITEM_K)
                if pal:
                    return {"colors": format_item_colors(pal), "method": cut.method, "note": cut.note or ""}
            note = cut.note or ""
        except Exception as e:
            logger.warning("[item-colors] 누끼 실패, 박스 방식으로 대체: %s", e)
            note = "누끼 실패"
    pal, method = extract_palette(img, detector, slot, k=ITEM_K)
    return {"colors": format_item_colors(pal), "method": method, "note": note}


# ─────────────────────────────────────────────
# 옷장 매칭 + 헷갈림 경고
# ─────────────────────────────────────────────
def match_wardrobe(base_hex: str, color_type: str, items: List[dict]) -> dict:
    """
    base_hex: 사용자가 고른 기준 색 (사진 팔레트 중 하나)
    items   : [{"id", "category", "dominantColors"}]
    반환    : matches(같은/비슷한 색), confusions(비슷해 보이지만 다른 색), 집계 수
    """
    from services.cutout_service import normalize_category
    deficient = color_type in DEFICIENT_TYPES
    base_family = describe_color(base_hex)["family"]
    matches, confusions, family = [], [], []
    eligible = analyzed = 0
    for it in items:
        if normalize_category(it.get("category")) not in GARMENT_SLOTS:
            continue
        eligible += 1
        colors = parse_item_colors(it.get("dominantColors"))
        if colors is None:
            continue
        analyzed += 1
        if not colors:
            continue
        candidates = [colors[0]] + [c for c in colors[1:2] if c[1] >= SECOND_COLOR_MIN_RATIO]

        best = None
        for hx, _ in candidates:
            if not same_family(base_hex, hx):
                continue
            d = de_hex(base_hex, hx)
            if best is None or d < best[0]:
                best = (d, hx)
        if best and best[0] <= SIMILAR_DE:
            matches.append({
                "itemId": str(it.get("id")), "deltaE": round(best[0], 1),
                "label": "거의 같은 색" if best[0] <= SAME_DE else "비슷한 색",
                "itemHex": best[1], "itemCorrectedHex": corrected_hex(best[1], color_type),
                "itemDescription": describe_color(best[1])["text"],
            })
            continue

        if deficient:
            main = colors[0][0]
            real = de_hex(base_hex, main)
            seen = seen_de(base_hex, main, color_type)
            if real >= CONFUSE_REAL_DE and seen <= CONFUSE_SEEN_DE:
                confusions.append({
                    "itemId": str(it.get("id")), "deltaE": round(real, 1), "seenDeltaE": round(seen, 1),
                    "itemHex": main, "itemCorrectedHex": corrected_hex(main, color_type),
                    "itemDescription": describe_color(main)["text"],
                })
                continue

        # 같은 색은 아니지만 같은 색 계열(예: 갈색 계열)인 옷. 주 색 기준.
        main = colors[0][0]
        main_desc = describe_color(main)
        if main_desc["family"] == base_family:
            family.append({
                "itemId": str(it.get("id")), "deltaE": round(de_hex(base_hex, main), 1),
                "itemHex": main, "itemCorrectedHex": corrected_hex(main, color_type),
                "itemDescription": main_desc["text"],
            })
    matches.sort(key=lambda m: m["deltaE"])
    confusions.sort(key=lambda m: m["seenDeltaE"])
    family.sort(key=lambda m: m["deltaE"])
    return {
        "baseHex": base_hex.upper(),
        "baseCorrectedHex": corrected_hex(base_hex, color_type),
        "baseDescription": describe_color(base_hex)["text"],
        "matches": matches[:MAX_MATCHES],
        "confusions": confusions[:MAX_MATCHES],
        "sameFamily": family[:MAX_MATCHES],
        "baseFamily": base_family,
        "eligibleCount": eligible,
        "analyzedCount": analyzed,
        "colorDeficient": deficient,
        "colorTypeLabel": COLOR_TYPE_LABELS.get(color_type, ""),
        "thresholds": {"same": SAME_DE, "similar": SIMILAR_DE, "confuseReal": CONFUSE_REAL_DE, "confuseSeen": CONFUSE_SEEN_DE},
    }


def photo_confusions(palette: List[dict], color_type: str) -> List[dict]:
    """사진 속 옷 색끼리 '실제로는 다르지만 비슷해 보일 수 있는' 쌍."""
    if color_type not in DEFICIENT_TYPES:
        return []
    garment = [p for p in palette if p["isGarment"]]
    out = []
    for i in range(len(garment)):
        for j in range(i + 1, len(garment)):
            a, b = garment[i], garment[j]
            real = de_hex(a["hex"], b["hex"])
            seen = seen_de(a["hex"], b["hex"], color_type)
            if real >= CONFUSE_REAL_DE and seen <= CONFUSE_SEEN_DE:
                out.append({"a": a["index"], "b": b["index"], "deltaE": round(real, 1), "seenDeltaE": round(seen, 1)})
    return out


# ─────────────────────────────────────────────
# Gemini 무드보드
# ─────────────────────────────────────────────
def _build_prompt(palette: List[dict], color_type: str) -> str:
    lines = [f'{p["index"]}: {p["hex"]} ({p["description"]["text"]}, 비율 {round(p["ratio"] * 100)}%'
             f'{", 피부색일 수 있음" if p["likelySkin"] else ""})' for p in palette]
    reader = (f"사용자는 색각 이상({COLOR_TYPE_LABELS.get(color_type, color_type)})이 있어 색을 직접 구분하기 어렵습니다. "
              if color_type in DEFICIENT_TYPES else "")
    return (
        "당신은 패션 색채 가이드입니다. 사진은 옷을 찍은 사진이고, 아래는 사진에서 픽셀 계산으로 뽑은 색 후보입니다.\n"
        + "\n".join(lines) + "\n\n" + reader +
        "규칙:\n"
        "- 반드시 위 후보의 번호(index)만 사용하고, 새로운 색 값(hex)을 만들지 마세요.\n"
        "- garment_color_indexes: 후보 중 옷의 색인 것만 고르세요. 배경, 피부, 머리카락 색은 제외합니다.\n"
        "- palette: 모든 후보에 대해 한국어 색 이름(name, 10자 이내)과 feeling(색을 눈으로 보지 않아도 떠올릴 수 있도록 "
        "온도감, 계절, 사물에 빗댄 한 문장, 40자 이내)을 쓰세요.\n"
        f"- moods: 이 옷의 색감에서 떠오르는 장면 정확히 {MOOD_COUNT}개. title(15자 이내), scene(40자 이내), "
        "keywords(2~3개, 각 6자 이내), color_indexes(그 장면에 어울리는 옷 색 번호 1~3개).\n"
        "- summary: 이 옷의 색감을 한 문장(50자 이내)으로. tip: 이 색과 어울리는 코디 팁 한 문장(60자 이내).\n"
        "- 브랜드, 가격, 소재처럼 사진만으로 알 수 없는 사실은 쓰지 마세요.\n"
        "마크다운 없이 아래 형식의 순수 JSON만 출력하세요.\n"
        '{"garment":"사진 속 옷 한 줄 설명","garment_color_indexes":[0],'
        '"palette":[{"index":0,"name":"","feeling":""}],"summary":"","tip":"",'
        '"moods":[{"title":"","scene":"","keywords":[""],"color_indexes":[0]}]}'
    )


def _parse_json(text: str) -> Optional[dict]:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        return None


def _clip(s, n: int) -> str:
    return str(s or "").strip()[:n]


def _apply_gemini(palette: List[dict], data: Optional[dict]) -> Tuple[dict, bool]:
    valid = {p["index"] for p in palette}
    if not data:
        return {}, False
    names = {}
    for e in data.get("palette") or []:
        if isinstance(e, dict) and e.get("index") in valid:
            names[e["index"]] = (_clip(e.get("name"), 12), _clip(e.get("feeling"), 60))
    for p in palette:
        if p["index"] in names and names[p["index"]][0]:
            p["name"], p["feeling"] = names[p["index"]]
    garment = [i for i in (data.get("garment_color_indexes") or []) if i in valid]
    moods = []
    for m in (data.get("moods") or [])[:MOOD_COUNT]:
        if not isinstance(m, dict):
            continue
        idxs = [i for i in (m.get("color_indexes") or []) if i in valid][:3]
        if not idxs or not _clip(m.get("title"), 20):
            continue
        moods.append({
            "title": _clip(m.get("title"), 20),
            "scene": _clip(m.get("scene"), 60),
            "keywords": [_clip(k, 8) for k in (m.get("keywords") or [])[:3] if _clip(k, 8)],
            "colors": [next(p["hex"] for p in palette if p["index"] == i) for i in idxs],
        })
    return {"garment": _clip(data.get("garment"), 60), "summary": _clip(data.get("summary"), 80),
            "tip": _clip(data.get("tip"), 90), "moods": moods, "garmentIndexes": garment}, bool(garment)


def build_moodboard(image_b64: str, color_type: str = "", detector_factory: Optional[Callable] = None,
                    vision_fn: Optional[Callable] = None) -> dict:
    """업로드 사진 -> 팔레트(설명, 보정 색 포함) + Gemini 무드 + 사진 속 헷갈림 쌍. 옷장 매칭은 match_wardrobe가 따로 담당."""
    notes: List[str] = []
    detector = None
    try:
        if detector_factory is None:
            from services.cutout_service import get_default_detector
            detector_factory = get_default_detector
        detector = detector_factory()
    except Exception as e:
        logger.warning("[moodboard] 검출기 로드 실패: %s", e)
        notes.append("옷 검출 모델을 쓸 수 없어 사진 가운데 영역에서 색을 추출했어요.")

    img = decode_image(image_b64)
    palette, method = extract_palette(img, detector)
    if method == "center" and detector is not None:
        notes.append("사진에서 옷을 찾지 못해 가운데 영역에서 색을 추출했어요.")
    if not palette:
        raise ValueError("사진에서 색을 추출하지 못했습니다.")

    for i, p in enumerate(palette):
        p["index"] = i
        p["likelySkin"] = is_skin_rgb(p["rgb"])
        p["name"] = nearest_basic_name(p["hex"])
        p["feeling"] = ""
        p["description"] = describe_color(p["hex"])
        p["correctedHex"] = corrected_hex(p["hex"], color_type)

    data = None
    try:
        if vision_fn is None:
            from services.gemini_service import gemini_vision
            vision_fn = gemini_vision
        data = _parse_json(vision_fn(_resized(img, 512), _build_prompt(palette, color_type)))
    except Exception as e:
        logger.warning("[moodboard] Gemini 호출 실패: %s", e)
    extra, ok = _apply_gemini(palette, data)
    if not ok:
        notes.append("AI 설명을 만들지 못해 기본 색 이름과 계산한 색 설명으로 표시했어요.")
        keep = [p["index"] for p in palette if not (p["likelySkin"] and p["ratio"] < SKIN_EXCLUDE_MAX_RATIO)]
        extra["garmentIndexes"] = keep or [palette[0]["index"]]
        extra.setdefault("moods", [])

    garment_set = set(extra["garmentIndexes"])
    for p in palette:
        p["isGarment"] = p["index"] in garment_set
    base = max((p for p in palette if p["isGarment"]), key=lambda p: p["ratio"])

    public_keys = ("index", "hex", "ratio", "name", "feeling", "isGarment", "likelySkin", "description", "correctedHex")
    return {
        "method": method,
        "colorType": color_type if color_type in DEFICIENT_TYPES else "normal",
        "colorTypeLabel": COLOR_TYPE_LABELS.get(color_type, ""),
        "palette": [{k: p[k] for k in public_keys} for p in palette],
        "baseIndex": base["index"],
        "photoConfusions": photo_confusions(palette, color_type),
        "garment": extra.get("garment", ""),
        "summary": extra.get("summary", ""),
        "tip": extra.get("tip", ""),
        "moods": extra.get("moods", []),
        "moodSource": "gemini" if ok else "fallback",
        "notes": notes,
    }