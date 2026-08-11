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
    """
    옷 이미지를 Gemini Vision으로 분석한다.

    분석 결과:
    - category
    - type
    - color
    - material
    - styleTags

    styleTags는 최대 3개까지 반환한다.
    """

    try:
        # --------------------------------------------------------
        # Base64 이미지 분리
        # --------------------------------------------------------

        if "," in image_b64:
            _, b64 = image_b64.split(",", 1)
        else:
            b64 = image_b64

        # --------------------------------------------------------
        # 이미지 디코딩
        # --------------------------------------------------------

        image_bytes = base64.b64decode(b64)

        pil_img = Image.open(
            BytesIO(image_bytes)
        ).convert("RGB")

        # Gemini에 전달할 이미지 크기 축소
        thumb = pil_img.copy()
        thumb.thumbnail((512, 512))

        # --------------------------------------------------------
        # Gemini Vision 프롬프트
        # --------------------------------------------------------

        prompt = """
이 이미지는 의류 사진입니다.

이미지를 보고 옷의 정보를 분석하세요.

반드시 아래 JSON 형식만 출력하세요.
마크다운 코드블록(```)을 사용하지 마세요.
JSON 앞뒤에 설명을 붙이지 마세요.

{
  "category": "상의",
  "type": "티셔츠",
  "color": "화이트",
  "material": "코튼",
  "styleTags": ["캐주얼", "미니멀"]
}

각 항목의 규칙은 다음과 같습니다.

1. category
다음 4개 중 하나만 사용하세요.
- 상의
- 하의
- 아우터
- 원피스

4개 중 정확하게 판단하기 어려운 경우 가장 가까운 카테고리를 선택하세요.

2. type
구체적인 옷 종류를 한국어로 작성하세요.

예:
- 티셔츠
- 셔츠
- 블라우스
- 후드티
- 맨투맨
- 니트
- 청바지
- 슬랙스
- 반바지
- 스커트
- 자켓
- 코트
- 패딩
- 원피스

3. color
대표적인 색상 하나만 한국어로 작성하세요.

예:
- 블랙
- 화이트
- 그레이
- 네이비
- 블루
- 레드
- 핑크
- 옐로우
- 그린
- 카키
- 브라운
- 베이지
- 퍼플
- 오렌지

4. material
이미지에서 판단할 수 있는 대표 소재를 작성하세요.

예:
- 코튼
- 데님
- 니트
- 가죽
- 린넨
- 폴리에스터
- 울
- 시폰
- 기타

판단하기 어려우면 "기타"라고 작성하세요.

5. styleTags
이 옷의 패션 스타일을 분석해서 최대 3개까지 선택하세요.

사용 가능한 스타일 태그는 다음과 같습니다.

- 캐주얼
- 스트릿
- 미니멀
- 모던
- 오피스
- 스포티
- 빈티지
- 페미닌
- Y2K
- 아메카지

이미지에서 가장 잘 어울리는 스타일을 1~3개 선택하세요.

스타일 태그는 반드시 위 목록에서만 선택하세요.

예를 들어:
["캐주얼"]
또는
["캐주얼", "미니멀"]
또는
["스트릿", "Y2K"]

최종 응답은 반드시 유효한 JSON 객체 하나만 반환하세요.
"""

        # --------------------------------------------------------
        # Gemini Vision 호출
        # --------------------------------------------------------

        raw = gemini_vision(
            thumb,
            prompt
        )

        print(
            "[Gemini] 옷 분석 원본 응답:",
            raw
        )

        # --------------------------------------------------------
        # Markdown 제거
        # --------------------------------------------------------

        clean = (
            raw
            .replace("```json", "")
            .replace("```JSON", "")
            .replace("```", "")
            .strip()
        )

        # --------------------------------------------------------
        # JSON 파싱
        # --------------------------------------------------------

        try:

            result = json.loads(clean)

        except json.JSONDecodeError:

            # 혹시 Gemini가 JSON 앞뒤에 설명을 붙였을 경우
            import re

            match = re.search(
                r'\{.*\}',
                clean,
                re.DOTALL
            )

            if not match:
                raise ValueError(
                    "Gemini 응답에서 JSON을 찾을 수 없습니다: "
                    + clean
                )

            result = json.loads(
                match.group()
            )

        # --------------------------------------------------------
        # styleTags 검증
        # --------------------------------------------------------

        allowed_styles = {
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
        }

        style_tags = result.get(
            "styleTags",
            []
        )

        # 문자열로 오는 경우도 처리
        if isinstance(
                style_tags,
                str
        ):

            style_tags = [
                tag.strip()
                for tag in style_tags.split(",")
                if tag.strip()
            ]

        # 리스트가 아니면 빈 배열
        if not isinstance(
                style_tags,
                list
        ):

            style_tags = []

        # 허용된 태그만 사용
        style_tags = [
            str(tag).strip()
            for tag in style_tags
            if str(tag).strip() in allowed_styles
        ]

        # 중복 제거 + 최대 3개
        style_tags = list(
            dict.fromkeys(
                style_tags
            )
        )[:3]

        result["styleTags"] = style_tags

        # --------------------------------------------------------
        # 기존 데이터 기본값 보정
        # --------------------------------------------------------

        result["category"] = (
                result.get("category")
                or "기타"
        )

        result["type"] = (
                result.get("type")
                or ""
        )

        result["color"] = (
                result.get("color")
                or ""
        )

        result["material"] = (
                result.get("material")
                or "기타"
        )

        # --------------------------------------------------------
        # 썸네일 이미지 생성
        # --------------------------------------------------------

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

        # --------------------------------------------------------
        # 최종 결과 로그
        # --------------------------------------------------------

        print(
            "[Gemini] 최종 분석 결과:",
            result
        )

        return result

    except Exception as e:

        print(
            "[Gemini] analyze_clothing 오류:",
            repr(e)
        )

        raise

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