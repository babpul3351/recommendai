import pandas as pd
import lightgbm as lgb
import joblib

# CSV 읽기
df = pd.read_csv("../../dataset/idle_training_sample.csv")

# 입력 데이터
X = df[[
    "days_since_last_worn",
    "wear_count",
    "season_match"
]]

# 정답
y = df["idle_score"]

# 모델 생성
model = lgb.LGBMRegressor(
    n_estimators=100,
    learning_rate=0.1,
    random_state=42
)

# 학습
model.fit(X, y)

# 저장
joblib.dump(model, "../saved/lightgbm.pkl")

print("LightGBM 학습 완료!")
print("모델 저장 완료!")