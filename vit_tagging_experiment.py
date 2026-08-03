# 도구 설치 및 불러오기

# !pip install transformers torch torchvision --quiet

import torch                                    # 딥러닝 계산을 위한 기본 도구
import torch.nn as nn                            # 신경망(모델) 구조를 만들 때 쓰는 도구
from transformers import ViTModel, ViTImageProcessor  # 사전학습된 ViT 모델을 가져오는 도구
from PIL import Image                            # 이미지 파일을 다루는 도구
import base64, json                               # wardrobe.json 안의 이미지(base64)를 읽기 위한 도구
from io import BytesIO

# 사전 학습된 ViT 불러오기

model_name = "google/vit-base-patch16-224-in21k"        # 구글이 미리 학습시켜둔 ViT 모델 이름
processor = ViTImageProcessor.from_pretrained(model_name) # 사진을 ViT가 이해할 수 있는 형태로 바꿔주는 도구
vit_backbone = ViTModel.from_pretrained(model_name)       # ViT의 "눈" 역할 부분 (이미지를 이해하는 몸통)

# 태그 종류 정의 (카테고리/종류/색상)

# 각 속성마다, 어떤 답이 나올 수 있는지 목록을 미리 정해둠
# (실제 프로젝트 스키마 확정 전까지는 wardrobe.json에서 실제로 쓰인 값들 기준)
ATTRIBUTES = {
    "category":  ["상의", "하의", "아우터", "원피스"],
    "item_type": ["니트", "셔츠", "티셔츠", "청바지", "슬랙스", "원피스", "기타"],
    "color":     ["네이비", "블랙", "화이트", "베이지", "그레이", "아이보리", "기타"],
}

# 모델 구조 만들기 (눈 하나 + 판단하는 부분 3개)

class MultiTaskViTTagger(nn.Module):
    def __init__(self, backbone, attributes: dict):
        super().__init__()
        self.backbone = backbone                              # 이미지를 이해하는 공통 부분 ("눈")
        hidden = backbone.config.hidden_size                   # ViT가 이미지를 이해한 결과의 크기
        # 속성(category, item_type, color) 개수만큼, 판단하는 부분을 각각 따로 만듦 ("심사위원들")
        self.heads = nn.ModuleDict({
            attr: nn.Linear(hidden, len(classes))
            for attr, classes in attributes.items()
        })

    def forward(self, pixel_values):
        outputs = self.backbone(pixel_values=pixel_values)     # 사진을 넣어서 ViT가 이해한 결과를 얻음
        cls_token = outputs.last_hidden_state[:, 0, :]          # 그 결과 중, "사진 전체를 요약한 정보" 부분만 사용
        # 요약 정보를 각 심사위원(헤드)에게 넘겨서, 각자 판단 결과(점수)를 받음
        return {attr: head(cls_token) for attr, head in self.heads.items()}

tagger = MultiTaskViTTagger(vit_backbone, ATTRIBUTES)

# 우리 프로젝트 데이터 불러오기
# colab 왼쪽 파일 탐색기로 wardrobe.json을 업로드한 상태를 기준으로 함

with open("/content/wardrobe.json", "r", encoding="utf-8") as f:
    wardrobe_data = json.load(f)                # 우리 프로젝트에 등록된 옷 10개 데이터 불러오기

print(f"불러온 아이템 개수: {len(wardrobe_data)}")

# 데이터셋 만들기 (사진 + 정답 태그를 짝지어두는 상자)

from torch.utils.data import Dataset

