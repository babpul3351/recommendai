"""
main.py 최종 수정본 (v2)

v1 대비 변경 사항
----------------
발견된 문제: WardrobeItemData.id가 int로 되어 있었으나,
실제 WardrobeItem.itemId는 String(UUID)입니다.
(이는 ChromaDB 작업과 무관하게 원래 있던 버그로 보입니다.)

→ id: int  →  id: str 로 수정
→ EmbedItemRequest.itemId, userId도 str로 수정
→ DELETE 엔드포인트의 item_id도 str로 수정
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
    id: str  # UUID 문자열 (기존 int에서 수정됨)
    category: Optional[str] = ""
    type: Optional[str] = ""
    color: Optional[str] = ""
    material: Optional[str] = ""
    imageB64: Optional[str] = ""   # 과거 방식 (현재 Spring Boot는 더 이상 보내지 않음)
    imageUrl: Optional[str] = ""   # 현재 Spring Boot가 실제로 보내는 필드 (S3 URL)
    embedding: Optional[str] = ""  # 더 이상 사용하지 않지만 기존 호환을 위해 유지

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
    itemId: str    # UUID 문자열
    userId: str    # UUID 문자열
    category: str
    color: Optional[str] = ""
    type: Optional[str] = ""
    imageB64: str  # data:image/jpeg;base64,... 형식

# ─────────────────────────────────────────────
# 헬스 체크
# ─────────────────────────────────────────────
@app.get("/")
def health_check():
    return {"status": "AI 서버 정상 실행 중"}

# ─────────────────────────────────────────────
# 옷 이미지 분석 (기존 그대로)
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
# 수정 사항: get_outfit_recommendation()이 코디 "여러 개"가 담긴 리스트를 반환하는데,
# 기존 코드는 단일 코디로 가정하고 있었습니다. (ChromaDB 작업과 무관한 기존 버그)
# Spring Boot(WardrobeController)가 기대하는 "outfits" / "matched_items_per_outfit"
# (둘 다 복수형) 키에 맞춰 응답 형식을 수정했습니다.
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

        # get_outfit_recommendation이 단일 dict를 반환하는 경우까지 대비
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
# [신규] 의류 임베딩 등록 (ChromaDB 영구 저장)
# Spring Boot가 옷장 아이템을 MySQL에 저장하고 ID를 발급받은 직후 호출
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
# [신규] 의류 임베딩 삭제
# Spring Boot가 옷장 아이템을 삭제할 때 함께 호출
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
# [신규] ChromaDB 상태 확인 (디버깅용)
# ─────────────────────────────────────────────
@app.get("/ai/wardrobe/embed/stats")
async def embedding_stats():
    from services import chroma_service
    return chroma_service.get_stats()