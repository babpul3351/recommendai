import numpy as np
import json

clip_model = None
clip_processor = None

def load_clip():  # 모델 로드 함수
    global clip_model, clip_processor
    # 이미 로드된 경우 다시 로드X
    if clip_model is not None:
        return
    import torch
    from transformers import CLIPModel, CLIPProcessor
    # 모델 로드
    clip_model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip")
    clip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
    clip_model.eval()
    print("[CLIP] 로드 완료")

def get_text_embedding(text):  # 텍스트 -> 벡터 변환
    import torch
    load_clip()
    # 문장 토큰화 -> 문장을 숫자 벡터로 변환
    inputs = clip_processor(
        text=[text], return_tensors="pt",
        padding=True, truncation=True, max_length=77
    )
    with torch.no_grad():
        out  = clip_model.text_model(  # Transformer 기반 텍스트 인코더 통과 -> 문장의 의미 추출
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        # => 텍스트 특징 벡터를 이미지 벡터 공간과 동일한 공간으로 변환
        proj = clip_model.text_projection(out.pooler_output)  # 텍스트 벡터 공간 = 이미지 벡터 공간 되도록 학습
        norm = proj.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        feat = (proj / norm).float().numpy()[0]  # 벡터 길이 1로 정규화(normalization) -> To 유사도 안정적 계산
                                                 # => cosine similarity 계산O
    return feat.tolist()

def match_wardrobe(outfit: dict, wardrobe_items: list) -> list:  # 추천 로직
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

        # RAG 방식: AI가 직접 id 선택한 경우
        if item_id is not None:
            found = next(
                (w for w in wardrobe_items if str(w.get("id", "")) == str(item_id)), None
            )
            if found:
                matched.append({
                    "id":       found["id"],
                    "category": found.get("category", ""),
                    "type":     found.get("type", ""),
                    "color":    found.get("color", ""),
                    "imageB64": found.get("imageB64", ""),
                    "imageUrl": found.get("imageUrl", ""),
                    "score":    1.0
                })
                continue

        # 추천 우선 방식: CLIP으로 유사도 검색
        query = slot.get("search_query") or f"{slot.get('color') or ''} {slot.get('type') or ''}".strip()
        if not query or not isinstance(query, str):
            query = f"{cat} fashion item"  # 검색 쿼리 생성
        candidates = [w for w in wardrobe_items if w.get("category") == cat]
        if not candidates:
            candidates = wardrobe_items
        if not candidates:
            continue

        query_vec = np.array(get_text_embedding(query), dtype="float32")  # 텍스트 임베딩 생성
        best_score, best_item = -1, None

        for w in candidates:
            emb_str = w.get("embedding", "")
            if not emb_str:
                continue
            emb = np.array(json.loads(emb_str), dtype="float32")
            score = float(np.dot(query_vec, emb))  # DB 임베딩과 비교 -> dot product 계산
                                                   # 이미 정규화 완료했으므로 dot product = cosine similarity
            if score > best_score:
                best_score, best_item = score, w

        if best_item is None and candidates:
                    best_item = candidates[0]
                    best_score = 0.5

        if best_item:
            matched.append({  # 결과 반환 => AI 추천 설명과 가장 유사한 실제 사용자 옷 반환
                "id":       best_item["id"],
                "category": best_item.get("category", ""),
                "type":     best_item.get("type", ""),
                "color":    best_item.get("color", ""),
                "imageB64": best_item.get("imageB64", ""),
                "imageUrl": best_item.get("imageUrl", ""),
                "score":    round(best_score, 3)
            })

    return matched