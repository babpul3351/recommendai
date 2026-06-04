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

class WardrobeItemData(BaseModel):
    id: int
    category: Optional[str] = ""
    type: Optional[str] = ""
    color: Optional[str] = ""
    material: Optional[str] = ""
    imageB64: Optional[str] = ""
    imageUrl: Optional[str] = ""   # ← 추가
    embedding: Optional[str] = ""

class RecommendRequest(BaseModel):
    tpo: str
    mode: str = "rag"
    weather: dict
    profile: dict
    wardrobeItems: List[WardrobeItemData] = []
    linkedEvents: List[dict] = []
    numOutfits: int = 2            # ← 추가

class AnalyzeImageRequest(BaseModel):
    imageB64: str

class DaltonizeRequest(BaseModel):
    imageB64: str
    colorType: str

@app.get("/")
def health_check():
    return {"status": "AI 서버 정상 실행 중"}

@app.post("/ai/analyze")
async def analyze_image(req: AnalyzeImageRequest):
    try:
        from services.gemini_service import analyze_clothing
        return analyze_clothing(req.imageB64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/recommend")
async def recommend(req: RecommendRequest):
    try:
        from services.gemini_service import get_outfit_recommendation
        from services.clip_service import match_wardrobe

        wardrobe_list = [item.dict() for item in req.wardrobeItems]
        num_outfits = max(2, min(3, req.numOutfits))

        outfits = get_outfit_recommendation(
            tpo=req.tpo, weather=req.weather, profile=req.profile,
            mode=req.mode, wardrobe_items=wardrobe_list,
            linked_events=req.linkedEvents, num_outfits=num_outfits
        )

        matched_items_per_outfit = [
            match_wardrobe(outfit=outfit, wardrobe_items=wardrobe_list)
            for outfit in outfits
        ]

        return {
            "outfits": outfits,
            "matched_items_per_outfit": matched_items_per_outfit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/daltonize")
async def daltonize(req: DaltonizeRequest):
    try:
        from services.daltonization_service import simulate_color_blindness, simulate_only
        return {
            "original": req.imageB64,
            "simulated": simulate_only(req.imageB64, req.colorType),
            "corrected": simulate_color_blindness(req.imageB64, req.colorType)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))