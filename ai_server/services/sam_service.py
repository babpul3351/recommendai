import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import base64
import io
import numpy as np
import torch
from PIL import Image
from segment_anything import sam_model_registry, SamPredictor

CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "../checkpoints/sam_vit_b_01ec64.pth")
MODEL_TYPE = "vit_b"

_predictor: SamPredictor = None

def _load_sam():
    global _predictor
    if _predictor is not None:
        return
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"
    print(f"[SAM] 모델 로딩 중... (device={device})")
    sam = sam_model_registry[MODEL_TYPE](checkpoint=os.path.abspath(CHECKPOINT_PATH))
    sam.to(device)
    _predictor = SamPredictor(sam)
    print("[SAM] 모델 로딩 완료")

def remove_background_b64(image_b64: str) -> tuple[str, float]:
    """
    base64 이미지를 받아 배경을 제거한 뒤 투명 배경 PNG를 base64로 반환합니다.
    Returns: (result_b64, confidence_score)
    """
    _load_sam()

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image)
    h, w = image_np.shape[:2]

    _predictor.set_image(image_np)

    point_coords = np.array([[w // 2, h // 2]])
    point_labels = np.array([1])

    masks, scores, _ = _predictor.predict(
        point_coords=point_coords,
        point_labels=point_labels,
        multimask_output=True,
    )

    best_idx = int(np.argmax(scores))
    best_mask = masks[best_idx]
    best_score = float(scores[best_idx])

    alpha = (best_mask * 255).astype(np.uint8)
    rgba = np.dstack([image_np, alpha])
    result_image = Image.fromarray(rgba, mode="RGBA")

    buffer = io.BytesIO()
    result_image.save(buffer, format="PNG")
    result_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return result_b64, best_score
