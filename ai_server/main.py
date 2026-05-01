from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# 요청 모델
# ─────────────────────────────────────────────
class WardrobeItemData(BaseModel):
    id: int
    category: Optional[str] = ""
    type: Optional[str] = ""
    color: Optional[str] = ""
    material: Optional[str] = ""
    imageB64: Optional[str] = ""
    embedding: Optional[str] = ""

class RecommendRequest(BaseModel):
    tpo: str
    mode: str = "rag"
    weather: dict
    profile: dict
    wardrobeItems: List[WardrobeItemData] = []
    linkedEvents: List[dict] = []

class AnalyzeImageRequest(BaseModel):
    imageB64: str

# ─────────────────────────────────────────────
# 헬스 체크
# ─────────────────────────────────────────────
@app.get("/")
def health_check():
    return {"status": "AI 서버 정상 실행 중"}

# ─────────────────────────────────────────────
# 옷 이미지 분석
# ─────────────────────────────────────────────
@app.post("/ai/analyze")
async def analyze_image(req: AnalyzeImageRequest):
    try:
        from services.gemini_service import analyze_clothing
        result = analyze_clothing(req.imageB64)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# 코디 추천
# ─────────────────────────────────────────────
@app.post("/ai/recommend")
async def recommend(req: RecommendRequest):
    try:
        from services.gemini_service import get_outfit_recommendation
        from services.clip_service import match_wardrobe

        outfit = get_outfit_recommendation(
            tpo=req.tpo,
            weather=req.weather,
            profile=req.profile,
            mode=req.mode,
            wardrobe_items=[item.dict() for item in req.wardrobeItems],
            linked_events=req.linkedEvents
        )

        matched_items = match_wardrobe(
            outfit=outfit,
            wardrobe_items=[item.dict() for item in req.wardrobeItems]
        )

        return {
            "outfit": outfit,
            "matched_items": matched_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))