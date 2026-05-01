import numpy as np
import json

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

        # RAG 방식: AI가 직접 id 선택한 경우
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
                    "score":    1.0
                })
                continue

        # 추천 우선 방식: CLIP으로 유사도 검색
        query = slot.get("search_query", f"{slot['color']} {slot['type']}")
        candidates = [w for w in wardrobe_items if w.get("category") == cat]
        if not candidates:
            candidates = wardrobe_items
        if not candidates:
            continue

        query_vec = np.array(get_text_embedding(query), dtype="float32")
        best_score, best_item = -1, None

        for w in candidates:
            emb_str = w.get("embedding", "")
            if not emb_str:
                continue
            emb = np.array(json.loads(emb_str), dtype="float32")
            score = float(np.dot(query_vec, emb))
            if score > best_score:
                best_score, best_item = score, w

        if best_item:
            matched.append({
                "id":       best_item["id"],
                "category": best_item["category"],
                "type":     best_item["type"],
                "color":    best_item["color"],
                "imageB64": best_item.get("imageB64", ""),
                "score":    round(best_score, 3)
            })

    return matched