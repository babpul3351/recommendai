"""
clip_service.py — RAG 전환 버전

변경 사항 (직전 버전 대비)
------------------------
match_wardrobe()의 동작이 바뀌었습니다.

이전: Gemini가 종종 id를 직접 지정 → 그 경우 ChromaDB 검색을 건너뛰고 바로 매칭
      (id가 항상 null로 오도록 gemini_service.py가 바뀌었으므로, 이 경로는
      이제 사실상 실행되지 않습니다. 혹시 모를 경우를 대비해 코드는 남겨뒀습니다.)

이후: 항상 ChromaDB 검색을 실행합니다. 검색 결과가 없거나(그 카테고리에 등록된
      옷이 없음), 있어도 후보 목록(wardrobe_items)에 없는 경우에는 "선택지 B"로
      처리합니다 — 실제 사진 없이 Gemini가 생성한 텍스트 설명만 표시합니다.
      이 경우 응답에 "matched": false가 포함되어, 프론트엔드가 실물 여부를
      구분해서 표시할 수 있습니다.
"""

import numpy as np
import json
from services import chroma_service

clip_model = None
clip_processor = None


def load_clip():
    global clip_model, clip_processor
    if clip_model is not None:
        return
    import torch
    from transformers import CLIPModel, CLIPProcessor
    clip_model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip")
    clip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
    clip_model.eval()
    print("[CLIP] 로드 완료")


def get_text_embedding(text):
    import torch
    load_clip()
    inputs = clip_processor(
        text=[text], return_tensors="pt",
        padding=True, truncation=True, max_length=77
    )
    with torch.no_grad():
        out  = clip_model.text_model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        proj = clip_model.text_projection(out.pooler_output)
        norm = proj.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        feat = (proj / norm).float().numpy()[0]
    return feat.tolist()


def get_image_embedding(pil_img):
    """
    의류 이미지의 CLIP 임베딩(512차원)을 생성합니다.
    의류 등록 시 이 임베딩을 ChromaDB에 저장해서 이후 검색에 사용합니다.

    주의: get_text_embedding과 동일한 저수준 방식(vision_model + visual_projection)을
         사용합니다. transformers 5.x에서 get_image_features()가 벡터를 바로
         반환하지 않는 문제가 있어, get_text_embedding과 동일한 패턴으로 통일했습니다.
    """
    import torch
    load_clip()
    inputs = clip_processor(images=pil_img, return_tensors="pt")
    with torch.no_grad():
        out  = clip_model.vision_model(pixel_values=inputs["pixel_values"])
        proj = clip_model.visual_projection(out.pooler_output)
        norm = proj.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        feat = (proj / norm).float().numpy()[0]
    return feat.tolist()


def _empty_slot_result(cat: str, slot: dict) -> dict:
    """
    선택지 B — 실제 매칭되는 옷이 없을 때, Gemini가 생성한 설명만 담아 반환합니다.
    실제 사진이 없으므로 imageUrl/imageB64는 빈 문자열, matched는 False입니다.
    """
    return {
        "id":       None,
        "category": cat,
        "type":     slot.get("type", ""),
        "color":    slot.get("color", ""),
        "imageB64": "",
        "imageUrl": "",
        "score":    0,
        "matched":  False,
    }


def match_wardrobe(outfit: dict, wardrobe_items: list) -> list:
    matched = []
    cat_map = {
        "top":    "상의",
        "bottom": "하의",
        "outer":  "아우터",
    }

    for key, cat in cat_map.items():
        slot = outfit.get(key)
        if not slot:
            continue

        item_id = slot.get("id")

        # ── (레거시 경로) Gemini가 예외적으로 id를 직접 지정한 경우 ──
        # gemini_service.py가 항상 id: null을 생성하도록 바뀌었으므로
        # 이 분기는 사실상 실행되지 않지만, 안전을 위해 남겨둡니다.
        if item_id is not None:
            found = next(
                (w for w in wardrobe_items if w["id"] == item_id), None
            )
            if found:
                matched.append({
                    "id":       found["id"],
                    "category": found["category"],
                    "type":     found["type"],
                    "color":    found["color"],
                    "imageB64": found.get("imageB64", ""),
                    "imageUrl": found.get("imageUrl", ""),
                    "score":    1.0,
                    "matched":  True,
                })
                continue

        # ── ChromaDB 검색 (항상 실행되는 메인 경로) ──
        query = slot.get("search_query") or f"{slot.get('color', '')} {slot.get('type', '')}".strip()
        if not query:
            query = f"{cat} fashion item"

        candidates = [w for w in wardrobe_items if w.get("category") == cat]
        if not candidates:
            # 해당 카테고리에 등록된 옷이 아예 없음 → 선택지 B
            matched.append(_empty_slot_result(cat, slot))
            continue

        allowed_ids = {str(w["id"]) for w in candidates}

        query_vec = get_text_embedding(query)
        results = chroma_service.query_similar(query_vec, category=cat, n_results=20)

        print(f"=== ChromaDB 검색 실행됨 (category={cat}, query='{query}') ===")
        print(f"=== ChromaDB 검색 결과 {len(results)}건 ===")

        best_match = None
        for result_id, distance, meta in results:
            if result_id in allowed_ids:
                best_match = (result_id, distance)
                break

        if best_match is None:
            # ChromaDB 검색 결과 중 후보(wardrobe_items)와 일치하는 게 없음 → 선택지 B
            matched.append(_empty_slot_result(cat, slot))
            continue

        result_id, distance = best_match
        found = next((w for w in wardrobe_items if str(w["id"]) == result_id), None)
        if found:
            similarity = 1 - distance  # 코사인 거리 → 유사도 변환
            matched.append({
                "id":       found["id"],
                "category": found["category"],
                "type":     found["type"],
                "color":    found["color"],
                "imageB64": found.get("imageB64", ""),
                "imageUrl": found.get("imageUrl", ""),
                "score":    round(similarity, 3),
                "matched":  True,
            })
        else:
            # 이론상 도달하지 않지만, 안전을 위한 폴백
            matched.append(_empty_slot_result(cat, slot))

    return matched