import base64
import io
import os

from PIL import Image

vit_pipeline = None


def _decode_image(image_b64: str) -> Image.Image:
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def load_vit_pipeline():
    global vit_pipeline
    if vit_pipeline is not None:
        return vit_pipeline

    from transformers import pipeline

    model_name = os.getenv("VIT_MODEL_NAME", "google/vit-base-patch16-224")
    vit_pipeline = pipeline("image-classification", model=model_name)
    return vit_pipeline


def classify_fashion_image(image_b64: str, top_k: int = 5) -> dict:
    classifier = load_vit_pipeline()
    image = _decode_image(image_b64)
    predictions = classifier(image, top_k=max(1, min(top_k, 10)))

    return {
        "model": os.getenv("VIT_MODEL_NAME", "google/vit-base-patch16-224"),
        "predictions": [
            {
                "label": item["label"],
                "score": round(float(item["score"]), 4),
            }
            for item in predictions
        ],
    }
