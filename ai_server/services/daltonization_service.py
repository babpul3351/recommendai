import numpy as np
from PIL import Image
import base64
import io

# 색각 유형별 시뮬레이션 행렬 (LMS 색공간 기반)
SIMULATION_MATRIX = {
    "protanopia": [  # 제1색맹 (적색맹)
        [0.0, 2.02344, -2.52581],
        [0.0, 1.0,      0.0    ],
        [0.0, 0.0,      1.0    ]
    ],
    "deuteranopia": [  # 제2색맹 (녹색맹)
        [1.0,      0.0, 0.0],
        [0.494207, 0.0, 1.24827],
        [0.0,      0.0, 1.0    ]
    ],
    "tritanopia": [  # 제3색맹 (청색맹)
        [1.0,       0.0,      0.0     ],
        [0.0,       1.0,      0.0     ],
        [-0.395913, 0.801109, 0.0     ]
    ]
}

# RGB → LMS 변환 행렬
RGB_TO_LMS = [
    [17.8824,  43.5161,  4.11935],
    [3.45565,  27.1554,  3.86714],
    [0.0299566, 0.184309, 1.46709]
]

# LMS → RGB 변환 행렬 (역행렬)
LMS_TO_RGB = [
    [ 0.0809444479, -0.130504409,  0.116721066],
    [-0.0102485335,  0.0540193266,-0.113614708],
    [-0.000365296938,-0.00412161469, 0.693511405]
]

def simulate_color_blindness(image_b64: str, color_type: str) -> str:
    """
    색각 유형에 따라 이미지를 시뮬레이션하고 Daltonization 보정 적용
    반환: 보정된 이미지 base64
    """
    try:
        # base64 디코딩
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]
        img_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_array = np.array(img, dtype=np.float64) / 255.0

        h, w, _ = img_array.shape
        result = np.zeros_like(img_array)

        sim_matrix = np.array(SIMULATION_MATRIX.get(color_type, SIMULATION_MATRIX["deuteranopia"]))
        rgb2lms = np.array(RGB_TO_LMS)
        lms2rgb = np.array(LMS_TO_RGB)

        for y in range(h):
            for x in range(w):
                rgb = img_array[y, x]

                # RGB → LMS
                lms = rgb2lms @ rgb

                # 색각 시뮬레이션
                lms_sim = sim_matrix @ lms

                # LMS → RGB (시뮬레이션된 색상)
                rgb_sim = lms2rgb @ lms_sim

                # Daltonization 보정: 원본과 시뮬레이션 차이를 다른 채널에 추가
                error = rgb - rgb_sim
                correction = np.array([
                    0.0,           # R 채널
                    error[0] * 0.7 + error[2] * 0.3,  # G 채널에 보정
                    error[2] * 0.7 + error[0] * 0.3   # B 채널에 보정
                ])

                result[y, x] = np.clip(rgb + correction, 0, 1)

        # PIL 이미지로 변환
        result_img = Image.fromarray((result * 255).astype(np.uint8))
        buffer = io.BytesIO()
        result_img.save(buffer, format="JPEG", quality=85)
        result_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{result_b64}"

    except Exception as e:
        print(f"Daltonization 오류: {e}")
        return image_b64  # 오류 시 원본 반환


def simulate_only(image_b64: str, color_type: str) -> str:
    """
    보정 없이 색각 이상 시뮬레이션만 적용 (보정 전 미리보기용)
    """
    try:
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]
        img_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_array = np.array(img, dtype=np.float64) / 255.0

        h, w, _ = img_array.shape
        result = np.zeros_like(img_array)

        sim_matrix = np.array(SIMULATION_MATRIX.get(color_type, SIMULATION_MATRIX["deuteranopia"]))
        rgb2lms = np.array(RGB_TO_LMS)
        lms2rgb = np.array(LMS_TO_RGB)

        for y in range(h):
            for x in range(w):
                rgb = img_array[y, x]
                lms = rgb2lms @ rgb
                lms_sim = sim_matrix @ lms
                rgb_sim = lms2rgb @ lms_sim
                result[y, x] = np.clip(rgb_sim, 0, 1)

        result_img = Image.fromarray((result * 255).astype(np.uint8))
        buffer = io.BytesIO()
        result_img.save(buffer, format="JPEG", quality=85)
        result_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{result_b64}"

    except Exception as e:
        print(f"시뮬레이션 오류: {e}")
        return image_b64