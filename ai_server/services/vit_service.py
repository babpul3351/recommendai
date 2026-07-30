from transformers import ViTModel, ViTImageProcessor
from PIL import Image
from io import BytesIO
import base64
import torch
import torch.nn as nn

# 항상 동일한 결과
torch.manual_seed(42)

processor = ViTImageProcessor.from_pretrained(
    "google/vit-base-patch16-224"
)

model = ViTModel.from_pretrained(
    "google/vit-base-patch16-224"
)

# 768 → 512
projection = nn.Linear(768, 512)


def get_image_embedding(image):
    """
    PIL.Image -> 512차원 Feature 반환
    """

    if isinstance(image, str):
        image = Image.open(image).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    with torch.no_grad():
        outputs = model(**inputs)

    feature = outputs.last_hidden_state[:, 0, :]
    feature = projection(feature)

    feature = feature.squeeze().detach().numpy()

    return feature.tolist()


def classify_fashion_image(imageB64=None, imageUrl=None, topK=5):
    """
    ViT 테스트용 API

    현재는 분류 모델이 아니라
    Feature Vector를 반환한다.
    """

    if imageB64:

        if "," in imageB64:
            _, imageB64 = imageB64.split(",", 1)

        image = Image.open(
            BytesIO(base64.b64decode(imageB64))
        ).convert("RGB")

    elif imageUrl:

        image = Image.open(imageUrl).convert("RGB")

    else:

        raise Exception("이미지가 없습니다.")

    feature = get_image_embedding(image)

    return {
        "model": "ViT Base Patch16 224",
        "dimension": len(feature),
        "feature": feature[:20],   # 앞 20개만 반환
        "message": "ViT Feature 추출 성공"
    }