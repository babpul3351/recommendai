from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64, json
import time

API_KEY = ""

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

    slot_fmt = '{{"id":"문자열또는null","color":"색상","type":"아이템명","search_query":"English query"}}'

    if mode == "rag" and wardrobe_items:
        allowed = TEMP_ZONE_MAP[zone]
        candidates = {cat: [] for cat in allowed}
        for item in wardrobe_items:
            cat = item.get("category", "")
            if cat in candidates:
                candidates[cat].append(
                    f"[{item['id']}] {item['color']} {item['type']} ({item.get('material','')})"
                )
        candidates_text = ""
        for cat, items in candidates.items():
            if items:
                candidates_text += f"\n[{cat}]\n" + "\n".join(f"  - {i}" for i in items)

        prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('ageGroup','20대')} / 성별: {profile.get('gender','여성')}
- TPO: {tpo} / 날씨: {temp}도, {weather.get('desc','맑음')}
- 선호 스타일: {style_str}
{event_context}

=== 옷장 후보 ===
{candidates_text if candidates_text else '(등록된 옷 없음)'}

=== 지시 ===
후보에서 TPO·스타일에 맞는 서로 다른 {num_outfits}가지 코디를 구성하세요.
각 코디는 스타일/조합이 달라야 합니다. 후보가 있으면 id를 반드시 기록하세요.
아우터 필요 여부: {"필요" if needs_outer else "불필요"}

=== 출력 형식 (순수 JSON 배열만, {num_outfits}개) ===
[
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"스타일명","description":"한 줄 코디 설명"}},
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"스타일명","description":"한 줄 코디 설명"}}
]"""
    else:
        prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('ageGroup','20대')} / 성별: {profile.get('gender','여성')}
- TPO: {tpo} / 날씨: {temp}도, {weather.get('desc','맑음')}
- 선호 스타일: {style_str}

=== 지시 ===
TPO·스타일에 맞는 서로 다른 {num_outfits}가지 코디를 구성하세요.

=== 출력 형식 (순수 JSON 배열만, {num_outfits}개) ===
[
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":null,"style":"스타일명","description":"한 줄 코디 설명"}},
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":null,"style":"스타일명","description":"한 줄 코디 설명"}}
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