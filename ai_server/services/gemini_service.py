"""
gemini_service.py 프롬프트 수정본

변경 사항 (기존 대비)
------------------
실제 DB 데이터로 확인한 두 가지 문제를 해결합니다.

문제 1: style 필드가 완전 자유생성이라 같은 입력(TPO+선호스타일)에도
        매번 다른 값이 나옴 (예: "운동" TPO 5번 요청 시 5번 다 다른 결과)
        → 정해진 7개 스타일 목록 중에서만 고르도록 프롬프트에 제약 추가

문제 2: search_query(실제 CLIP 검색에 쓰이는 값)에 스타일 관련 표현이
        전혀 안 담겨서, 선호 스타일이 실제 검색 결과에 반영 안 됨
        (실제 데이터 예: "white collared sleeveless linen blend blouse"
         → 색상/소재/핏만 있고 "business"나 "casual" 같은 스타일 단어 없음)
        → search_query에 스타일 느낌을 반드시 포함하도록 명시

추가로 이전에 확정하신 "TPO 우선, 그 안에서 선호 스타일 반영" 원칙도
프롬프트에 명시적으로 반영했습니다.

이 파일에서 바뀐 함수는 get_outfit_recommendation() 하나뿐입니다.
다른 함수(analyze_clothing, gemini_text 등)는 그대로입니다.
"""

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64, json
import time
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY가 설정되지 않았습니다.\n"
        "ai_server 폴더에 .env 파일을 만들고 GEMINI_API_KEY=본인의_키 를 추가하세요."
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
# [신규] 스타일 고정 목록
# DB의 style 테이블(style_code)과 정확히 일치시켜서, 사용자 선호 스타일과
# LLM 결과가 같은 값 체계로 비교 가능하도록 만듭니다.
# ─────────────────────────────────────────────
VALID_STYLES = {
    "business": "비즈니스",
    "casual":   "캐주얼",
    "comfort":  "컴포트",
    "feminine": "페미닌",
    "formal":   "포멀",
    "lovely":   "러블리",
    "sporty":   "스포티",
}
VALID_STYLE_LIST_STR = ", ".join(VALID_STYLES.keys())  # "business, casual, comfort, ..."

# ─────────────────────────────────────────────
# 코디 추천 — 프롬프트 수정 버전
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

    # [수정] style 필드: 자유 텍스트 대신, 정해진 7개 코드 중 하나만 쓰도록 강제
    # [수정] search_query 필드: 스타일 느낌을 반드시 포함하도록 명시
    slot_fmt = (
        '{{"id":null,"color":"색상","type":"아이템명",'
        f'"search_query":"English query that MUST include a style descriptor '
        f'(e.g. business, casual, sporty, feminine, formal, lovely, comfort feel)"}}'
    )

    prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('ageGroup','20대')} / 성별: {profile.get('gender','여성')}
- TPO: {tpo} / 날씨: {temp}도, {weather.get('desc','맑음')}
- 선호 스타일: {style_str}
{event_context}

=== 우선순위 지시 (중요) ===
1순위: TPO({tpo})에 맞는 코디를 최우선으로 구성하세요.
       → TPO 반영은 description(설명 문구)과 각 슬롯의 아이템 종류
         (예: 운동이면 레깅스·스포츠브라 등 활동적인 아이템)로 표현하세요.
2순위: 그 안에서 사용자의 선호 스타일({style_str})을 최대한 반영하세요.
       → 선호 스타일 반영은 "style" 필드와 search_query의 색상·소재·핏
         디테일로 표현하세요.
       TPO와 선호 스타일이 상충하는 경우, TPO를 우선하되 색상·소재·핏의
       디테일로 선호 스타일의 느낌을 살리세요.
       (예: TPO="직장", 선호스타일="캐주얼" → 정장이 아닌 단정한 캐주얼)

=== "style" 필드 규칙 (매우 중요 — 반드시 지킬 것) ===
"style" 필드는 TPO나 아이템 종류와 절대 무관합니다.
오직 사용자의 선호 스타일 목록({style_str}) 중에서만 하나를 고르세요.

절대 금지: TPO를 기준으로 "sporty"를 자동으로 고르는 것.
           (운동 TPO라고 해서 style을 "sporty"로 채우면 안 됩니다.
            사용자 선호 스타일이 "lovely, business"라면, 운동 TPO여도
            style은 반드시 "lovely" 또는 "business" 중 하나여야 합니다.)

