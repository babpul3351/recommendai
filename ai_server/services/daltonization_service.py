"""
daltonization_service.py — NumPy 벡터화 버전

변경 사항 (기존 대비)
------------------
기존 코드는 이미지의 모든 픽셀을 이중 for문(for y ... for x ...)으로
하나씩 순회하며 행렬 연산을 했습니다. 예를 들어 512x512 이미지라면
262,144번 반복문을 도는 구조라 매우 느립니다.

이번 버전은 NumPy의 벡터화 연산(@ 연산자를 배열 전체에 한 번에 적용)으로
바꿔서, 같은 계산을 반복문 없이 한 번에 처리합니다. 계산 결과(수치)는
기존과 완전히 동일하며, 속도만 크게 개선됩니다.
"""

import numpy as np
from PIL import Image
import base64
import io

# 색각 유형별 시뮬레이션 행렬 (LMS 색공간 기반) — 값 변경 없음
SIMULATION_MATRIX = {
    "protanopia": [
        [0.0, 2.02344, -2.52581],
        [0.0, 1.0,      0.0    ],
        [0.0, 0.0,      1.0    ]
    ],
    "deuteranopia": [
        [1.0,      0.0, 0.0],
        [0.494207, 0.0, 1.24827],
        [0.0,      0.0, 1.0    ]
    ],
    "tritanopia": [
        [1.0,       0.0,      0.0     ],
        [0.0,       1.0,      0.0     ],
        [-0.395913, 0.801109, 0.0     ]
    ]
}

RGB_TO_LMS = [
    [17.8824,  43.5161,  4.11935],
    [3.45565,  27.1554,  3.86714],
    [0.0299566, 0.184309, 1.46709]
]

LMS_TO_RGB = [
    [ 0.0809444479, -0.130504409,  0.116721066],
    [-0.0102485335,  0.0540193266,-0.113614708],
    [-0.000365296938,-0.00412161469, 0.693511405]
]


def _decode_image(image_b64: str) -> np.ndarray:
    """base64 이미지를 (H, W, 3) 형태의 0~1 범위 float 배열로 디코딩합니다."""
    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]
    img_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img, dtype=np.float64) / 255.0


def _encode_image(img_array: np.ndarray) -> str:
    """0~1 범위 float 배열을 다시 base64 JPEG 문자열로 인코딩합니다."""
    result_img = Image.fromarray((img_array * 255).astype(np.uint8))
    buffer = io.BytesIO()
    result_img.save(buffer, format="JPEG", quality=85)
    result_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{result_b64}"


def simulate_color_blindness(image_b64: str, color_type: str) -> str:
    """
    색각 유형에 따라 이미지를 시뮬레이션하고 Daltonization 보정 적용
    반환: 보정된 이미지 base64

    (벡터화 버전 — 계산 로직은 기존과 동일, 반복문만 제거)
    """
    try:
        img_array = _decode_image(image_b64)
        h, w, _ = img_array.shape

        sim_matrix = np.array(SIMULATION_MATRIX.get(color_type, SIMULATION_MATRIX["deuteranopia"]))
        rgb2lms = np.array(RGB_TO_LMS)
        lms2rgb = np.array(LMS_TO_RGB)

        # (H, W, 3) → (H*W, 3)로 펼쳐서 행렬 연산을 한 번에 적용
        pixels = img_array.reshape(-1, 3)  # shape: (N, 3)

        # RGB → LMS  (기존: rgb2lms @ rgb, 픽셀별 반복 → 이제 전체 픽셀 한 번에)
        lms = pixels @ rgb2lms.T

        # 색각 시뮬레이션
        lms_sim = lms @ sim_matrix.T

        # LMS → RGB (시뮬레이션된 색상)
        rgb_sim = lms_sim @ lms2rgb.T

        # Daltonization 보정: 원본과 시뮬레이션 차이를 다른 채널에 추가
        error = pixels - rgb_sim  # shape: (N, 3)

        correction = np.zeros_like(error)
        correction[:, 1] = error[:, 0] * 0.7 + error[:, 2] * 0.3  # G 채널
        correction[:, 2] = error[:, 2] * 0.7 + error[:, 0] * 0.3  # B 채널
        # R 채널(index 0)은 기존과 동일하게 보정 없음 (0.0)

        result_pixels = np.clip(pixels + correction, 0, 1)
        result = result_pixels.reshape(h, w, 3)

        return _encode_image(result)

    except Exception as e:
        print(f"Daltonization 오류: {e}")
        return image_b64  # 오류 시 원본 반환


def simulate_only(image_b64: str, color_type: str) -> str:
    """
    보정 없이 색각 이상 시뮬레이션만 적용 (보정 전 미리보기용)
    (벡터화 버전)
    """
    try:
        img_array = _decode_image(image_b64)
        h, w, _ = img_array.shape

        sim_matrix = np.array(SIMULATION_MATRIX.get(color_type, SIMULATION_MATRIX["deuteranopia"]))
        rgb2lms = np.array(RGB_TO_LMS)
        lms2rgb = np.array(LMS_TO_RGB)

        pixels = img_array.reshape(-1, 3)

        lms = pixels @ rgb2lms.T
        lms_sim = lms @ sim_matrix.T
        rgb_sim = lms_sim @ lms2rgb.T

        result = np.clip(rgb_sim, 0, 1).reshape(h, w, 3)

        return _encode_image(result)

    except Exception as e:
        print(f"시뮬레이션 오류: {e}")
        return image_b64