import joblib
import pandas as pd

# 저장된 모델 불러오기
model = joblib.load("../saved/lightgbm.pkl")

# 테스트 데이터
data = pd.DataFrame({
    "days_since_last_worn": [30],
    "wear_count": [5],
    "season_match": [1]
})

# 예측
score = model.predict(data)

print("추천 점수 :", score[0])