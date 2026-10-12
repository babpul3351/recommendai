"""
resale_service.py — 중고거래 판매글 초안 생성

원칙
----
- 알 수 없는 정보(브랜드, 사이즈, 사용감, 가격, 구매 시기)는 절대 지어내지 않도록 지정.
  사용자가 값을 주지 않으면 [브랜드] 같은 빈칸으로 유지.
- 이 서버가 아는 정보는 category / type / color / material 뿐.
- Gemini 호출이 실패하거나 JSON 파싱이 안 되면 고정 템플릿으로 대체.
  (AI 없이도 항상 초안이 나오도록)
"""

import json
import re

PLACEHOLDERS = {
    "brand": "[브랜드]",
    "size": "[사이즈]",
    "condition": "[사용감]",
    "price": "[희망가격]",
}


def _clean(v, limit=40):
    if v is None:
        return ""
    return str(v).replace("\n", " ").replace("`", "").strip()[:limit]


def _fill(item: dict, extra: dict):
    extra = extra or {}
    return {
        "category": _clean(item.get("category")),
        "type": _clean(item.get("type"), 50),
        "color": _clean(item.get("color")),
        "material": _clean(item.get("material")),
        "brand": _clean(extra.get("brand")) or PLACEHOLDERS["brand"],
        "size": _clean(extra.get("size")) or PLACEHOLDERS["size"],
        "condition": _clean(extra.get("condition"), 80) or PLACEHOLDERS["condition"],
        "price": _clean(extra.get("price")) or PLACEHOLDERS["price"],
    }


def build_template_draft(item: dict, extra: dict = None) -> dict:
    """AI 없이 만드는 기본 초안."""
    f = _fill(item, extra)
    name = " ".join(x for x in [f["color"], f["type"]] if x) or "의류"
    title = f"{name} 판매합니다"
    lines = [
        f"{name} 판매합니다.",
        "",
        f"- 카테고리: {f['category'] or '[카테고리]'}",
        f"- 브랜드: {f['brand']}",
        f"- 사이즈: {f['size']}",
        f"- 색상: {f['color'] or '[색상]'}",
        f"- 소재: {f['material'] or '[소재]'}",
        f"- 사용감: {f['condition']}",
        f"- 희망가격: {f['price']}",
        "",
        "직거래/택배 여부와 거래 지역은 [거래 방식]에 따라 안내드립니다.",
    ]
    return {"title": title, "body": "\n".join(lines), "source": "template"}


def _parse_json(text: str):
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if isinstance(obj, dict) and obj.get("title") and obj.get("body"):
        return obj
    return None


def generate_resale_draft(item: dict, extra: dict = None, text_fn=None) -> dict:
    """
    Parameters
    ----------
    item : dict  (category, type, color, material)
    extra : dict (선택. brand, size, condition, price — 사용자가 입력한 값만)
    text_fn : 테스트용 주입 함수. 기본은 gemini_service.gemini_text
    """
    f = _fill(item, extra)
    fallback = build_template_draft(item, extra)

    try:
        if text_fn is None:
            from services.gemini_service import gemini_text
            text_fn = gemini_text

        prompt = f"""당신은 중고거래 앱에 올릴 판매글 초안을 쓰는 도우미입니다.
아래 [상품 정보]에 적힌 사실만 사용해서 제목과 본문을 한국어로 작성하세요.

[규칙]
- 상품 정보에 없는 사실(브랜드, 사이즈, 사용감, 구매 시기, 가격, 하자 여부 등)을 절대 지어내지 마세요.
- 값이 대괄호로 둘러싸인 항목(예: [브랜드], [사이즈])은 그대로 대괄호를 유지해서 본문에 넣으세요.
- 과장 표현(새것 같은, 거의 안 입은 등)은 상품 정보에 근거가 없으면 쓰지 마세요.
- 제목은 40자 이내, 본문은 8줄 이내로 쓰세요.
- 반드시 아래 JSON만 출력하세요. 다른 설명은 쓰지 마세요.
{{"title": "...", "body": "..."}}

[상품 정보]
카테고리: {f['category']}
종류: {f['type']}
색상: {f['color']}
소재: {f['material'] or '[소재]'}
브랜드: {f['brand']}
사이즈: {f['size']}
사용감: {f['condition']}
희망가격: {f['price']}
"""
        parsed = _parse_json(text_fn(prompt))
        if parsed:
            return {"title": str(parsed["title"])[:100], "body": str(parsed["body"])[:2000], "source": "gemini"}
    except Exception:
        pass
    return fallback