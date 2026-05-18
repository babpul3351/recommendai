from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from services.daltonization_service import simulate_color_blindness, simulate_only

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
    id: Optional[str] = None        # UUID(VARCHAR 36)로 변경
    category: Optional[str] = ""
    type: Optional[str] = ""
    color: Optional[str] = ""
    material: Optional[str] = ""
    imageB64: Optional[str] = ""
    embedding: Optional[str] = ""   # 없을 수 있음

class RecommendRequest(BaseModel):
    tpo: str
    mode: str = "rag"
    weather: dict
    profile: dict          # styles가 List로 변경됨
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


class DaltonizationRequest(BaseModel):
    imageB64: str
    colorType: str  # protanopia / deuteranopia / tritanopia

@app.post("/ai/daltonize")
async def daltonize(req: DaltonizationRequest):
    """색약 보정 이미지 반환"""
    corrected = simulate_color_blindness(req.imageB64, req.colorType)
    simulated = simulate_only(req.imageB64, req.colorType)
    return {
        "original": req.imageB64,
        "simulated": simulated,   # 색각 이상자 시뮬레이션 (보정 전)
        "corrected": corrected    # Daltonization 보정 후
    }