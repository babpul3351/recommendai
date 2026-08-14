"""
gemini_service.py

변경 사항 (기존 대비)
------------------
API_KEY를 코드에 직접 작성하는 대신, .env 파일에서 읽어오도록 변경.
이제 API 키가 코드에 노출되지 않으므로, GitHub(public 저장소)에 안전하게
커밋 가능.

.env 파일은 ai_server 폴더 안에 각자 만들어야 하며, git에는 업로드되지 않음.
(.env.example 파일을 참고해서 본인의 .env를 생성해야 함.)
"""

import os
from dotenv import load_dotenv

# ai_server/.env 파일을 읽어서 환경변수로 등록
load_dotenv()

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64, json
import time

API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY가 설정되지 않았습니다.\n"
        "ai_server 폴더에 .env 파일을 만들고 GEMINI_API_KEY=본인의_키 를 추가하세요.\n"
        "(.env.example 파일을 참고하세요)"
    )

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
                    wait = (attempt + 1) * 3
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
        '{"category":"상의/하의/아우터/원피스 중 하나",'
        '"type":"아이템명",'
        '"color":"색상",'
        '"material":"소재",'
        '"style":"casual/formal/business/lovely/feminine/sporty/comfort 중 이 옷에 가장 잘 맞는 것 하나만 영어 코드 그대로"}'
    )
    clean = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(clean)

    VALID_STYLES = {"casual", "formal", "business", "lovely", "feminine", "sporty", "comfort"}
    if result.get("style") not in VALID_STYLES:
        result["style"] = None

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