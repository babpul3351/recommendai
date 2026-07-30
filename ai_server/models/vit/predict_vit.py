from transformers import ViTModel, ViTImageProcessor
from PIL import Image
import torch
import torch.nn as nn

# 항상 같은 결과가 나오도록
torch.manual_seed(42)

# 768 -> 512 차원 변환
projection = nn.Linear(768, 512)

# 모델과 전처리기 불러오기
processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224")
model = ViTModel.from_pretrained("google/vit-base-patch16-224")

def extract_feature(image_path):
    # 이미지 읽기
    image = Image.open(image_path).convert("RGB")

    # ViT 입력 형태로 변환
    inputs = processor(images=image, return_tensors="pt")

    # 특징 추출
    with torch.no_grad():
        outputs = model(**inputs)

    # CLS 토큰 추출 (768차원)
    feature = outputs.last_hidden_state[:, 0, :]

    # 512차원으로 변환
    feature = projection(feature)

    # numpy 변환
    feature = feature.squeeze().detach().numpy()

    return feature

if __name__ == "__main__":
    feature = extract_feature("../../dataset/test.jpg")

    print("Feature 길이 :", len(feature))
    print(feature[:10])