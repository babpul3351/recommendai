from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64
import json
import os

# ============================================================
# Gemini API
# ============================================================

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

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

    pil_img.save(
        buf,
        format="JPEG",
        quality=85
    )

    img_bytes = buf.getvalue()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(
                data=img_bytes,
                mime_type="image/jpeg"
            ),
            prompt_text
        ]
    )

    return response.text.strip()


# ============================================================
# 스타일 태그 목록
# ============================================================

STYLE_TAGS = [
    "캐주얼",
    "스트릿",
    "미니멀",
    "모던",
    "오피스",
    "스포티",
    "빈티지",
    "페미닌",
    "Y2K",
    "아메카지"
]


# ============================================================
# Gemini 결과에서 스타일 태그 정리
# ============================================================

def normalize_style_tags(style_tags):

    if not isinstance(style_tags, list):
        return []

    normalized = []

    for tag in style_tags:

        if not isinstance(tag, str):
            continue

        tag = tag.strip()

        # 허용된 스타일만 저장
        if tag in STYLE_TAGS and tag not in normalized:
            normalized.append(tag)

    # 최대 3개까지만 허용
    return normalized[:3]


# ============================================================
# 옷 이미지 분석
# ============================================================

def analyze_clothing(image_b64: str) -> dict:

    _, b64 = image_b64.split(",", 1)

    pil_img = Image.open(
        BytesIO(
            base64.b64decode(b64)
        )
    ).convert("RGB")

    # Gemini에 전달할 썸네일
    thumb = pil_img.copy()

    thumb.thumbnail((512, 512))

    prompt = f"""
당신은 패션 이미지 분석 전문가입니다.

주어진 옷 이미지를 분석하고 반드시 JSON 형식으로만 응답하세요.

마크다운 코드블록을 사용하지 마세요.
JSON 외의 설명을 절대 출력하지 마세요.

[category 규칙]
category는 반드시 다음 중 하나만 사용하세요.

- 상의
- 하의
- 아우터
- 원피스

[styleTags 규칙]

styleTags는 다음 목록에서만 선택하세요.

{", ".join(STYLE_TAGS)}

스타일 태그는 이미지에서 실제로 확인할 수 있는 스타일만 선택하세요.

최대 3개까지 선택할 수 있습니다.

억지로 여러 개를 선택하지 말고,
가장 적합한 스타일을 1~3개 선택하세요.

스타일 태그는 반드시 위 목록의 값을 그대로 사용하세요.

예를 들어
'casual'이라고 쓰지 말고 반드시 '캐주얼'이라고 쓰세요.

JSON 형식:

{{
    "category": "상의",
    "type": "티셔츠",
    "color": "화이트",
    "material": "코튼",
    "styleTags": ["캐주얼", "미니멀"]
}}
"""

    raw = gemini_vision(
        thumb,
        prompt
    )

    # Gemini가 혹시 코드블록으로 반환하는 경우 제거
    clean = (
        raw
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    result = json.loads(clean)

    # ========================================================
    # 기본값 처리
    # ========================================================

    if "category" not in result:
        result["category"] = "기타"

    if "type" not in result:
        result["type"] = ""

    if "color" not in result:
        result["color"] = ""

    if "material" not in result:
        result["material"] = ""

    # ========================================================
    # 스타일 태그 정규화
    # ========================================================

    result["styleTags"] = normalize_style_tags(
        result.get("styleTags", [])
    )

    # ========================================================
    # 썸네일 Base64
    # ========================================================

    buf = BytesIO()

    thumb.save(
        buf,
        format="JPEG",
        quality=75
    )

    result["imageB64"] = (
            "data:image/jpeg;base64,"
            + base64.b64encode(
        buf.getvalue()
    ).decode()
    )

    return result


# ============================================================
# 기온 구간 판별
# ============================================================

TEMP_ZONE_MAP = {
    "hot": ["상의", "하의", "원피스"],
    "warm": ["상의", "하의", "원피스"],
    "mild": ["상의", "하의", "원피스", "아우터"],
    "cool": ["상의", "하의", "아우터"],
    "cold": ["상의", "하의", "아우터"],
    "freeze": ["상의", "하의", "아우터"],
}


def get_temp_zone(temp: int) -> str:

    if temp >= 28:
        return "hot"

    if temp >= 23:
        return "warm"

    if temp >= 17:
        return "mild"

    if temp >= 12:
        return "cool"

    if temp >= 5:
        return "cold"

    return "freeze"


# ============================================================
# 코디 추천
# ============================================================

def get_outfit_recommendation(
        tpo,
        weather,
        profile,
        mode="rag",
        wardrobe_items=None,
        linked_events=None):

    if wardrobe_items is None:
        wardrobe_items = []

    if linked_events is None:
        linked_events = []

    temp = (
        weather.get("temp", 18)
        if weather
        else 18
    )

    desc = (
        weather.get("desc", "맑음")
        if weather
        else "맑음"
    )

    age_group = (
        profile.get("ageGroup", "20대")
        if profile
        else "20대"
    )

    gender = (
        profile.get("gender", "여성")
        if profile
        else "여성"
    )

    styles = (
        profile.get("styles", [])
        if profile
        else []
    )

    style_str = (
        ", ".join(styles)
        if styles
        else "캐주얼"
    )

    temp_zone = get_temp_zone(temp)

    # 일정 정보
    event_text = ""

    if linked_events:

        event_text = "\n[오늘의 일정]\n"

        for ev in linked_events:

            event_text += (
                f"- "
                f"{ev.get('eventName', '')}"
                f" "
                f"({ev.get('tpoKeyword', '')})\n"
            )

    if mode == "rag" and wardrobe_items:

        allowed = TEMP_ZONE_MAP.get(
            temp_zone,
            []
        )

        candidates = [
            w
            for w in wardrobe_items
            if any(
                a in str(w.get("category", ""))
                or a in str(w.get("type", ""))
                for a in allowed
            )
        ]

        if not candidates:
            candidates = wardrobe_items

        candidates_text = "\n".join([
            (
                f"- id:{w.get('id','없음')} "
                f"| {w.get('category','')} "
                f"| {w.get('type','')} "
                f"| {w.get('color','')} "
                f"| {w.get('material','')} "
                f"| 스타일:{w.get('styleTags', [])}"
            )
            for w in candidates[:20]
        ])

        prompt = f"""
당신은 전문 패션 스타일리스트입니다.

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

아래 JSON 형식으로만 응답하세요.

{{
  "top": {{
      "id": "uuid또는null",
      "color": "색상",
      "type": "종류",
      "search_query": "영문검색어"
  }},
  "bottom": {{
      "id": "uuid또는null",
      "color": "색상",
      "type": "종류",
      "search_query": "영문검색어"
  }},
  "outer": null,
  "style": "스타일태그",
  "description": "한국어로 코디 설명 2-3문장"
}}
"""

    else:

        prompt = f"""
당신은 전문 패션 스타일리스트입니다.

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

아래 JSON 형식으로만 응답하세요.

{{
  "top": {{
      "id": null,
      "color": "색상",
      "type": "종류",
      "search_query": "영문검색어"
  }},
  "bottom": {{
      "id": null,
      "color": "색상",
      "type": "종류",
      "search_query": "영문검색어"
  }},
  "outer": null,
  "style": "스타일태그",
  "description": "한국어로 코디 설명 2-3문장"
}}
"""

    try:

        raw = gemini_text(prompt)

        clean = (
            raw
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        return json.loads(clean)

    except Exception as e:

        print(
            f"Gemini 파싱 오류: {e}"
        )

        return {
            "top": {
                "id": None,
                "color": "화이트",
                "type": "티셔츠",
                "search_query": "white t-shirt"
            },

            "bottom": {
                "id": None,
                "color": "블랙",
                "type": "팬츠",
                "search_query": "black pants"
            },

            "outer": None,

            "style": "캐주얼",

            "description": "기본 캐주얼 코디입니다."
        }