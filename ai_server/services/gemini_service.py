"""
gemini_service.py — RAG 전환 버전

변경 사항
--------
get_outfit_recommendation()의 동작 방식이 바뀌었습니다.

이전: 옷장 전체 목록을 프롬프트에 텍스트로 나열 → Gemini가 그 목록에서 직접 id를 선택
      (검색 없이 Gemini가 바로 골라주는 방식 — "RAG"라는 이름이었지만 실제 검색 단계가 없었음)

이후: Gemini에게 옷장 목록을 보여주지 않고, "이런 느낌의 아이템이 필요하다"는
      설명 텍스트(search_query)만 생성하게 함 → 이 텍스트로 ChromaDB에서
      카테고리별 실제 유사 아이템을 검색 (진짜 Retrieval → Generation 순서)

이 파일에서 바뀐 함수는 get_outfit_recommendation() 하나뿐입니다.
analyze_clothing, gemini_text, gemini_vision, 온도 구간 판별 등은 그대로입니다.
"""

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64, json
import time

API_KEY = "AQ.Ab8RN6Ij76g6eJBbwOfVLnRXK-FxpQoi2IM3Kn7vDSgBvy4UTw"

gemini_client = None

def get_gemini():
    global gemini_client
    if gemini_client is None:
        gemini_client = genai.Client(api_key=API_KEY)
    return gemini_client


def gemini_text(prompt, max_retries=3):
    client = get_gemini()
    last_err = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            last_err = e
            if '503' in str(e) or 'UNAVAILABLE' in str(e):
                if attempt < max_retries - 1:
                    wait = (attempt + 1) * 3   # 3초, 6초 순서로 대기
                    print(f"[Gemini] 503 재시도 {attempt+1}/{max_retries} ({wait}초 대기)")
                    time.sleep(wait)
                    continue
            raise e
    raise last_err


def gemini_vision(pil_img, prompt_text, max_retries=3):
    client = get_gemini()
    buf = BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()
    last_err = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                    prompt_text
                ]
            )
            return response.text.strip()
        except Exception as e:
            last_err = e
            if '503' in str(e) or 'UNAVAILABLE' in str(e):
                if attempt < max_retries - 1:
                    wait = (attempt + 1) * 3
                    print(f"[Gemini] 503 재시도 {attempt+1}/{max_retries} ({wait}초 대기)")
                    time.sleep(wait)
                    continue
            raise e
    raise last_err

# ─────────────────────────────────────────────
# 옷 이미지 분석 (변경 없음)
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
# 기온 구간 판별 (변경 없음)
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
# 코디 추천 — RAG 전환 버전
#
# wardrobe_items 파라미터는 시그니처 호환을 위해 그대로 받지만,
# 프롬프트 구성에는 더 이상 사용하지 않습니다. (Gemini는 이제
# 실제 옷장을 보지 않고, "어떤 느낌의 아이템이 필요한지"만 생성합니다.
# 실제 아이템 검색은 clip_service.match_wardrobe()가 ChromaDB로 수행합니다.)
# ─────────────────────────────────────────────
def get_outfit_recommendation(tpo, weather, profile, mode, wardrobe_items, linked_events, num_outfits=2):
    temp = weather.get("temp", 18)
    zone = get_temp_zone(temp)
    needs_outer = zone in ["mild", "cool", "cold", "freeze"]

    styles = profile.get("styles", [])
    style_str = ", ".join(styles) if isinstance(styles, list) and styles else "캐주얼"

    event_context = ""
    if linked_events:
        titles = [e.get("title", e.get("eventName", "")) for e in linked_events]
        event_context = f"\n연동된 일정: {', '.join(titles)}"

    num_outfits = max(2, min(3, num_outfits))

    # id는 항상 null — Gemini는 실제 옷장 목록을 보지 않으므로
    # 실제 아이템 id를 알 수 없습니다. 매칭은 이후 ChromaDB 검색으로 처리됩니다.
    slot_fmt = '{{"id":null,"color":"색상","type":"아이템명","search_query":"English query"}}'

    prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('ageGroup','20대')} / 성별: {profile.get('gender','여성')}
- TPO: {tpo} / 날씨: {temp}도, {weather.get('desc','맑음')}
- 선호 스타일: {style_str}
{event_context}

=== 지시 ===
TPO·날씨·스타일에 맞는 서로 다른 {num_outfits}가지 코디를 구성하세요.
각 코디는 스타일/조합이 서로 달라야 합니다.
각 슬롯(top, bottom, outer)의 search_query에는 이상적인 아이템의 특징을
영어로 구체적으로 묘사하세요. (예: "black oversized cotton hoodie")
아우터 필요 여부: {"필요" if needs_outer else "불필요"}

=== 출력 형식 (순수 JSON 배열만, {num_outfits}개) ===
[
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"스타일명","description":"한 줄 코디 설명"}},
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"스타일명","description":"한 줄 코디 설명"}}
]"""

    raw = gemini_text(prompt)
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        outfits = json.loads(clean)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\[.*\]', clean, re.DOTALL)
        outfits = json.loads(m.group()) if m else [json.loads(clean)]

    if isinstance(outfits, dict):
        outfits = [outfits]
    while len(outfits) < num_outfits:
        outfits.append(outfits[0].copy() if outfits else {})
    return outfits[:num_outfits]