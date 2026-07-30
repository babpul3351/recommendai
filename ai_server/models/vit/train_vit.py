from transformers import ViTModel, ViTImageProcessor

processor = ViTImageProcessor.from_pretrained(
    "google/vit-base-patch16-224"
)

model = ViTModel.from_pretrained(
    "google/vit-base-patch16-224"
)

print("ViT 모델 로드 완료!")