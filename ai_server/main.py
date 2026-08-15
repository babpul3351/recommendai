"""
main.py 전체 최종본

이전 버전(ChromaDB 통합 v2) 대비 변경 사항
----------------------------------------
/ai/daltonize 엔드포인트를 추가했습니다. (DaltonizeRequest 모델 포함)
daltonization_service.py의 simulate_color_blindness()를 호출합니다.

그 외 엔드포인트(/ai/analyze, /ai/recommend, /ai/wardrobe/embed 등)는
이전 버전과 동일합니다. 변경 없습니다.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image
from io import BytesIO
import base64

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
    id: str
    category: Optional[str] = ""
    type: Optional[str] = ""
    color: Optional[str] = ""
    material: Optional[str] = ""
    imageB64: Optional[str] = ""
    imageUrl: Optional[str] = ""
    embedding: Optional[str] = ""
    styleTags: Optional[str] = ""

class RecommendRequest(BaseModel):
    tpo: str
    mode: str = "rag"
    weather: dict
    profile: dict
    wardrobeItems: List[WardrobeItemData] = []
    linkedEvents: List[dict] = []

class AnalyzeImageRequest(BaseModel):
    imageB64: str

class EmbedItemRequest(BaseModel):
    itemId: str
    userId: str
    category: str
    color: Optional[str] = ""
    type: Optional[str] = ""
    imageB64: str

# [신규] 색각 보정 요청 모델
class DaltonizeRequest(BaseModel):
    imageB64: str
    colorType: str

# [신규] 캘린더 TPO 자동 분류 요청 모델
class ClassifyTpoRequest(BaseModel):
    eventName: str

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

        outfits = get_outfit_recommendation(
            tpo=req.tpo,
            weather=req.weather,
            profile=req.profile,
            mode=req.mode,
            wardrobe_items=[item.dict() for item in req.wardrobeItems],
            linked_events=req.linkedEvents
        )

        if isinstance(outfits, dict):
            outfits = [outfits]

        wardrobe_items_list = [item.dict() for item in req.wardrobeItems]

        matched_items_per_outfit = []
        for outfit in outfits:
            matched = match_wardrobe(
                outfit=outfit,
                wardrobe_items=wardrobe_items_list
            )
            matched_items_per_outfit.append(matched)

        return {
            "outfits": outfits,
            "matched_items_per_outfit": matched_items_per_outfit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# 의류 임베딩 등록 (ChromaDB 영구 저장)
# ─────────────────────────────────────────────
@app.post("/ai/wardrobe/embed")
async def register_embedding(req: EmbedItemRequest):
    try:
        from services.clip_service import get_image_embedding
        from services import chroma_service

        _, b64 = req.imageB64.split(",", 1)
        pil_img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")

        embedding = get_image_embedding(pil_img)

        chroma_service.upsert_item_embedding(
            item_id=req.itemId,
            embedding=embedding,
            metadata={
                "user_id":  req.userId,
                "category": req.category,
                "color":    req.color or "",
                "type":     req.type or "",
            }
        )

        return {"status": "success", "itemId": req.itemId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# 의류 임베딩 삭제
# ─────────────────────────────────────────────
@app.delete("/ai/wardrobe/embed/{item_id}")
async def delete_embedding(item_id: str):
    try:
        from services import chroma_service
        chroma_service.delete_item_embedding(item_id)
        return {"status": "deleted", "itemId": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# ChromaDB 상태 확인 (디버깅용)
# ─────────────────────────────────────────────
@app.get("/ai/wardrobe/embed/stats")
async def embedding_stats():
    from services import chroma_service
    return chroma_service.get_stats()

# ─────────────────────────────────────────────
# [신규] 색각 보정 (Daltonization)
# Spring Boot(UserController.daltonize)가 이 엔드포인트를 호출합니다.
# ─────────────────────────────────────────────
@app.post("/ai/daltonize")
async def daltonize(req: DaltonizeRequest):
    try:
        from services.daltonization_service import simulate_color_blindness
        corrected = simulate_color_blindness(req.imageB64, req.colorType)
        return {"corrected": corrected}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# [신규] 캘린더 일정 → TPO 자동 분류
# Spring Boot(CalendarController.suggestTpo)가 이 엔드포인트를 호출합니다.
# ─────────────────────────────────────────────
@app.post("/ai/classify-tpo")
async def classify_tpo_endpoint(req: ClassifyTpoRequest):
    from services.gemini_service import classify_tpo
    return classify_tpo(req.eventName)