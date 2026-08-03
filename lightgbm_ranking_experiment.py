# LightGBM 도구를 설치 + 불러오기
# ViT 부분에서 transformers, torch 설치했던 것과 같은 역할

# !pip install lightgbm --quiet

import lightgbm as lgb
import numpy as np
import pandas as pd

# 가상 데이터 생성
# 아직 진짜 기록 X -> 숫자를 무작위로 200개 만들어서 가짜 아이템 200개를 만든 것
# selected라는 칸에 "이 조건이면 사용자가 골랐을 것이다/아니다"를 가정해서 채워넣음(연습용 더미 데이터)


# 실제로는 이 피처들이: 유사도 점수, 색상 매칭도, 계절 적합도, 사용자 과거 선호도, 인기도 등에서 옴
# 지금은 구조 검증용이므로 랜덤하게 생성 (나중에 실제 피처로 교체)

np.random.seed(42) # 매번 같은 무작위 숫자가 나오도록 고정(재현 가능하게)
n_samples = 200 # 가짜 아이템 200개 만들기

data = pd.DataFrame({
    "similarity_score":   np.random.uniform(0, 1, n_samples),   # CLIP 유사도 점수 (0~1 사이 무작위)
    "color_match":        np.random.uniform(0, 1, n_samples),   # 색상 매칭도 (0~1 사이 무작위)
    "season_fit":         np.random.uniform(0, 1, n_samples),   # 계절 적합도 (0~1 사이 무작위)
    "user_pref_match":    np.random.uniform(0, 1, n_samples),   # 사용자 선호 스타일 일치도 (0~1 사이 무작위)
    "popularity":         np.random.uniform(0, 1, n_samples),   # 아이템 인기도 (0~1 사이 무작위) - 정답 계산에서는 사용 X
})

# 정답(사용자가 실제로 이 추천을 선택했는지 여부) — 지금은 가상으로 생성
# 실제로는: 유사도/색상/계절 적합도가 높을수록 선택될 확률이 높다고 가정해서 만든 가짜 라벨

score = ( # 정답 점수 공식을 임의로 만듦
    data["similarity_score"] * 0.4 +
    data["color_match"] * 0.3 +
    data["season_fit"] * 0.2 +
    data["user_pref_match"] * 0.1
)
# 0.5 넘으면 "선택됨(1)", 아니면 "선택안됨(0)"
data["selected"] = (score + np.random.normal(0, 0.1, n_samples) > 0.5).astype(int)


print(data.head())
print(f"\n선택됨(1) 비율: {data['selected'].mean():.2f}")

# 학습/평가 데이터 분리
# 200개 중 160개는 공부용(학습), 40개는 시험용(평가)으로 나눔
# ViT에서 10개를 학습에도 쓰고 시험에도 똑같이 써서 100% 나왔던 구간 -> 해당 실수를 안 하려고 학습에 쓴 데이터와 시험에 쓴 데이터를 아예 다르게 나눈 것


from sklearn.model_selection import train_test_split

feature_cols = ["similarity_score", "color_match", "season_fit", "user_pref_match", "popularity"]
X = data[feature_cols]
y = data["selected"]

# 200개 중 20%(40개)는 시험용으로 따로 빼놓고, 나머지 160개만 공부용(학습)으로 사용
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"학습 데이터: {len(X_train)}개, 평가 데이터: {len(X_test)}개")

# LightGBM 모델 학습
# 160개의 공부용(학습) 데이터를 LightGBM에게 보여주면서
# "이런 조건일 때 골랐다/안 골랐다"는 규칙을 찾아내게 시키는 부분

train_data = lgb.Dataset(X_train, label=y_train)
val_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

params = {
    "objective": "binary",       # "이 아이템을 선택할 것인가/아닌가" 이진 분류로 시작
    "metric": "binary_logloss",
    "verbosity": -1,
}

# 160개를 보면서 규칙을 찾아가되, 10번 연속 시험 성적이 안 좋아지면 자동으로 멈춤(과적합 방지 장치)
model = lgb.train(
    params,
    train_data,
    num_boost_round=50,
    valid_sets=[val_data],
    callbacks=[lgb.early_stopping(stopping_rounds=10), lgb.log_evaluation(period=10)],
)

# 예측 및 순위 매기기
# 학습에 안 쓴 40개의 시험용(판단) 데이터를 가지고
# LightGBM이 각각 몇 점을 주는지 확인하고, 점수 높은 순으로 정렬

X_test_copy = X_test.copy()
X_test_copy["predicted_score"] = model.predict(X_test)
X_test_copy["actual"] = y_test.values

ranked = X_test_copy.sort_values("predicted_score", ascending=False)
print(ranked.head(10))

# 피처 중요도 확인 (어떤 정보가 순위에 가장 큰 영향을 주는지)
# 유사도/색상/계절/선호도/인기도 중에서, LightGBM이 점수를 매길 때 어떤 걸
# 가장 중요하게 봤는지 확인하는 부분

importance = pd.DataFrame({
    "feature": feature_cols,
    "importance": model.feature_importance(),
}).sort_values("importance", ascending=False)

print(importance)