class WardrobeDataset(Dataset):
    def __init__(self, data, attributes, processor):
        self.data = data
        self.attributes = attributes
        self.processor = processor

    def __len__(self):
        return len(self.data)                    # 데이터가 총 몇 개인지

    def __getitem__(self, idx):
        item = self.data[idx]

        # wardrobe.json 안의 이미지는 "data:image/jpeg;base64,..." 형태 → 실제 사진으로 복원
        b64_str = item["image"].split(",", 1)[1]
        img_bytes = base64.b64decode(b64_str)
        image = Image.open(BytesIO(img_bytes)).convert("RGB")

        # 사진을 ViT가 이해할 수 있는 숫자 형태로 변환
        inputs = self.processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].squeeze(0)

        # 정답 태그(category/type/color)를, 숫자(인덱스)로 바꿔둠
        labels = {}
        for attr, classes in self.attributes.items():
            json_key = "type" if attr == "item_type" else attr
            value = item.get(json_key, "기타")
            labels[attr] = classes.index(value) if value in classes else classes.index("기타")

        return pixel_values, labels

dataset = WardrobeDataset(wardrobe_data, ATTRIBUTES, processor)
print(f"데이터셋 크기: {len(dataset)}")

# 학습용/시험용 나누기 (겹치지 않게)

from torch.utils.data import random_split

# 10개 중 8개는 "공부용", 2개는 "시험용"으로 미리 나눔 (한 번 나누면 계속 고정되도록 시드 고정)
train_size = 8
test_size = len(dataset) - train_size
train_dataset, test_dataset = random_split(
    dataset, [train_size, test_size], generator=torch.Generator().manual_seed(42)
)

print(f"공부용: {len(train_dataset)}개, 시험용: {len(test_dataset)}개")

# 시험 보는 함수 (몇 개 맞혔는지 세는 함수)

def evaluate(model, eval_dataset, label=""):
    correct = {attr: 0 for attr in ATTRIBUTES}
    total = len(eval_dataset)
    model.eval()                                   # "지금은 시험 보는 중"이라고 모델에게 알려줌
    with torch.no_grad():                          # 시험 볼 때는 학습(계산 기록)이 필요 없으므로 끔
        for i in range(total):
            pixel_values, labels = eval_dataset[i]
            logits = model(pixel_values.unsqueeze(0))
            for attr, logit in logits.items():
                pred = logit.argmax(dim=-1).item()  # 각 속성별로 가장 점수 높은 답을 고름
                if pred == labels[attr]:
                    correct[attr] += 1
    print(f"=== {label} ===")
    for attr in ATTRIBUTES:
        print(f"{attr}: {correct[attr]}/{total} ({correct[attr]/total*100:.1f}%)")

evaluate(tagger, test_dataset, "학습 전 (시험용 2개 기준)")

# 가르치기 (학습, 공부용 8개만 사용)

from torch.utils.data import DataLoader

def collate_fn(batch):
    pixel_values = torch.stack([b[0] for b in batch])
    labels = {attr: torch.tensor([b[1][attr] for b in batch]) for attr in ATTRIBUTES}
    return pixel_values, labels

dataloader = DataLoader(train_dataset, batch_size=4, shuffle=True, collate_fn=collate_fn)

criterion = nn.CrossEntropyLoss()                             # 얼마나 틀렸는지 계산하는 방법
optimizer = torch.optim.Adam(tagger.heads.parameters(), lr=1e-3)  # 판단 부분(헤드)만 조금씩 고쳐나감

num_epochs = 20                                                # 8개짜리 데이터를 20번 반복해서 봄
tagger.train()                                                 # "지금은 공부 중"이라고 모델에게 알려줌
for epoch in range(num_epochs):
    total_loss = 0
    for pixel_values, labels in dataloader:
        optimizer.zero_grad()
        logits = tagger(pixel_values)
        loss = sum(criterion(logits[attr], labels[attr]) for attr in ATTRIBUTES)  # 3개 속성의 오차를 합침
        loss.backward()                                        # 어디를 고쳐야 할지 계산
        optimizer.step()                                       # 실제로 조금 고침
        total_loss += loss.item()
    if (epoch + 1) % 5 == 0:
        print(f"Epoch {epoch+1}/{num_epochs}, Loss: {total_loss:.4f}")   # 오차가 줄어드는지 확인용 출력

# 학습 후 다시 시험
evaluate(tagger, test_dataset, "학습 후 (시험용 2개 기준, 학습에 안 쓴 데이터)")