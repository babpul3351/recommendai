from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64, json

API_KEY = "AIzaSyA3jU5M4Z6H73ZH5nhzd0Mhr4gn0eeOWjA"

gemini_client = None

def get_gemini():
    global gemini_client
    if gemini_client is None:
        gemini_client = genai.Client(api_key=API_KEY)
    return gemini_client

def gemini_text(prompt):
    client = get_gemini()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text.strip()

def gemini_vision(pil_img, prompt_text):
    client = get_gemini()
    buf = BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
            prompt_text
        ]
    )
    return response.text.strip()

# ─────────────────────────────────────────────
# 옷 이미지 분석
# ─────────────────────────────────────────────
def analyze_clothing(image_b64: str) -> dict:
    _, b64 = image_b64.split(",", 1)
    pil_img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")

    thumb = pil_img.copy()
    thumb.thumbnail((512, 512))

    raw = gemini_vision(
        thumb,
        '이 옷을 분석하여 순수 JSON만 출력하세요. 마크다운 없이.\n'
        '{"category":"상의/하의/아우터/원피스 중 하나","type":"아이템명","color":"색상","material":"소재"}'
    )
    clean = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(clean)

    # 썸네일 base64 저장
    buf = BytesIO()
    thumb.save(buf, format="JPEG", quality=75)
    result["imageB64"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    return result

# ─────────────────────────────────────────────
# 기온 구간 판별
# ─────────────────────────────────────────────
TEMP_ZONE_MAP = {
    "hot":    ["상의", "하의", "원피스"],
    "warm":   ["상의", "하의", "원피스"],
    "mild":   ["상의", "하의", "원피스", "아우터"],
    "cool":   ["상의", "하의", "아우터"],
    "cold":   ["상의", "하의", "아우터"],
    "freeze": ["상의", "하의", "아우터"],
}

def get_temp_zone(temp: int) -> str:
    if temp >= 28: return "hot"
    if temp >= 23: return "warm"
    if temp >= 17: return "mild"
    if temp >= 12: return "cool"
    if temp >= 5:  return "cold"
    return "freeze"

# ─────────────────────────────────────────────
# 코디 추천
# ─────────────────────────────────────────────
def get_outfit_recommendation(tpo, weather, profile, mode="rag", wardrobe_items=None, linked_events=None):
    if wardrobe_items is None:
        wardrobe_items = []
    if linked_events is None:
        linked_events = []

    temp = weather.get("temp", 18) if weather else 18
    desc = weather.get("desc", "맑음") if weather else "맑음"
    age_group = profile.get("ageGroup", "20대") if profile else "20대"
    gender = profile.get("gender", "여성") if profile else "여성"
    styles = profile.get("styles", []) if profile else []
    style_str = ", ".join(styles) if styles else "캐주얼"
    temp_zone = get_temp_zone(temp)

    # 일정 정보 텍스트 구성
    event_text = ""
    if linked_events:
        event_text = "\n[오늘의 일정]\n"
        for ev in linked_events:
            event_text += f"- {ev.get('eventName', '')} ({ev.get('tpoKeyword', '')})\n"

    if mode == "rag" and wardrobe_items:
        # RAG 방식: 옷장 후보 필터링
        allowed = TEMP_ZONE_MAP.get(temp_zone, [])
        candidates = [
            w for w in wardrobe_items
            if any(a in str(w.get("category", "")) or a in str(w.get("type", ""))
                   for a in allowed)
        ]
        if not candidates:
            candidates = wardrobe_items

        candidates_text = "\n".join([
            f"- id:{w.get('id','없음')} | {w.get('category','')} | {w.get('type','')} | {w.get('color','')} | {w.get('material','')}"
            for w in candidates[:20]
        ])

        prompt = f"""당신은 전문 패션 스타일리스트입니다.
아래 정보를 바탕으로 최적의 코디를 추천해주세요.

[사용자 정보]
- 연령대: {age_group}
- 성별: {gender}
- 선호 스타일: {style_str}

[날씨 정보]
- 기온: {temp}°C ({temp_zone})
- 날씨: {desc}

[TPO]
- {tpo}
{event_text}
[보유 옷장 후보]
{candidates_text}

위 옷장에서 id가 있는 아이템을 최대한 활용하여 코디를 구성하세요.
옷장에 없는 아이템은 id를 null로 설정하세요.

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "top": {{"id": "uuid또는null", "color": "색상", "type": "종류", "search_query": "영문검색어"}},
  "bottom": {{"id": "uuid또는null", "color": "색상", "type": "종류", "search_query": "영문검색어"}},
  "outer": null또는{{"id": "uuid또는null", "color": "색상", "type": "종류", "search_query": "영문검색어"}},
  "style": "스타일태그",
  "description": "한국어로 코디 설명 2-3문장"
}}"""

    else:
        # AI 독립 방식
        prompt = f"""당신은 전문 패션 스타일리스트입니다.

[사용자 정보]
- 연령대: {age_group}
- 성별: {gender}
- 선호 스타일: {style_str}

[날씨 정보]
- 기온: {temp}°C ({temp_zone})
- 날씨: {desc}

[TPO]
- {tpo}
{event_text}
아래 JSON 형식으로만 응답하세요:
{{
  "top": {{"id": null, "color": "색상", "type": "종류", "search_query": "영문검색어"}},
  "bottom": {{"id": null, "color": "색상", "type": "종류", "search_query": "영문검색어"}},
  "outer": null,
  "style": "스타일태그",
  "description": "한국어로 코디 설명 2-3문장"
}}"""

    try:
        raw = gemini_text(prompt)
        clean = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception as e:
        print(f"Gemini 파싱 오류: {e}")
        return {
            "top": {"id": None, "color": "화이트", "type": "티셔츠", "search_query": "white t-shirt"},
            "bottom": {"id": None, "color": "블랙", "type": "팬츠", "search_query": "black pants"},
            "outer": None,
            "style": "casual",
            "description": "기본 캐주얼 코디입니다."
        }