올바른 예 (선호 스타일이 "lovely, business"이고 TPO가 "운동"인 경우):
  style: "lovely"  → 코디 자체는 활동적인 레깅스+탱크탑(TPO 반영)이지만,
                      style 필드는 선호 스타일에서만 선택
  style: "business" → 마찬가지로 운동복이되 style은 선호 스타일 기준

잘못된 예: style: "sporty"  ← "sporty"가 선호 스타일 목록에 없다면 절대 사용 금지

전체 사용 가능한 스타일 값(참고용, 이 중에서도 반드시 선호 스타일과
겹치는 것만 사용): {VALID_STYLE_LIST_STR}

=== search_query 작성 규칙 (매우 중요 — 아이템 종류를 절대 바꾸지 말 것) ===
search_query는 두 부분으로 구성됩니다. 이 둘의 우선순위를 반드시 지키세요.

  (1) 아이템 종류 — TPO({tpo})가 100% 결정합니다. 이 부분은 절대
      style의 영향을 받으면 안 됩니다.
      예: TPO="운동" → leggings, sports bra, athletic shorts,
          performance tank top 등 활동복 종류만 사용
          ("business"나 "formal" 스타일이어도 셔츠·블라우스·정장류로
           바꾸면 절대 안 됩니다. 운동복이라는 카테고리는 고정입니다.)

  (2) 스타일 느낌 — 오직 색상 톤, 소재 질감, 디테일 수준에서만
      style을 반영하세요. 아이템의 기능이나 종류를 바꾸는 방식으로
      style을 반영하면 안 됩니다.

나쁜 예 (아이템 종류가 style에 오염됨):
  "black high-neck sleeveless performance workout top with a business feel"
  → "business feel"이 워크아웃탑의 정체성을 흐릴 위험이 있음

좋은 예 (아이템은 운동복 그대로, 스타일은 색상·톤에만 반영):
  "charcoal grey high-neck seamless performance tank top,
   minimal design with a refined business-inspired color palette"
  → 여전히 명백한 운동복이고, "business"는 색상/톤 표현으로만 등장

정리: "무엇을 입는지"는 TPO가 정하고, "어떤 느낌인지"는 style이 정합니다.
      style이 "무엇을 입는지" 자체를 바꾸면 안 됩니다.

=== 지시 ===
TPO·날씨·스타일에 맞는 서로 다른 {num_outfits}가지 코디를 구성하세요.
각 코디는 스타일/조합이 서로 달라야 합니다.
아우터 필요 여부: {"필요" if needs_outer else "불필요"}

=== 출력 형식 (순수 JSON 배열만, {num_outfits}개) ===
[
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"선호 스타일({style_str}) 중 하나","description":"한 줄 코디 설명 (TPO 반영)"}},
  {{"top":{slot_fmt},"bottom":{slot_fmt},"outer":{slot_fmt} 또는 null,"style":"선호 스타일({style_str}) 중 하나","description":"한 줄 코디 설명 (TPO 반영)"}}
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

    # [신규] 안전장치 강화: style이 "정해진 7개 목록"에 있는지뿐 아니라,
    # "이 사용자의 선호 스타일 목록"에 실제로 속하는지까지 검증합니다.
    # (7개 목록 안에 있어도 선호 스타일이 아니면 여전히 문제이므로)
    preferred_style_set = set(styles) if isinstance(styles, list) else set()
    for outfit in outfits:
        style_value = outfit.get("style", "")
        if style_value not in VALID_STYLES:
            print(f"[경고] LLM이 정해진 7개 목록 밖의 style을 생성함: '{style_value}'")
        elif preferred_style_set and VALID_STYLES.get(style_value) not in preferred_style_set and style_value not in preferred_style_set:
            print(f"[경고] LLM이 선호 스타일({styles})과 무관한 style을 생성함: '{style_value}'")
            # 지금은 로그만 남기고 통과시킵니다. 반복되면 재시도 로직 또는
            # 강제 치환(선호 스타일 중 하나로 덮어쓰기) 도입을 검토해야 합니다.

    while len(outfits) < num_outfits:
        outfits.append(outfits[0].copy() if outfits else {})
    return outfits[:num_outfits]