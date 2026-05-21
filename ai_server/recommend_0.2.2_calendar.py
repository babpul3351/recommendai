"""
AI 스마트 옷장 - 리팩토링 버전
교수님 피드백 반영:
  - Mode A (RAG): 로컬에서 후보 필터링 → 필터된 후보만 AI에 전달
  - Mode B (추천 우선): AI가 이상적 코디 독립 생성 → 로컬에서 옷장과 CLIP 매칭
"""

from flask import Flask, render_template_string, request, jsonify
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
import json, base64, os, sys, threading, webbrowser, requests
from io import BytesIO
import numpy as np

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
API_KEY         = "AIzaSyBGKmZFfiZqieUEm5hh_TE3xzndF-yjQHc"
WEATHER_API_KEY = "여기에_OpenWeatherMap_API_키_입력"
CITY            = "Seoul"

DB_DIR        = "./fashion_db"
EMBED_PATH    = os.path.join(DB_DIR, "embeddings.npy")
META_PATH     = os.path.join(DB_DIR, "metadata.json")
USER_FILE     = "./user_profile.json"
WARDROBE_FILE = "./wardrobe.json"
WARDROBE_EMB  = "./wardrobe_embeddings.json"

app = Flask(__name__)

# ─────────────────────────────────────────────
# Gemini 클라이언트 초기화
# ─────────────────────────────────────────────
gemini_client = None

def get_gemini():
    global gemini_client
    if gemini_client is None:
        gemini_client = genai.Client(api_key=API_KEY)
    return gemini_client


def gemini_text(prompt):
    client   = get_gemini()
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
# 공개 DB 로드
# ─────────────────────────────────────────────
public_embeddings = None
public_metadata   = []

def load_public_db():
    global public_embeddings, public_metadata
    if not os.path.exists(EMBED_PATH):
        print("[경고] fashion_db 없음. recommendTest_db.py 먼저 실행하세요.")
        return
    public_embeddings = np.load(EMBED_PATH)
    with open(META_PATH, encoding="utf-8") as f:
        public_metadata = json.load(f)
    print(f"[공개DB] 로드 완료: {len(public_metadata)}장")


# ─────────────────────────────────────────────
# CLIP 모델 (CPU 전용)
# ─────────────────────────────────────────────
clip_model     = None
clip_processor = None

def load_clip():
    global clip_model, clip_processor
    if clip_model is not None:
        return
    import torch
    from transformers import CLIPModel, CLIPProcessor
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "0"
    clip_model     = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip")
    clip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
    clip_model.eval()
    print("[CLIP] FashionCLIP 로드 완료")


def get_image_embedding(pil_img):
    import torch
    load_clip()
    inputs = clip_processor(images=[pil_img], return_tensors="pt", padding=True)
    with torch.no_grad():
        out  = clip_model.vision_model(pixel_values=inputs["pixel_values"])
        proj = clip_model.visual_projection(out.pooler_output)
        norm = proj.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        feat = (proj / norm).float().numpy()[0]
    return feat.tolist()


def get_text_embedding(text):
    import torch
    load_clip()
    inputs = clip_processor(text=[text], return_tensors="pt",
                            padding=True, truncation=True, max_length=77)
    with torch.no_grad():
        out  = clip_model.text_model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        proj = clip_model.text_projection(out.pooler_output)
        norm = proj.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        feat = (proj / norm).float().numpy()[0]
    return feat.tolist()


# ─────────────────────────────────────────────
# 내 옷장 데이터 관리
# ─────────────────────────────────────────────
def load_wardrobe():
    if os.path.exists(WARDROBE_FILE):
        with open(WARDROBE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []

def save_wardrobe(data):
    with open(WARDROBE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_wardrobe_embeddings():
    if os.path.exists(WARDROBE_EMB):
        with open(WARDROBE_EMB, encoding="utf-8") as f:
            return json.load(f)
    return []

def save_wardrobe_embeddings(data):
    with open(WARDROBE_EMB, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
# 유저 프로필 / 날씨
# ─────────────────────────────────────────────
def load_profile():
    if os.path.exists(USER_FILE):
        with open(USER_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"age": "20대", "gender": "여성", "style": "캐주얼"}

def save_profile(data):
    with open(USER_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_weather():
    if WEATHER_API_KEY == "여기에_OpenWeatherMap_API_키_입력":
        return {"temp": 18, "desc": "맑음"}
    try:
        url = (f"http://api.openweathermap.org/data/2.5/weather"
               f"?q={CITY}&appid={WEATHER_API_KEY}&units=metric&lang=kr")
        res = requests.get(url, timeout=5).json()
        return {"temp": round(res["main"]["temp"]),
                "desc": res["weather"][0]["description"]}
    except:
        return {"temp": 18, "desc": "맑음"}


# ─────────────────────────────────────────────
# ★ Mode A: RAG 방식
#   로컬에서 카테고리/날씨 기준 후보를 먼저 필터링한 뒤,
#   그 후보 목록(메타데이터만, 이미지 제외)을 AI에 전달
# ─────────────────────────────────────────────
TEMP_CATEGORY_MAP = {
    # 기온 범위: (허용 카테고리 우선순위, 아우터 필요 여부)
    "hot":    (["상의", "하의", "원피스"],          False),  # 28도 이상
    "warm":   (["상의", "하의", "원피스"],          False),  # 23~27도
    "mild":   (["상의", "하의", "원피스", "아우터"], True),   # 17~22도
    "cool":   (["상의", "하의", "아우터"],          True),   # 12~16도
    "cold":   (["상의", "하의", "아우터"],          True),   # 5~11도
    "freeze": (["상의", "하의", "아우터"],          True),   # 4도 이하
}

def get_temp_zone(temp: int) -> str:
    if temp >= 28: return "hot"
    if temp >= 23: return "warm"
    if temp >= 17: return "mild"
    if temp >= 12: return "cool"
    if temp >= 5:  return "cold"
    return "freeze"


def filter_wardrobe_candidates(wardrobe: list, temp: int) -> dict:
    """
    기온 기준으로 옷장 아이템을 카테고리별로 필터링.
    이미지 데이터(base64)는 제외하고 메타데이터만 반환.
    반환 형식: {"상의": [...], "하의": [...], "아우터": [...], "원피스": [...]}
    """
    zone           = get_temp_zone(temp)
    allowed_cats, needs_outer = TEMP_CATEGORY_MAP[zone]
    candidates     = {cat: [] for cat in allowed_cats}

    for i, item in enumerate(wardrobe):
        cat = item.get("category", "")
        if cat in candidates:
            candidates[cat].append({
                "index":    i,               # 원본 옷장 인덱스 (임베딩 참조용)
                "type":     item.get("type", ""),
                "color":    item.get("color", ""),
                "material": item.get("material", ""),
                "category": cat,
            })

    print(f"[RAG 필터] 기온존={zone}, "
          + ", ".join(f"{k}:{len(v)}개" for k, v in candidates.items() if v))
    return candidates, needs_outer


def get_outfit_recommendation_rag(tpo, weather, profile, candidates: dict, needs_outer: bool):
    """
    Mode A: 필터된 후보 목록을 AI에 전달하여 그 중에서 코디를 구성하도록 요청.
    후보가 없는 카테고리는 AI에게 자유롭게 제안하도록 허용.
    """
    # 후보 목록을 간결한 텍스트로 직렬화 (이미지 제외)
    candidates_text = ""
    for cat, items in candidates.items():
        if items:
            lines = [f"  - [{i['index']}] {i['color']} {i['type']} ({i['material']})"
                     for i in items]
            candidates_text += f"\n[{cat}]\n" + "\n".join(lines) + "\n"

    if not candidates_text:
        candidates_text = "  (등록된 옷 없음)"

    outer_instruction = (
        '"outer": {{"index":정수,"color":"색상","type":"아이템명","search_query":"English query"}},'
        if needs_outer else
        '"outer": null,'
    )

    prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('age','20대')}
- 성별: {profile.get('gender','여성')}
- TPO: {tpo}
- 날씨: {weather['temp']}도, {weather['desc']}
- 선호 스타일: {profile.get('style','캐주얼')}

=== 사용자 옷장 후보 (기온 기준 필터링됨) ===
각 항목은 [인덱스] 색상 아이템 (소재) 형식입니다.
{candidates_text}

=== 지시 ===
위 후보 중에서 TPO와 스타일에 가장 잘 맞는 아이템을 골라 코디를 구성하세요.
- 후보가 있는 카테고리는 반드시 후보 중에서 선택하고, index 필드에 해당 항목의 인덱스를 기록하세요.
- 후보가 없는 카테고리는 index를 null로 설정하고 자유롭게 제안하세요.
- 아우터 필요 여부: {"필요" if needs_outer else "불필요 (생략 가능)"}

=== 출력 형식 (순수 JSON만, 마크다운 없이) ===
{{
  "top":    {{"index":정수또는null,"color":"색상","type":"아이템명","search_query":"English CLIP query"}},
  "bottom": {{"index":정수또는null,"color":"색상","type":"아이템명","search_query":"English CLIP query"}},
  {outer_instruction}
  "style":  "스타일명",
  "description": "한 줄 코디 설명"
}}"""

    raw   = gemini_text(prompt)
    clean = raw.replace("```json","").replace("```","").strip()
    return json.loads(clean)


# ─────────────────────────────────────────────
# ★ Mode B: 추천 우선 방식 (기존 흐름 유지)
#   AI가 이상적 코디를 독립 생성 → 로컬 CLIP으로 옷장 매칭
#   AI에게 옷장 데이터를 전혀 전달하지 않음
# ─────────────────────────────────────────────
def get_outfit_recommendation_blind(tpo, weather, profile):
    """
    Mode B: 옷장 데이터 없이 AI에게 이상적인 코디만 요청.
    반환된 search_query로 로컬 CLIP 매칭 수행.
    """
    prompt = f"""
=== 사용자 조건 ===
- 연령대: {profile.get('age','20대')}
- 성별: {profile.get('gender','여성')}
- TPO: {tpo}
- 날씨: {weather['temp']}도, {weather['desc']}
- 선호 스타일: {profile.get('style','캐주얼')}

=== 스타일 기준 ===
캐주얼 / 포멀 / 비즈니스 / 러블리 / 페미닌 / 스포티 / 컴포트

=== 색상 기준 ===
레드, 오렌지, 옐로우, 그린, 카키, 핑크, 퍼플,
블루, 네이비, 브라운, 블랙, 그레이, 화이트

=== 기온별 아이템 기준 ===
- 28도 이상: 민소매, 반팔, 반바지, 린넨
- 27~23도: 반팔, 얇은 셔츠, 반바지, 면바지
- 22~20도: 블라우스, 긴팔 티, 슬랙스
- 19~17도: 가디건, 니트, 맨투맨, 후드
- 16~12도: 자켓, 청자켓, 니트, 청바지
- 11~9도: 트렌치코트, 야상, 점퍼
- 8~5도: 울코트, 히트텍, 가죽 옷
- 4도 이하: 패딩, 두꺼운 코트, 누빔

=== 출력 형식 (순수 JSON만, 마크다운 없이) ===
{{
  "top":    {{"color":"색상","material":"소재","type":"아이템명","search_query":"English CLIP query"}},
  "bottom": {{"color":"색상","material":"소재","type":"아이템명","search_query":"English CLIP query"}},
  "outer":  {{"color":"색상","material":"소재","type":"아이템명","search_query":"English CLIP query"}} 또는 null,
  "style":  "스타일명",
  "description": "한 줄 코디 설명"
}}"""

    raw   = gemini_text(prompt)
    clean = raw.replace("```json","").replace("```","").strip()
    return json.loads(clean)


# ─────────────────────────────────────────────
# 공개 DB 참고 이미지 검색
# ─────────────────────────────────────────────
def search_public_db(query_text, category):
    if public_embeddings is None or not public_metadata:
        return None
    query_vec  = np.array(get_text_embedding(query_text), dtype="float32")
    scores     = public_embeddings @ query_vec
    sorted_idx = np.argsort(scores)[::-1]
    for idx in sorted_idx:
        item = public_metadata[idx]
        if item["category"] == category:
            return item
    return None


# ─────────────────────────────────────────────
# 옷장 CLIP 매칭 (Mode B용)
# ─────────────────────────────────────────────
def match_wardrobe_by_clip(wardrobe, wardrobe_embeds, query_text, target_cat):
    """
    CLIP 텍스트 임베딩으로 옷장에서 가장 유사한 아이템을 찾음.
    target_cat가 있으면 해당 카테고리 우선 검색, 없으면 전체 검색.
    """
    if not wardrobe or not wardrobe_embeds:
        return None, -1

    query_vec = np.array(get_text_embedding(query_text), dtype="float32")

    # 카테고리 일치 후보 우선
    filtered = [(i, w) for i, w in enumerate(wardrobe)
                if w.get("category") == target_cat and i < len(wardrobe_embeds)]
    if not filtered:
        filtered = [(i, w) for i, w in enumerate(wardrobe) if i < len(wardrobe_embeds)]

    best_score, best_item = -1, None
    for i, w in filtered:
        score = float(np.dot(query_vec, np.array(wardrobe_embeds[i], dtype="float32")))
        if score > best_score:
            best_score, best_item = score, w
    return best_item, best_score


# ─────────────────────────────────────────────
# 흰 배경 코디 이미지 합성
# ─────────────────────────────────────────────
def compose_outfit_image(items):
    valid = [item for item in items if item and item.get("image")]
    if not valid:
        return ""
    W, H  = 240, 300
    PAD   = 16
    N     = len(valid)
    CVSW  = W * N + PAD * (N + 1)
    CVSH  = H + PAD * 2 + 28
    canvas = Image.new("RGB", (CVSW, CVSH), (255, 255, 255))
    draw   = ImageDraw.Draw(canvas)
    for i, item in enumerate(valid):
        x, y = PAD + i * (W + PAD), PAD
        try:
            _, b64 = item["image"].split(",", 1)
            img    = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB").resize((W, H))
            canvas.paste(img, (x, y))
        except:
            draw.rectangle([x, y, x+W, y+H], outline="#e8ddd4", width=2)
        draw.text((x + W//2 - 20, y + H + 5), item.get("category",""), fill="#8b5e3c")
    buf = BytesIO()
    canvas.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ─────────────────────────────────────────────
# HTML (모드 선택 UI 추가)
# ─────────────────────────────────────────────
HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Look at Life</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --mint:       #8ecfc0;
  --mint-light: #e8f5f2;
  --mint-mid:   #b8e0d8;
  --dark:       #1a1a2e;
  --gray1:      #f7f8fa;
  --gray2:      #eef0f3;
  --gray3:      #c8cdd6;
  --gray4:      #8a8f9a;
  --text:       #1e2028;
  --text2:      #5a5f6e;
  --white:      #ffffff;
  --radius-lg:  20px;
  --radius-md:  14px;
  --radius-sm:  10px;
  --shadow-sm:  0 2px 12px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 24px rgba(0,0,0,0.10);
}

* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

body {
  font-family: 'Noto Sans KR', sans-serif;
  background: var(--gray1);
  color: var(--text);
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  overflow-x: hidden;
}

/* ── 상단 헤더 ── */
.top-bar {
  background: var(--white);
  padding: 52px 20px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--gray2);
}
.top-bar .logo {
  font-family: 'DM Serif Display', serif;
  font-size: 18px;
  color: var(--dark);
  letter-spacing: -0.3px;
}
.top-bar .logo span { color: var(--mint); }
.top-bar .icon-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--gray2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 16px;
}

/* ── 페이지 컨테이너 ── */
.page { display: none; padding: 0 0 90px; animation: fadeUp .25s ease; }
.page.active { display: block; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── 날씨 카드 (홈) ── */
.weather-card {
  margin: 16px;
  background: linear-gradient(135deg, var(--mint) 0%, #6bbfad 100%);
  border-radius: var(--radius-lg);
  padding: 22px 24px;
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 8px 24px rgba(142,207,192,0.35);
}
.weather-card .temp {
  font-family: 'DM Serif Display', serif;
  font-size: 64px;
  line-height: 1;
  letter-spacing: -2px;
}
.weather-card .temp sup { font-size: 24px; vertical-align: super; letter-spacing: 0; }
.weather-card .meta { font-size: 13px; opacity: .85; margin-top: 4px; }
.weather-card .meta b { font-size: 15px; font-weight: 700; display: block; margin-bottom: 2px; }
.weather-card .wx-icon { font-size: 52px; filter: drop-shadow(0 4px 8px rgba(0,0,0,.15)); }

/* ── 섹션 헤더 ── */
.sec-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 10px;
}
.sec-header h2 { font-size: 15px; font-weight: 700; color: var(--text); }
.sec-header a  { font-size: 12px; color: var(--mint); font-weight: 500; text-decoration: none; cursor: pointer; }

/* ── 추천 코디 카드 (홈 미리보기) ── */
.today-card {
  margin: 0 16px 8px;
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform .15s;
}
.today-card:active { transform: scale(.98); }
.today-card .tc-header {
  background: var(--mint-light);
  padding: 14px 18px 10px;
  display: flex; align-items: center; justify-content: space-between;
}
.today-card .tc-label {
  font-size: 11px; color: var(--mint); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
}
.today-card .tc-badge {
  font-size: 11px; background: var(--mint); color: #fff;
  padding: 3px 10px; border-radius: 99px;
}
.today-card .tc-body { padding: 14px 18px 16px; }
.today-card .tc-style { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.today-card .tc-desc  { font-size: 12px; color: var(--text2); line-height: 1.6; }
.today-card .tc-items {
  display: flex; gap: 8px; padding: 0 18px 16px; overflow-x: auto;
  scrollbar-width: none;
}
.today-card .tc-items::-webkit-scrollbar { display: none; }
.tc-item-pill {
  flex-shrink: 0;
  background: var(--gray2); border-radius: 99px;
  padding: 5px 12px; font-size: 11px; color: var(--text2); white-space: nowrap;
}

/* ── 옷장 그리드 ── */
.wardrobe-scroll {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 0 16px;
}
.w-card {
  background: var(--white);
  border-radius: var(--radius-md);
  overflow: hidden;
  aspect-ratio: 3/4;
  position: relative;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}
.w-card img { width: 100%; height: 100%; object-fit: cover; }
.w-card .w-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,.55));
  padding: 18px 8px 8px;
}
.w-card .w-cat  { font-size: 9px; color: rgba(255,255,255,.8); letter-spacing: .5px; }
.w-card .w-name { font-size: 11px; color: #fff; font-weight: 600; margin-top: 1px; }
.w-card .w-del {
  position: absolute; top: 6px; right: 6px;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(0,0,0,.35); border: none; color: #fff;
  font-size: 13px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; line-height: 1;
}
.w-add-card {
  background: var(--mint-light);
  border-radius: var(--radius-md);
  aspect-ratio: 3/4;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer; border: 2px dashed var(--mint-mid);
  transition: background .15s;
}
.w-add-card:active { background: var(--mint-mid); }
.w-add-icon { font-size: 28px; color: var(--mint); margin-bottom: 6px; }
.w-add-card span { font-size: 11px; color: var(--mint); font-weight: 500; }
.w-empty-full {
  grid-column: 1/-1;
  text-align: center; padding: 40px 20px;
  color: var(--gray4); font-size: 13px; line-height: 2;
}

/* ── 코디 추천 탭 ── */
.rec-top {
  background: var(--white);
  padding: 16px 20px;
  border-bottom: 1px solid var(--gray2);
  margin-bottom: 4px;
}
.rec-weather-mini {
  display: flex; align-items: center; gap: 10px;
  background: var(--mint-light); border-radius: var(--radius-sm);
  padding: 10px 14px; margin-bottom: 14px;
  font-size: 13px; color: var(--text);
}
.rec-weather-mini .mini-temp {
  font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--mint);
}

/* 모드 토글 */
.mode-row { display: flex; gap: 8px; margin-bottom: 14px; }
.mode-pill {
  flex: 1; padding: 9px 4px; border-radius: 99px;
  border: 1.5px solid var(--gray3);
  background: var(--white); font-size: 12px;
  color: var(--gray4); cursor: pointer; font-family: inherit;
  transition: all .2s; text-align: center; font-weight: 500;
}
.mode-pill.active { background: var(--mint); color: #fff; border-color: var(--mint); }
.mode-hint {
  font-size: 11px; color: var(--text2); background: var(--gray2);
  border-radius: var(--radius-sm); padding: 9px 12px;
  line-height: 1.6; margin-bottom: 0;
}

/* TPO 칩 */
.tpo-scroll {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 14px 20px; scrollbar-width: none;
}
.tpo-scroll::-webkit-scrollbar { display: none; }
.tpo-chip {
  flex-shrink: 0; padding: 8px 16px; border-radius: 99px;
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 13px; color: var(--text2); cursor: pointer;
  font-family: inherit; transition: all .15s; white-space: nowrap;
}
.tpo-chip.sel { background: var(--dark); color: #fff; border-color: var(--dark); }

.rec-btn {
  margin: 0 16px 16px; width: calc(100% - 32px);
  padding: 15px; border-radius: var(--radius-md);
  border: none; background: var(--dark); color: #fff;
  font-size: 14px; font-family: inherit; font-weight: 700;
  cursor: pointer; letter-spacing: .3px;
  transition: background .15s; display: flex;
  align-items: center; justify-content: center; gap: 8px;
}
.rec-btn:active { background: #0a0a1a; }

/* 로딩 */
.loading-box {
  display: none; text-align: center; padding: 52px 20px;
}
.loader {
  width: 40px; height: 40px; margin: 0 auto 16px;
  border: 3px solid var(--mint-light);
  border-top-color: var(--mint);
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-box p { font-size: 13px; color: var(--text2); }

/* 결과 카드 */
.result-wrap { display: none; padding: 0 16px 16px; }

.result-hero {
  background: var(--white); border-radius: var(--radius-lg);
  overflow: hidden; box-shadow: var(--shadow-sm); margin-bottom: 12px;
}
.result-hero-head {
  background: linear-gradient(135deg, var(--mint) 0%, #6bbfad 100%);
  padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
}
.result-hero-head .rh-label {
  font-size: 11px; color: rgba(255,255,255,.8); letter-spacing: 1px; text-transform: uppercase;
}
.result-hero-head .rh-style { font-size: 18px; font-weight: 700; color: #fff; margin-top: 2px; }
.rh-badge { font-size: 10px; background: rgba(255,255,255,.25); color: #fff; padding: 3px 10px; border-radius: 99px; }
.result-desc { padding: 14px 20px; font-size: 13px; color: var(--text2); line-height: 1.7; font-style: italic; border-bottom: 1px solid var(--gray2); }
.composed-wrap { padding: 14px 20px; }
.composed-wrap img { width: 100%; border-radius: var(--radius-sm); }

/* 매칭 아이템 */
.match-section { margin-bottom: 12px; }
.match-section .ms-title {
  font-size: 11px; color: var(--text2); letter-spacing: 1px;
  text-transform: uppercase; font-weight: 700;
  padding: 14px 20px 10px;
}
.match-grid {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 10px; padding: 0 16px;
}
.m-card {
  background: var(--white); border-radius: var(--radius-md);
  overflow: hidden; box-shadow: var(--shadow-sm);
  border: 2px solid var(--mint);
}
.m-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
.m-card .mc-info { padding: 8px 10px; }
.mc-cat  { font-size: 9px; color: var(--mint); letter-spacing: .5px; font-weight: 700; text-transform: uppercase; }
.mc-name { font-size: 11px; color: var(--text); font-weight: 600; margin-top: 2px; }
.mc-score { font-size: 10px; color: var(--gray4); margin-top: 2px; }
.mc-empty {
  grid-column: 1/-1; text-align: center; padding: 24px;
  color: var(--gray4); font-size: 12px;
  border: 1.5px dashed var(--gray3); border-radius: var(--radius-md);
}
.no-img-box {
  aspect-ratio: 3/4; background: var(--mint-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--mint); text-align: center; padding: 8px;
}

/* 참고 스타일 */
.ref-section { margin-bottom: 12px; }
.ref-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 0 16px; }
.r-card { background: var(--white); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); }
.r-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
.r-card .rc-info { padding: 8px 10px; }
.rc-cat   { font-size: 9px; color: var(--gray4); letter-spacing: .5px; text-transform: uppercase; }
.rc-name  { font-size: 11px; color: var(--text); font-weight: 600; margin-top: 2px; }
.rc-label { font-size: 10px; color: var(--gray3); margin-top: 2px; }

.retry-btn {
  width: 100%; padding: 13px; border-radius: var(--radius-md);
  border: 1.5px solid var(--gray3); background: var(--white);
  color: var(--text2); font-size: 13px; font-family: inherit;
  cursor: pointer; margin: 4px 0 0; transition: all .15s;
}
.retry-btn:active { background: var(--gray2); }

/* ── 프로필 탭 ── */
.profile-header {
  background: linear-gradient(135deg, var(--mint) 0%, #6bbfad 100%);
  padding: 24px 20px 28px;
  margin-bottom: -12px;
}
.profile-header .ph-label { font-size: 11px; color: rgba(255,255,255,.8); letter-spacing: 1px; }
.profile-header .ph-point {
  font-family: 'DM Serif Display', serif;
  font-size: 42px; color: #fff; letter-spacing: -1px; margin-top: 4px;
}
.profile-header .ph-sub { font-size: 12px; color: rgba(255,255,255,.75); margin-top: 4px; }

.profile-card {
  background: var(--white); border-radius: var(--radius-lg);
  padding: 20px; margin: 0 16px 12px;
  box-shadow: var(--shadow-sm);
}
.profile-card h3 { font-size: 13px; font-weight: 700; margin-bottom: 14px; color: var(--text); }

.p-label { font-size: 11px; color: var(--text2); margin-bottom: 6px; letter-spacing: .5px; }
.p-select {
  width: 100%; padding: 11px 14px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--gray3); background: var(--gray1);
  font-size: 14px; color: var(--text); font-family: inherit; margin-bottom: 14px;
  appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238a8f9a' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
}

.style-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }
.s-chip {
  padding: 7px 14px; border-radius: 99px;
  border: 1.5px solid var(--gray3); background: var(--white);
  color: var(--text2); font-size: 12px; cursor: pointer;
  font-family: inherit; transition: all .15s;
}
.s-chip.sel { background: var(--mint); color: #fff; border-color: var(--mint); }

.save-btn {
  width: 100%; padding: 14px; border-radius: var(--radius-md);
  border: none; background: var(--mint); color: #fff;
  font-size: 14px; font-family: inherit; font-weight: 700;
  cursor: pointer; transition: background .15s;
}
.save-btn:active { background: #6bbfad; }

.info-card {
  background: var(--mint-light); border-radius: var(--radius-lg);
  padding: 18px 20px; margin: 0 16px 12px;
}
.info-card h3 { font-size: 13px; font-weight: 700; color: var(--mint); margin-bottom: 10px; }
.info-card ol { padding-left: 16px; }
.info-card li { font-size: 12px; color: var(--text2); line-height: 2; }

/* ── 메시지 ── */
.toast {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
  background: var(--dark); color: #fff; padding: 10px 20px;
  border-radius: 99px; font-size: 13px; z-index: 200;
  opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap;
}
.toast.show { opacity: 1; }
.err-box {
  margin: 12px 16px; background: #fff5f5; border: 1px solid #fca5a5;
  border-radius: var(--radius-sm); padding: 12px 14px;
  font-size: 13px; color: #b91c1c;
}

/* ── 하단 탭바 ── */
.tab-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px;
  background: var(--white); border-top: 1px solid var(--gray2);
  display: flex; z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.tab-btn {
  flex: 1; padding: 10px 4px 12px; border: none; background: none;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; transition: all .15s;
}
.tab-btn .t-icon { font-size: 22px; line-height: 1; }
.tab-btn .t-label { font-size: 10px; color: var(--gray4); font-family: inherit; font-weight: 500; }
.tab-btn.active .t-icon  { transform: scale(1.1); }
.tab-btn.active .t-label { color: var(--mint); font-weight: 700; }

/* 업로드 인풋 숨김 */
#wFileInput { display: none; }

/* DB 상태 */
.db-pill {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--gray2); border-radius: 99px;
  padding: 4px 10px; font-size: 10px; color: var(--gray4);
  margin: 0 20px 12px;
}
.db-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mint); }

/* ── 캘린더 탭 ── */
.cal-header {
  background: var(--white);
  padding: 16px 20px 0;
  border-bottom: 1px solid var(--gray2);
  position: sticky; top: 57px; z-index: 40;
}
.cal-nav {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.cal-nav .cal-title {
  font-family: 'DM Serif Display', serif;
  font-size: 20px; color: var(--dark);
}
.cal-nav-btn {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 16px; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all .15s; color: var(--text2);
}
.cal-nav-btn:active { background: var(--mint-light); border-color: var(--mint); }
.cal-dow {
  display: grid; grid-template-columns: repeat(7,1fr);
  text-align: center; padding-bottom: 8px;
}
.cal-dow span { font-size: 11px; color: var(--gray4); font-weight: 600; padding: 4px 0; }
.cal-dow span:first-child { color: #e05c5c; }
.cal-dow span:last-child  { color: #5c8be0; }
.cal-grid {
  display: grid; grid-template-columns: repeat(7,1fr);
  padding: 10px 16px 0; gap: 2px 0;
}
.cal-day {
  aspect-ratio: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  padding-top: 5px; cursor: pointer; border-radius: 12px;
  position: relative; transition: background .12s;
}
.cal-day:hover { background: var(--mint-light); }
.cal-day .d-num {
  font-size: 13px; line-height: 1; font-weight: 500; color: var(--text);
}
.cal-day.sun .d-num { color: #e05c5c; }
.cal-day.sat .d-num { color: #5c8be0; }
.cal-day.other .d-num { color: var(--gray3); }
.cal-day.today .d-num {
  background: var(--mint); color: #fff;
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.cal-day.selected { background: var(--mint-light); }
.cal-day .d-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--mint); margin-top: 3px;
}
.cal-events-wrap { padding: 16px; }
.cal-date-label {
  font-size: 13px; font-weight: 700; color: var(--text);
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
}
.cal-date-label .dl-badge {
  font-size: 11px; color: var(--mint); background: var(--mint-light);
  padding: 2px 10px; border-radius: 99px; font-weight: 600;
}
.event-item {
  background: var(--white); border-radius: var(--radius-md);
  padding: 14px 16px; margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
  display: flex; align-items: flex-start; gap: 12px;
  animation: fadeUp .2s ease;
}
.event-dot {
  width: 10px; height: 10px; border-radius: 50%;
  margin-top: 4px; flex-shrink: 0;
}
.event-content { flex: 1; }
.event-title { font-size: 14px; font-weight: 600; color: var(--text); }
.event-time  { font-size: 11px; color: var(--text2); margin-top: 3px; }
.event-tpo   {
  display: inline-block; font-size: 10px; margin-top: 5px;
  background: var(--mint-light); color: var(--mint);
  padding: 2px 9px; border-radius: 99px; font-weight: 600;
}
.event-del {
  border: none; background: none; color: var(--gray3);
  font-size: 18px; cursor: pointer; padding: 0 2px;
  transition: color .15s; line-height: 1;
}
.event-del:hover { color: #e05c5c; }
.cal-empty {
  text-align: center; padding: 28px; color: var(--gray4);
  font-size: 13px; background: var(--white);
  border-radius: var(--radius-md); border: 1.5px dashed var(--gray3);
}
.cal-fab {
  position: fixed; bottom: 90px;
  right: max(16px, calc(50vw - 215px + 16px));
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--dark); color: #fff; border: none;
  font-size: 26px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
  display: none; align-items: center; justify-content: center;
  z-index: 60; transition: transform .15s;
}
.cal-fab:active { transform: scale(.93); }
.cal-fab.show { display: flex; }
/* ── 추천 탭 날짜 선택 & 일정 연동 ── */
/* 날짜 선택 버튼 (추천 탭) */
.rec-date-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--white); border: 1.5px solid var(--gray3);
  border-radius: var(--radius-sm); padding: 9px 14px;
  cursor: pointer; font-family: inherit; transition: all .15s;
  width: 100%;
}
.rec-date-btn:active { border-color: var(--mint); }
.rec-date-btn .rdb-icon  { font-size: 16px; }
.rec-date-btn .rdb-text  { flex: 1; font-size: 13px; font-weight: 600; color: var(--text); text-align: left; }
.rec-date-btn .rdb-badge {
  font-size: 10px; background: var(--mint); color: #fff;
  padding: 2px 8px; border-radius: 99px; font-weight: 700;
}
.rec-date-btn .rdb-badge.today { background: var(--dark); }

/* 팝업 캘린더 모달 */
.cal-popup-backdrop {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,.45); z-index: 200;
  align-items: flex-end; justify-content: center;
}
.cal-popup-backdrop.open { display: flex; }
.cal-popup-sheet {
  background: var(--white); border-radius: 24px 24px 0 0;
  padding: 20px 16px 40px; width: 100%; max-width: 430px;
  animation: slideUp .25s ease;
}
.cal-popup-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--gray3); margin: 0 auto 16px;
}
.cal-popup-nav {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.cal-popup-title {
  font-family: 'DM Serif Display', serif;
  font-size: 18px; color: var(--dark);
}
.cal-popup-nav-btn {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 15px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; color: var(--text2);
}
.cal-popup-dow {
  display: grid; grid-template-columns: repeat(7,1fr);
  text-align: center; margin-bottom: 4px;
}
.cal-popup-dow span { font-size: 11px; color: var(--gray4); font-weight: 600; padding: 3px 0; }
.cal-popup-dow span:first-child { color: #e05c5c; }
.cal-popup-dow span:last-child  { color: #5c8be0; }
.cal-popup-grid {
  display: grid; grid-template-columns: repeat(7,1fr); gap: 2px 0;
}
.cal-popup-day {
  aspect-ratio: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer; border-radius: 10px;
  position: relative; transition: background .12s;
}
.cal-popup-day:hover { background: var(--mint-light); }
.cal-popup-day .pd-num { font-size: 13px; font-weight: 500; color: var(--text); }
.cal-popup-day.pd-sun .pd-num { color: #e05c5c; }
.cal-popup-day.pd-sat .pd-num { color: #5c8be0; }
.cal-popup-day.pd-other .pd-num { color: var(--gray3); }
.cal-popup-day.pd-today .pd-num {
  background: var(--mint); color: #fff;
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.cal-popup-day.pd-sel { background: var(--dark); border-radius: 10px; }
.cal-popup-day.pd-sel .pd-num { color: #fff; }
.cal-popup-day .pd-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--mint); position: absolute; bottom: 3px;
}
.cal-popup-day.pd-sel .pd-dot { background: var(--mint-mid); }
.cal-popup-confirm {
  width: 100%; margin-top: 14px; padding: 13px;
  border-radius: var(--radius-md); border: none;
  background: var(--dark); color: #fff;
  font-size: 14px; font-family: inherit; font-weight: 700;
  cursor: pointer;
}
.cal-popup-confirm:active { background: #0a0a1a; }

/* 코디 저장 버튼 */
.save-outfit-btn {
  width: 100%; padding: 13px; border-radius: var(--radius-md);
  border: 1.5px solid var(--mint); background: var(--mint-light);
  color: var(--mint); font-size: 13px; font-family: inherit;
  font-weight: 700; cursor: pointer; margin-top: 8px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .15s;
}
.save-outfit-btn:active { background: var(--mint); color: #fff; }
.save-outfit-btn.saved {
  background: var(--mint); color: #fff; pointer-events: none;
}

/* 캘린더 저장 코디 표시 */
.cal-outfit-card {
  background: var(--white); border-radius: var(--radius-md);
  border: 1.5px solid var(--mint-mid); padding: 12px 14px;
  margin-top: 10px; box-shadow: var(--shadow-sm);
}
.cal-outfit-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--mint);
  letter-spacing: .5px; margin-bottom: 8px;
}
.cal-outfit-style {
  font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px;
}
.cal-outfit-desc {
  font-size: 12px; color: var(--text2); line-height: 1.6; font-style: italic;
}
.cal-outfit-items {
  display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
}
.cal-outfit-item-pill {
  font-size: 11px; background: var(--mint-light); color: var(--mint);
  padding: 4px 10px; border-radius: 99px; font-weight: 600;
}
.cal-outfit-del {
  font-size: 11px; color: var(--gray4); cursor: pointer;
  margin-top: 8px; display: inline-block;
  border: none; background: none; font-family: inherit; padding: 0;
}

.cal-linked-card {
  background: var(--mint-light); border-radius: var(--radius-md);
  border: 1.5px solid var(--mint-mid);
  padding: 12px 14px; margin-bottom: 14px;
}
.cal-linked-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--mint);
  letter-spacing: .5px; margin-bottom: 8px;
}
.cal-linked-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 7px 0; border-bottom: 1px solid var(--mint-mid);
}
.cal-linked-item:last-child { border-bottom: none; padding-bottom: 0; }
.cal-linked-dot {
  width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; flex-shrink: 0;
}
.cal-linked-info { flex: 1; }
.cal-linked-title { font-size: 13px; font-weight: 600; color: var(--text); }
.cal-linked-sub   { font-size: 11px; color: var(--text2); margin-top: 2px; }
.cal-linked-tpo {
  font-size: 10px; background: var(--mint); color: #fff;
  padding: 2px 8px; border-radius: 99px; font-weight: 600;
  white-space: nowrap;
}
.cal-use-btn {
  width: 100%; padding: 10px; border-radius: var(--radius-sm);
  border: none; background: var(--mint); color: #fff;
  font-size: 12px; font-family: inherit; font-weight: 700;
  cursor: pointer; margin-top: 10px; transition: background .15s;
}
.cal-use-btn:active { background: #6bbfad; }
.cal-no-event {
  font-size: 12px; color: var(--text2); text-align: center;
  padding: 6px 0 2px;
}

/* 오전/오후 시간 선택 */
.time-optional-row {
  margin-bottom: 12px;
}
.time-toggle-btn {
  font-size: 12px; color: var(--mint); background: var(--mint-light);
  border: none; border-radius: 99px; padding: 5px 12px;
  cursor: pointer; font-family: inherit; font-weight: 600; margin-bottom: 10px;
}
.time-picker-wrap { display: none; }
.time-picker-wrap.open { display: block; }
.ampm-row { display: flex; gap: 8px; margin-bottom: 8px; }
.ampm-btn {
  flex: 1; padding: 9px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 13px; font-family: inherit; cursor: pointer;
  transition: all .15s; color: var(--text2);
}
.ampm-btn.sel { background: var(--mint); color: #fff; border-color: var(--mint); }
.hour-scroll {
  display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
  margin-bottom: 8px;
}
.hour-scroll::-webkit-scrollbar { display: none; }
.hour-chip {
  flex-shrink: 0; padding: 7px 10px; border-radius: 10px;
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 12px; cursor: pointer; font-family: inherit;
  transition: all .15s; color: var(--text2); min-width: 38px;
  text-align: center;
}
.hour-chip.sel { background: var(--mint); color: #fff; border-color: var(--mint); }
.time-display {
  font-size: 12px; color: var(--mint); font-weight: 600;
  background: var(--mint-light); padding: 6px 12px;
  border-radius: 8px; display: inline-block;
}

.modal-backdrop {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,.45); z-index: 150;
  align-items: flex-end; justify-content: center;
}
.modal-backdrop.open { display: flex; }
.modal-sheet {
  background: var(--white); border-radius: 24px 24px 0 0;
  padding: 24px 20px 44px; width: 100%; max-width: 430px;
  animation: slideUp .25s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.modal-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--gray3); margin: 0 auto 20px;
}
.modal-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 18px; }
.modal-input {
  width: 100%; padding: 12px 14px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--gray3); background: var(--gray1);
  font-size: 14px; color: var(--text); font-family: inherit;
  margin-bottom: 12px;
}
.modal-input:focus { outline: none; border-color: var(--mint); background: var(--white); }
.modal-row { display: flex; gap: 10px; margin-bottom: 12px; }
.modal-row .modal-input { margin-bottom: 0; }
.modal-tpo-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
.modal-tpo-chip {
  padding: 6px 13px; border-radius: 99px;
  border: 1.5px solid var(--gray3); background: var(--white);
  font-size: 12px; color: var(--text2); cursor: pointer;
  font-family: inherit; transition: all .15s;
}
.modal-tpo-chip.sel { background: var(--mint); color: #fff; border-color: var(--mint); }
.color-row { display: flex; gap: 10px; margin-bottom: 20px; }
.color-dot-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid transparent; cursor: pointer; transition: border-color .12s;
}
.color-dot-btn.sel { border-color: var(--dark); }
.modal-save-btn {
  width: 100%; padding: 14px; border-radius: var(--radius-md);
  border: none; background: var(--mint); color: #fff;
  font-size: 14px; font-family: inherit; font-weight: 700; cursor: pointer;
}
.modal-save-btn:active { background: #6bbfad; }
</style>
</head>
<body>

<!-- 상단 바 -->
<div class="top-bar">
  <div class="logo">Look<span>at</span>Life</div>
  <button class="icon-btn" id="notif-btn">🔔</button>
</div>

<!-- ════════════ 홈 탭 ════════════ -->
<div id="page-home" class="page active">
  <!-- 날씨 카드 -->
  <div class="weather-card" id="home-weather">
    <div>
      <div class="temp" id="home-temp">--<sup>°</sup></div>
      <div class="meta">
        <b id="home-city">Seoul</b>
        <span id="home-desc">날씨 불러오는 중...</span>
      </div>
    </div>
    <div class="wx-icon" id="home-wx-icon">🌤️</div>
  </div>

  <!-- 오늘의 추천 미리보기 -->
  <div class="sec-header">
    <h2>오늘의 코디</h2>
    <a onclick="switchTab('recommend')">추천받기 →</a>
  </div>
  <div class="today-card" id="today-preview" onclick="switchTab('recommend')">
    <div class="tc-header">
      <span class="tc-label">Today's Look</span>
      <span class="tc-badge" id="today-tpo">일상·캐주얼</span>
    </div>
    <div class="tc-body">
      <div class="tc-style" id="today-style">코디 추천을 받아보세요</div>
      <div class="tc-desc"  id="today-desc" >추천 탭에서 TPO를 선택하고 AI 코디를 받아보세요.</div>
    </div>
    <div class="tc-items" id="today-items"></div>
  </div>

  <!-- 내 옷장 미리보기 -->
  <div class="sec-header">
    <h2>My Room</h2>
    <a onclick="switchTab('wardrobe')">전체보기 →</a>
  </div>
  <div class="wardrobe-scroll" id="home-wardrobe-grid"></div>
</div>

<!-- ════════════ 옷장 탭 ════════════ -->
<div id="page-wardrobe" class="page">
  <div class="sec-header" style="padding-top:20px;">
    <h2>My Room &nbsp;<span style="font-size:12px;color:var(--gray4);font-weight:400;" id="w-count-label">0개</span></h2>
    <a onclick="document.getElementById('wFileInput').click()">+ 추가</a>
  </div>
  <input type="file" id="wFileInput" accept="image/*" multiple onchange="addPhotos(this)">
  <div class="wardrobe-scroll" id="wardrobe-grid"></div>
</div>

<!-- ════════════ 캘린더 탭 ════════════ -->
<div id="page-calendar" class="page">
  <div class="cal-header">
    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="changeMonth(-1)">&#8249;</button>
      <div class="cal-title" id="cal-title"></div>
      <button class="cal-nav-btn" onclick="changeMonth(1)">&#8250;</button>
    </div>
    <div class="cal-dow">
      <span>일</span><span>월</span><span>화</span>
      <span>수</span><span>목</span><span>금</span><span>토</span>
    </div>
  </div>
  <div class="cal-grid" id="cal-grid"></div>
  <div class="cal-events-wrap">
    <div class="cal-date-label" id="cal-date-label">날짜를 선택하세요</div>
    <div id="cal-events-list"></div>
    <!-- 저장된 코디 -->
    <div id="cal-outfit-wrap"></div>
  </div>
</div>

<button class="cal-fab" id="cal-fab" onclick="openModal()">+</button>

<div class="modal-backdrop" id="modal-backdrop" onclick="closeModalOutside(event)">
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">일정 추가</div>
    <input class="modal-input" id="ev-title" placeholder="일정 제목" type="text">

    <!-- 시간 (선택사항) -->
    <div class="time-optional-row">
      <button class="time-toggle-btn" id="time-toggle-btn" onclick="toggleTimePicker()">+ 시간 추가 (선택)</button>
      <div class="time-picker-wrap" id="time-picker-wrap">
        <!-- 시작 시간 -->
        <div style="font-size:11px;color:var(--text2);margin-bottom:6px;font-weight:600;">시작 시간</div>
        <div class="ampm-row">
          <button class="ampm-btn sel" id="start-am" onclick="setAmPm('start','am')">오전</button>
          <button class="ampm-btn"     id="start-pm" onclick="setAmPm('start','pm')">오후</button>
        </div>
        <div class="hour-scroll" id="start-hours"></div>
        <!-- 종료 시간 -->
        <div style="font-size:11px;color:var(--text2);margin:8px 0 6px;font-weight:600;">종료 시간 (선택)</div>
        <div class="ampm-row">
          <button class="ampm-btn sel" id="end-am" onclick="setAmPm('end','am')">오전</button>
          <button class="ampm-btn"     id="end-pm" onclick="setAmPm('end','pm')">오후</button>
        </div>
        <div class="hour-scroll" id="end-hours"></div>
        <div style="margin-top:8px;">
          <span class="time-display" id="time-preview">오전 9:00</span>
        </div>
      </div>
    </div>

    <input class="modal-input" id="ev-memo" placeholder="메모 (선택)" type="text">
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:600;letter-spacing:.5px;">TPO 태그</div>
    <div class="modal-tpo-chips">
      <button class="modal-tpo-chip sel" onclick="pickModalTPO(this)">일상·캐주얼</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">데이트</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">직장·출근</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">결혼식</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">캠핑·야외</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">파티</button>
      <button class="modal-tpo-chip"     onclick="pickModalTPO(this)">운동</button>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:600;letter-spacing:.5px;">색상</div>
    <div class="color-row" id="color-row">
      <div class="color-dot-btn sel" style="background:#8ecfc0" onclick="pickColor(this,'#8ecfc0')"></div>
      <div class="color-dot-btn"    style="background:#e07b7b" onclick="pickColor(this,'#e07b7b')"></div>
      <div class="color-dot-btn"    style="background:#7b9ee0" onclick="pickColor(this,'#7b9ee0')"></div>
      <div class="color-dot-btn"    style="background:#e0c27b" onclick="pickColor(this,'#e0c27b')"></div>
      <div class="color-dot-btn"    style="background:#b07be0" onclick="pickColor(this,'#b07be0')"></div>
      <div class="color-dot-btn"    style="background:#1a1a2e" onclick="pickColor(this,'#1a1a2e')"></div>
    </div>
    <button class="modal-save-btn" onclick="saveEvent()">저장하기</button>
  </div>
</div>


<!-- ════════════ 추천 탭 ════════════ -->
<div id="page-recommend" class="page">
  <div class="rec-top">
    <!-- 날씨 미니 -->
    <div class="rec-weather-mini">
      <span class="mini-temp" id="rec-temp">--°</span>
      <span id="rec-desc" style="color:var(--text2);font-size:13px;">Seoul</span>
    </div>

    <!-- 추천 방식 -->
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:600;letter-spacing:.5px;">추천 방식</div>
    <div class="mode-row">
      <button class="mode-pill active" id="mode-rag"   onclick="setMode('rag')">RAG · 필터 우선</button>
      <button class="mode-pill"        id="mode-blind" onclick="setMode('blind')">AI 독립 생성</button>
    </div>
    <div class="mode-hint" id="mode-hint">날씨 기준으로 옷장을 먼저 걸러낸 뒤 AI에 전달합니다. 토큰을 줄이면서 내 옷 위주로 코디가 구성됩니다.</div>

    <!-- 날짜 선택 버튼 -->
    <div style="font-size:11px;color:var(--text2);margin:14px 0 8px;font-weight:600;letter-spacing:.5px;">날짜 선택</div>
    <button class="rec-date-btn" id="rec-date-btn" onclick="openCalPopup()">
      <span class="rdb-icon">📅</span>
      <span class="rdb-text" id="rec-date-text">오늘</span>
      <span class="rdb-badge today" id="rec-date-badge">오늘</span>
    </button>
  </div>

  <!-- 팝업 캘린더 -->
  <div class="cal-popup-backdrop" id="cal-popup-backdrop" onclick="closeCalPopupOutside(event)">
    <div class="cal-popup-sheet">
      <div class="cal-popup-handle"></div>
      <div class="cal-popup-nav">
        <button class="cal-popup-nav-btn" onclick="popupChangeMonth(-1)">&#8249;</button>
        <div class="cal-popup-title" id="cal-popup-title"></div>
        <button class="cal-popup-nav-btn" onclick="popupChangeMonth(1)">&#8250;</button>
      </div>
      <div class="cal-popup-dow">
        <span>일</span><span>월</span><span>화</span>
        <span>수</span><span>목</span><span>금</span><span>토</span>
      </div>
      <div class="cal-popup-grid" id="cal-popup-grid"></div>
      <button class="cal-popup-confirm" onclick="confirmCalPopup()">이 날짜로 코디 추천받기</button>
    </div>
  </div>

  <!-- 캘린더 연동 일정 카드 -->
  <div id="cal-linked-wrap" style="padding:12px 16px 0; display:none;">
    <div class="cal-linked-card">
      <div class="cal-linked-header">
        <span>📅</span> 이 날의 일정
      </div>
      <div id="cal-linked-events"></div>
      <button class="cal-use-btn" onclick="applyLinkedTPO()">이 일정 TPO로 추천받기</button>
    </div>
  </div>

  <!-- TPO -->
  <div class="tpo-scroll">
    <button class="tpo-chip sel" onclick="pickTPO(this)">일상·캐주얼</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">데이트</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">직장·출근</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">결혼식</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">캠핑·야외</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">파티</button>
    <button class="tpo-chip"     onclick="pickTPO(this)">운동</button>
  </div>

  <div class="db-pill" id="db-status-pill">
    <span class="db-dot"></span>
    <span id="db-status-text">DB 로드 중...</span>
  </div>

  <button class="rec-btn" onclick="recommend()">
    <span>✦</span> AI 코디 추천받기
  </button>

  <!-- 로딩 -->
  <div class="loading-box" id="r-loading">
    <div class="loader"></div>
    <p id="r-loading-msg">AI가 코디를 만들고 있어요...</p>
  </div>

  <!-- 에러 -->
  <div id="r-err"></div>

  <!-- 결과 -->
  <div class="result-wrap" id="r-result">
    <!-- 히어로 카드 -->
    <div class="result-hero">
      <div class="result-hero-head">
        <div>
          <div class="rh-label">AI Recommendation</div>
          <div class="rh-style" id="r-style">—</div>
        </div>
        <span class="rh-badge" id="r-mode-badge">RAG</span>
      </div>
      <div class="result-desc" id="r-desc"></div>
      <div class="composed-wrap" id="composed-wrap" style="display:none">
        <img id="r-composed" src="" alt="코디 조합">
      </div>
    </div>

    <!-- 매칭 아이템 -->
    <div class="match-section">
      <div class="ms-title">내 옷장 매칭</div>
      <div class="match-grid" id="r-items"></div>
    </div>

    <!-- 참고 스타일 -->
    <div class="ref-section" id="r-ref-section" style="display:none">
      <div class="ms-title">참고 스타일</div>
      <div class="ref-grid" id="r-refs"></div>
    </div>

    <button class="save-outfit-btn" id="save-outfit-btn" onclick="saveOutfitToDate()">
      <span>💾</span> 이 날짜에 코디 저장
    </button>
    <button class="retry-btn" onclick="recommend()">↺ 다시 추천받기</button>
  </div>
</div>

<!-- ════════════ 프로필 탭 ════════════ -->
<div id="page-profile" class="page">
  <div class="profile-header">
    <div class="ph-label">MY POINT</div>
    <div class="ph-point">8,000</div>
    <div class="ph-sub">의류 기부하고 포인트 받으세요!</div>
  </div>

  <div class="profile-card" style="margin-top:24px;">
    <h3>기본 프로필</h3>
    <div class="p-label">연령대</div>
    <select id="p-age" class="p-select">
      <option>10대</option><option selected>20대</option>
      <option>30대</option><option>40대</option><option>50대 이상</option>
    </select>
    <div class="p-label">성별</div>
    <select id="p-gender" class="p-select">
      <option selected>여성</option><option>남성</option>
    </select>
    <div class="p-label" style="margin-bottom:8px;">선호 스타일</div>
    <div class="style-chips" id="style-chips">
      <button class="s-chip sel" onclick="pickStyle(this)">캐주얼</button>
      <button class="s-chip"     onclick="pickStyle(this)">포멀</button>
      <button class="s-chip"     onclick="pickStyle(this)">비즈니스</button>
      <button class="s-chip"     onclick="pickStyle(this)">러블리</button>
      <button class="s-chip"     onclick="pickStyle(this)">페미닌</button>
      <button class="s-chip"     onclick="pickStyle(this)">스포티</button>
      <button class="s-chip"     onclick="pickStyle(this)">컴포트</button>
    </div>
    <button class="save-btn" onclick="saveProfile()">저장하기</button>
  </div>

  <div class="info-card">
    <h3>사용 안내</h3>
    <ol>
      <li>프로필을 저장하세요</li>
      <li>My Room에 옷 사진을 업로드하세요</li>
      <li>추천 탭에서 TPO를 선택하고 코디를 받아보세요</li>
      <li>RAG 방식은 날씨 기준 필터 후 AI 전달</li>
      <li>AI 독립 방식은 이상적 코디 생성 후 내 옷과 매칭</li>
    </ol>
  </div>
</div>

<!-- 하단 탭바 -->
<div class="tab-bar">
  <button class="tab-btn active" id="tab-home"      onclick="switchTab('home')">
    <span class="t-icon">🏠</span><span class="t-label">홈</span>
  </button>
  <button class="tab-btn"        id="tab-calendar"  onclick="switchTab('calendar')">
    <span class="t-icon">📅</span><span class="t-label">캘린더</span>
  </button>
  <button class="tab-btn"        id="tab-wardrobe"  onclick="switchTab('wardrobe')">
    <span class="t-icon">👗</span><span class="t-label">My Room</span>
  </button>
  <button class="tab-btn"        id="tab-recommend" onclick="switchTab('recommend')">
    <span class="t-icon">✦</span><span class="t-label">코디추천</span>
  </button>
  <button class="tab-btn"        id="tab-profile"   onclick="switchTab('profile')">
    <span class="t-icon">👤</span><span class="t-label">프로필</span>
  </button>
</div>

<!-- 토스트 -->
<div class="toast" id="toast"></div>

<script>
// ── 탭 전환 ──────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'home')      { loadHomeData(); }
  if (name === 'wardrobe')  { renderWardrobe(); }
  if (name === 'recommend') { loadRecWeather(); loadDbStatus(); updateRecDateBtn(); renderLinkedEvents(); }
  if (name === 'calendar')  { renderCalendar(); }
  // FAB: 캘린더 탭일 때만 표시
  const fab = document.getElementById('cal-fab');
  if (fab) fab.classList.toggle('show', name === 'calendar');
}

// ── 날씨 ─────────────────────────────────────
const WX_ICON = {
  '맑음':'☀️','구름':'⛅','흐림':'☁️','비':'🌧️','눈':'❄️','안개':'🌫️'
};
function wxIcon(desc) {
  for (const [k,v] of Object.entries(WX_ICON)) if (desc.includes(k)) return v;
  return '🌤️';
}
async function loadHomeData() {
  const res = await fetch('/get_weather');
  const d   = await res.json();
  document.getElementById('home-temp').innerHTML = d.temp + '<sup>°</sup>';
  document.getElementById('home-desc').textContent = d.desc;
  document.getElementById('home-wx-icon').textContent = wxIcon(d.desc);
  renderHomeWardrobe();
}
async function loadRecWeather() {
  const res = await fetch('/get_weather');
  const d   = await res.json();
  document.getElementById('rec-temp').textContent = d.temp + '°';
  document.getElementById('rec-desc').textContent = d.desc;
}
async function loadDbStatus() {
  const res = await fetch('/db_status');
  const d   = await res.json();
  document.getElementById('db-status-text').textContent =
    `공개 DB ${d.public_count}장 · 내 옷장 ${d.wardrobe_count}개`;
}

// ── 홈 옷장 미리보기 (최근 6개) ──────────────
async function renderHomeWardrobe() {
  const res  = await fetch('/get_wardrobe');
  const data = await res.json();
  const grid = document.getElementById('home-wardrobe-grid');
  const show = data.slice(-6).reverse();
  if (!show.length) {
    grid.innerHTML = '<div class="w-empty-full">옷장이 비어 있어요.<br>My Room에서 옷을 추가해보세요!</div>';
    return;
  }
  grid.innerHTML = show.map(item => `
    <div class="w-card">
      ${item.image
        ? `<img src="${item.image}" alt="${item.type}">`
        : `<div class="no-img-box">${item.color} ${item.type}</div>`}
      <div class="w-overlay">
        <div class="w-cat">${item.category || ''}</div>
        <div class="w-name">${item.color || ''} ${item.type || ''}</div>
      </div>
    </div>`).join('');
}

// ── 옷장 전체 렌더링 ──────────────────────────
async function renderWardrobe() {
  const res  = await fetch('/get_wardrobe');
  const data = await res.json();
  document.getElementById('w-count-label').textContent = data.length + '개';
  const grid = document.getElementById('wardrobe-grid');
  const cards = data.map((item, i) => `
    <div class="w-card">
      ${item.image
        ? `<img src="${item.image}" alt="${item.type}">`
        : `<div class="no-img-box">${item.color} ${item.type}</div>`}
      <button class="w-del" onclick="deleteItem(${i})">×</button>
      <div class="w-overlay">
        <div class="w-cat">${item.category || ''}</div>
        <div class="w-name">${item.color || ''} ${item.type || ''}</div>
      </div>
    </div>`).join('');
  grid.innerHTML = `
    <div class="w-add-card" onclick="document.getElementById('wFileInput').click()">
      <div class="w-add-icon">+</div>
      <span>옷 추가</span>
    </div>` + (cards || '<div class="w-empty-full" style="grid-column:2/-1;">아직 등록된 옷이 없어요.</div>');
}

async function addPhotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  showToast(`${files.length}장 분석 중...`);
  for (const file of files) {
    const b64 = await readFile(file);
    const res = await fetch('/add_wardrobe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({image: b64, filename: file.name})
    });
    const d = await res.json();
    if (d.error) { showToast('오류: ' + d.error); return; }
  }
  showToast(files.length + '장 추가 완료!');
  input.value = '';
  renderWardrobe();
}

function readFile(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
}

async function deleteItem(idx) {
  await fetch('/delete_wardrobe', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({index: idx})
  });
  renderWardrobe();
}

// ── 모드 선택 ─────────────────────────────────
let currentMode = 'rag';
function setMode(m) {
  currentMode = m;
  document.getElementById('mode-rag').classList.toggle('active',   m === 'rag');
  document.getElementById('mode-blind').classList.toggle('active', m === 'blind');
  document.getElementById('mode-hint').textContent = m === 'rag'
    ? '날씨 기준으로 옷장을 먼저 걸러낸 뒤 AI에 전달합니다. 토큰을 줄이면서 내 옷 위주로 코디가 구성됩니다.'
    : 'AI가 옷장 없이 이상적 코디를 먼저 생성합니다. 이후 내 옷장에서 CLIP으로 유사한 옷을 로컬 매칭합니다.';
}

// ── TPO ───────────────────────────────────────
function pickTPO(el) {
  document.querySelectorAll('.tpo-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}

// ── 추천 ──────────────────────────────────────
async function recommend() {
  const wardrobe = await (await fetch('/get_wardrobe')).json();
  if (!wardrobe.length) {
    document.getElementById('r-err').innerHTML =
      '<div class="err-box">My Room에 옷을 먼저 등록해주세요.</div>';
    return;
  }
  const tpo = document.querySelector('.tpo-chip.sel')?.textContent || '일상·캐주얼';
  document.getElementById('r-result').style.display  = 'none';
  document.getElementById('r-loading').style.display = 'block';
  // 저장 버튼 리셋
  const saveBtn = document.getElementById('save-outfit-btn');
  if (saveBtn) { saveBtn.classList.remove('saved'); saveBtn.innerHTML = '<span>💾</span> 이 날짜에 코디 저장'; }
  document.getElementById('r-loading-msg').textContent =
    currentMode === 'rag' ? '옷장에서 후보를 필터링한 뒤 AI에 전달 중...' : 'AI가 이상적 코디를 생성 중...';
  document.getElementById('r-err').innerHTML = '';

  try {
    // 선택된 날짜의 캘린더 일정 수집
    const selDateKey = recSelectedDate;
    const linkedEvents = selDateKey ? (JSON.parse(localStorage.getItem('cal_events') || '{}')[selDateKey] || []) : [];
    const res  = await fetch('/recommend', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({tpo, mode: currentMode, date: selDateKey, linked_events: linkedEvents})
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // 홈 미리보기 업데이트
    document.getElementById('today-tpo').textContent   = tpo;
    document.getElementById('today-style').textContent = data.outfit.style || '—';
    document.getElementById('today-desc').textContent  = data.outfit.description || '';

    // 추천 결과 보관 (코디 저장용)
    lastOutfitData = data;
    // 모드 배지
    const badge = document.getElementById('r-mode-badge');
    badge.textContent = currentMode === 'rag' ? 'RAG' : 'AI 독립';

    document.getElementById('r-style').textContent = data.outfit.style || '—';
    document.getElementById('r-desc').textContent  = data.outfit.description || '';

    // 합성 이미지
    if (data.composed_image) {
      document.getElementById('r-composed').src = 'data:image/png;base64,' + data.composed_image;
      document.getElementById('composed-wrap').style.display = 'block';
    } else {
      document.getElementById('composed-wrap').style.display = 'none';
    }

    // 매칭 아이템
    const itemsEl = document.getElementById('r-items');
    if (data.matched_items?.length) {
      itemsEl.innerHTML = data.matched_items.map(item => `
        <div class="m-card">
          ${item.image
            ? `<img src="${item.image}" alt="${item.type}">`
            : `<div class="no-img-box">${item.color} ${item.type}</div>`}
          <div class="mc-info">
            <div class="mc-cat">${item.category}</div>
            <div class="mc-name">${item.color} ${item.type}</div>
            <div class="mc-score">매칭 ${(item.score * 100).toFixed(1)}%</div>
          </div>
        </div>`).join('');
    } else {
      itemsEl.innerHTML = '<div class="mc-empty">내 옷장에서 매칭된 옷이 없습니다.<br>옷을 더 등록해주세요.</div>';
    }

    // 참고 스타일
    const refSec = document.getElementById('r-ref-section');
    const refsEl = document.getElementById('r-refs');
    if (data.ref_items?.length) {
      refSec.style.display = 'block';
      refsEl.innerHTML = data.ref_items.map(item => `
        <div class="r-card">
          <img src="${item.img_url}" alt="${item.article_type}">
          <div class="rc-info">
            <div class="rc-cat">${item.category}</div>
            <div class="rc-name">${item.color} ${item.article_type}</div>
            <div class="rc-label">참고 스타일</div>
          </div>
        </div>`).join('');
    } else {
      refSec.style.display = 'none';
    }

    document.getElementById('r-loading').style.display = 'none';
    document.getElementById('r-result').style.display  = 'block';

  } catch (e) {
    document.getElementById('r-loading').style.display = 'none';
    document.getElementById('r-err').innerHTML = `<div class="err-box">오류: ${e.message}</div>`;
  }
}

// ── 프로필 ────────────────────────────────────
function pickStyle(el) {
  document.querySelectorAll('.s-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}
async function saveProfile() {
  const data = {
    age:    document.getElementById('p-age').value,
    gender: document.getElementById('p-gender').value,
    style:  document.querySelector('#style-chips .s-chip.sel')?.textContent || '캐주얼'
  };
  await fetch('/save_profile', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  showToast('프로필이 저장되었습니다');
}

// ── 토스트 ────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}


// ── 캘린더 ────────────────────────────────────
let calYear, calMonth, calSelectedDate = null;
let calEvents = JSON.parse(localStorage.getItem('cal_events') || '{}');
let selectedColor = '#8ecfc0';

function saveCalEvents() {
  localStorage.setItem('cal_events', JSON.stringify(calEvents));
}

function renderCalendar() {
  const now = new Date();
  if (!calYear)  calYear  = now.getFullYear();
  if (!calMonth) calMonth = now.getMonth();
  drawCalendar();
  if (!calSelectedDate) selectDay(now.getFullYear(), now.getMonth(), now.getDate());
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  drawCalendar();
}

function drawCalendar() {
  const title = document.getElementById('cal-title');
  title.textContent = calYear + '년 ' + (calMonth + 1) + '월';
  const grid  = document.getElementById('cal-grid');
  const today = new Date();
  const first = new Date(calYear, calMonth, 1).getDay();
  const last  = new Date(calYear, calMonth + 1, 0).getDate();
  const prevLast = new Date(calYear, calMonth, 0).getDate();

  let html = '';
  const DOW = ['sun','mon','tue','wed','thu','fri','sat'];
  let cell = 0;

  // 이전 달
  for (let i = first - 1; i >= 0; i--) {
    html += `<div class="cal-day other ${DOW[cell % 7]}"><span class="d-num">${prevLast - i}</span></div>`;
    cell++;
  }
  // 이번 달
  for (let d = 1; d <= last; d++) {
    const dow   = cell % 7;
    const isToday = (calYear === today.getFullYear() && calMonth === today.getMonth() && d === today.getDate());
    const key   = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const hasDot = calEvents[key]?.length > 0;
    const isSel  = calSelectedDate === key;
    html += `<div class="cal-day ${DOW[dow]} ${isToday?'today':''} ${isSel?'selected':''}"
      onclick="selectDay(${calYear},${calMonth},${d})">
      <span class="d-num">${d}</span>
      ${hasDot ? '<span class="d-dot"></span>' : ''}
    </div>`;
    cell++;
  }
  // 다음 달
  let next = 1;
  while (cell % 7 !== 0) {
    html += `<div class="cal-day other ${DOW[cell % 7]}"><span class="d-num">${next++}</span></div>`;
    cell++;
  }
  grid.innerHTML = html;
}

function selectDay(y, m, d) {
  calSelectedDate = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  drawCalendar();
  renderEvents();
  const label = document.getElementById('cal-date-label');
  const cnt   = (calEvents[calSelectedDate] || []).length;
  label.innerHTML = calSelectedDate + (cnt ? ` <span class="dl-badge">${cnt}개</span>` : '');
  renderCalOutfit();
}

function renderEvents() {
  const list   = document.getElementById('cal-events-list');
  const events = calEvents[calSelectedDate] || [];
  if (!events.length) {
    list.innerHTML = '<div class="cal-empty">등록된 일정이 없습니다.<br>+ 버튼으로 일정을 추가해보세요.</div>';
    return;
  }
  list.innerHTML = events.map((ev, i) => `
    <div class="event-item">
      <div class="event-dot" style="background:${ev.color}"></div>
      <div class="event-content">
        <div class="event-title">${ev.title}</div>
        <div class="event-time">${ev.start} – ${ev.end}</div>
        ${ev.tpo ? `<span class="event-tpo">${ev.tpo}</span>` : ''}
        ${ev.memo ? `<div class="event-time" style="margin-top:4px;">${ev.memo}</div>` : ''}
      </div>
      <button class="event-del" onclick="deleteEvent(${i})">&#215;</button>
    </div>`).join('');
}

function deleteEvent(idx) {
  calEvents[calSelectedDate].splice(idx, 1);
  if (!calEvents[calSelectedDate].length) delete calEvents[calSelectedDate];
  saveCalEvents();
  drawCalendar();
  renderEvents();
  const cnt = (calEvents[calSelectedDate] || []).length;
  document.getElementById('cal-date-label').innerHTML =
    calSelectedDate + (cnt ? ` <span class="dl-badge">${cnt}개</span>` : '');
}

function openModal() {
  if (!calSelectedDate) { showToast('날짜를 먼저 선택해주세요'); return; }
  document.getElementById('modal-backdrop').classList.add('open');
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-memo').value  = '';
  // 시간 피커 초기화
  document.getElementById('time-picker-wrap').classList.remove('open');
  document.getElementById('time-toggle-btn').textContent = '+ 시간 추가 (선택)';
  initTimePicker();
  document.querySelectorAll('.modal-tpo-chip').forEach((c,i) => c.classList.toggle('sel', i===0));
  document.querySelectorAll('.color-dot-btn').forEach((c,i) => c.classList.toggle('sel', i===0));
  selectedColor = '#8ecfc0';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-backdrop'))
    document.getElementById('modal-backdrop').classList.remove('open');
}

function pickModalTPO(el) {
  document.querySelectorAll('.modal-tpo-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}

function pickColor(el, color) {
  document.querySelectorAll('.color-dot-btn').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedColor = color;
}

function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) { showToast('일정 제목을 입력해주세요'); return; }
  const isTimeOpen = document.getElementById('time-picker-wrap').classList.contains('open');
  const ev = {
    title,
    start:  isTimeOpen ? getPickedTime('start') : '',
    end:    isTimeOpen ? getPickedTime('end')   : '',
    memo:   document.getElementById('ev-memo').value.trim(),
    tpo:    document.querySelector('.modal-tpo-chip.sel')?.textContent || '',
    color:  selectedColor
  };
  if (!calEvents[calSelectedDate]) calEvents[calSelectedDate] = [];
  calEvents[calSelectedDate].push(ev);
  saveCalEvents();
  document.getElementById('modal-backdrop').classList.remove('open');
  drawCalendar();
  renderEvents();
  const cnt = calEvents[calSelectedDate].length;
  document.getElementById('cal-date-label').innerHTML =
    calSelectedDate + ` <span class="dl-badge">${cnt}개</span>`;
  showToast('일정이 추가되었습니다');
}


// ── 추천 탭 날짜 선택 (팝업 캘린더) ──────────
let recSelectedDate = null;
let popupYear, popupMonth;

function _todayKey() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}

function initRecDate() {
  recSelectedDate = _todayKey();
  updateRecDateBtn();
}

function updateRecDateBtn() {
  const todayKey = _todayKey();
  const isToday  = recSelectedDate === todayKey;
  const badge    = document.getElementById('rec-date-badge');
  const text     = document.getElementById('rec-date-text');
  if (!recSelectedDate || isToday) {
    text.textContent  = '오늘 · ' + formatDateKo(todayKey);
    badge.textContent = '오늘';
    badge.className   = 'rdb-badge today';
  } else {
    text.textContent  = formatDateKo(recSelectedDate);
    badge.textContent = '선택됨';
    badge.className   = 'rdb-badge';
  }
}

function formatDateKo(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const DOWS = ['일','월','화','수','목','금','토'];
  const dow  = DOWS[new Date(y, m-1, d).getDay()];
  return m + '월 ' + d + '일 (' + dow + ')';
}

// ── 팝업 캘린더 ────────────────────────────────
function openCalPopup() {
  const now = new Date();
  popupYear  = now.getFullYear();
  popupMonth = now.getMonth();
  // 이미 선택된 날짜가 있으면 해당 월로
  if (recSelectedDate) {
    const [y, m] = recSelectedDate.split('-').map(Number);
    popupYear = y; popupMonth = m - 1;
  }
  drawPopupCalendar();
  document.getElementById('cal-popup-backdrop').classList.add('open');
}

function closeCalPopupOutside(e) {
  if (e.target === document.getElementById('cal-popup-backdrop'))
    document.getElementById('cal-popup-backdrop').classList.remove('open');
}

function popupChangeMonth(dir) {
  popupMonth += dir;
  if (popupMonth > 11) { popupMonth = 0; popupYear++; }
  if (popupMonth < 0)  { popupMonth = 11; popupYear--; }
  drawPopupCalendar();
}

function drawPopupCalendar() {
  document.getElementById('cal-popup-title').textContent = popupYear + '년 ' + (popupMonth + 1) + '월';
  const grid    = document.getElementById('cal-popup-grid');
  const today   = new Date();
  const first   = new Date(popupYear, popupMonth, 1).getDay();
  const last    = new Date(popupYear, popupMonth + 1, 0).getDate();
  const prevLast = new Date(popupYear, popupMonth, 0).getDate();
  const DOWS    = ['pd-sun','','','','','','pd-sat'];
  const calEvs  = JSON.parse(localStorage.getItem('cal_events') || '{}');
  let html = ''; let cell = 0;

  for (let i = first - 1; i >= 0; i--) {
    const dow = cell % 7 === 0 ? 'pd-sun' : cell % 7 === 6 ? 'pd-sat' : '';
    html += `<div class="cal-popup-day pd-other ${dow}"><span class="pd-num">${prevLast - i}</span></div>`;
    cell++;
  }
  for (let d = 1; d <= last; d++) {
    const dow     = cell % 7;
    const dowCls  = dow === 0 ? 'pd-sun' : dow === 6 ? 'pd-sat' : '';
    const key     = popupYear + '-' + String(popupMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday = (popupYear === today.getFullYear() && popupMonth === today.getMonth() && d === today.getDate());
    const isSel   = recSelectedDate === key;
    const hasDot  = (calEvs[key]?.length > 0);
    html += `<div class="cal-popup-day ${dowCls} ${isToday?'pd-today':''} ${isSel?'pd-sel':''}"
      onclick="popupSelectDay('${key}')">
      <span class="pd-num">${d}</span>
      ${hasDot ? '<span class="pd-dot"></span>' : ''}
    </div>`;
    cell++;
  }
  let next = 1;
  while (cell % 7 !== 0) {
    const dow = cell % 7 === 0 ? 'pd-sun' : cell % 7 === 6 ? 'pd-sat' : '';
    html += `<div class="cal-popup-day pd-other ${dow}"><span class="pd-num">${next++}</span></div>`;
    cell++;
  }
  grid.innerHTML = html;
}

function popupSelectDay(key) {
  recSelectedDate = key;
  drawPopupCalendar();  // 선택 표시 갱신
}

function confirmCalPopup() {
  document.getElementById('cal-popup-backdrop').classList.remove('open');
  updateRecDateBtn();
  renderLinkedEvents();
}

// 날짜 스크롤 관련 구 함수 (호환성 유지용 stub)
function renderRecDateChips() { /* 팝업 방식으로 대체됨 */ }

function renderLinkedEvents() {
  const wrap   = document.getElementById('cal-linked-wrap');
  const list   = document.getElementById('cal-linked-events');
  if (!recSelectedDate) { wrap.style.display = 'none'; return; }
  const events = JSON.parse(localStorage.getItem('cal_events') || '{}')[recSelectedDate] || [];
  if (!events.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = events.map(ev => `
    <div class="cal-linked-item">
      <div class="cal-linked-dot" style="background:${ev.color}"></div>
      <div class="cal-linked-info">
        <div class="cal-linked-title">${ev.title}</div>
        <div class="cal-linked-sub">${ev.start ? ev.start + (ev.end ? ' – ' + ev.end : '') : '시간 미정'}</div>
      </div>
      ${ev.tpo ? `<span class="cal-linked-tpo">${ev.tpo}</span>` : ''}
    </div>`).join('');
}

function applyLinkedTPO() {
  if (!recSelectedDate) return;
  const events = JSON.parse(localStorage.getItem('cal_events') || '{}')[recSelectedDate] || [];
  if (!events.length) return;
  // 첫 번째 일정의 TPO를 추천 탭 TPO 칩에 적용
  const tpo = events[0].tpo;
  if (tpo) {
    document.querySelectorAll('.tpo-chip').forEach(chip => {
      chip.classList.toggle('sel', chip.textContent.trim() === tpo);
    });
    showToast('"' + tpo + '" TPO가 적용되었습니다');
  }
}

// ── 시간 피커 ─────────────────────────────────
let startAmPm = 'am', endAmPm = 'am';
let startHour = 9, endHour = 10;

function initTimePicker() {
  startAmPm = 'am'; endAmPm = 'am'; startHour = 9; endHour = 10;
  renderHourChips('start'); renderHourChips('end');
  updateAmPmUI('start'); updateAmPmUI('end');
  updateTimePreview();
}

function toggleTimePicker() {
  const wrap = document.getElementById('time-picker-wrap');
  const btn  = document.getElementById('time-toggle-btn');
  const isOpen = wrap.classList.toggle('open');
  btn.textContent = isOpen ? '− 시간 제거' : '+ 시간 추가 (선택)';
  if (isOpen) { initTimePicker(); }
}

function setAmPm(target, val) {
  if (target === 'start') startAmPm = val;
  else                    endAmPm   = val;
  updateAmPmUI(target);
  updateTimePreview();
}

function updateAmPmUI(target) {
  const isStart = target === 'start';
  const val = isStart ? startAmPm : endAmPm;
  document.getElementById(target + '-am').classList.toggle('sel', val === 'am');
  document.getElementById(target + '-pm').classList.toggle('sel', val === 'pm');
}

function renderHourChips(target) {
  const el  = document.getElementById(target + '-hours');
  const cur = target === 'start' ? startHour : endHour;
  let html  = '';
  for (let h = 1; h <= 12; h++) {
    html += `<div class="hour-chip ${cur === h ? 'sel' : ''}"
      onclick="pickHour('${target}', ${h})">${h}시</div>`;
  }
  // 30분 옵션
  html += `<div class="hour-chip" style="min-width:48px;"
    onclick="pickHour('${target}', ${cur}, true)">30분</div>`;
  el.innerHTML = html;
}

let startHalf = false, endHalf = false;

function pickHour(target, h, isHalf) {
  if (target === 'start') { startHour = h; startHalf = !!isHalf; }
  else                    { endHour   = h; endHalf   = !!isHalf; }
  renderHourChips(target);
  updateTimePreview();
}

function getPickedTime(target) {
  const ampm = target === 'start' ? startAmPm : endAmPm;
  const h    = target === 'start' ? startHour : endHour;
  const half = target === 'start' ? startHalf : endHalf;
  let h24 = h;
  if (ampm === 'am' && h === 12) h24 = 0;
  if (ampm === 'pm' && h !== 12) h24 = h + 12;
  return String(h24).padStart(2,'0') + ':' + (half ? '30' : '00');
}

function formatTimeDisplay(target) {
  const ampm = target === 'start' ? startAmPm : endAmPm;
  const h    = target === 'start' ? startHour : endHour;
  const half = target === 'start' ? startHalf : endHalf;
  return (ampm === 'am' ? '오전 ' : '오후 ') + h + ':' + (half ? '30' : '00');
}

function updateTimePreview() {
  document.getElementById('time-preview').textContent =
    formatTimeDisplay('start') + ' – ' + formatTimeDisplay('end');
}


// ── 코디 저장 ─────────────────────────────────
let lastOutfitData = null;  // 최근 추천 결과 보관

function saveOutfitToDate() {
  if (!lastOutfitData) { showToast('추천 결과가 없습니다'); return; }
  if (!recSelectedDate) { showToast('날짜를 먼저 선택해주세요'); return; }

  const outfitStore = JSON.parse(localStorage.getItem('cal_outfits') || '{}');
  outfitStore[recSelectedDate] = {
    style:       lastOutfitData.outfit?.style       || '',
    description: lastOutfitData.outfit?.description || '',
    items:       lastOutfitData.matched_items       || [],
    tpo:         document.querySelector('.tpo-chip.sel')?.textContent || '',
    savedAt:     new Date().toISOString()
  };
  localStorage.setItem('cal_outfits', JSON.stringify(outfitStore));

  const btn = document.getElementById('save-outfit-btn');
  btn.classList.add('saved');
  btn.innerHTML = '<span>✓</span> 저장됨 · ' + formatDateKo(recSelectedDate);
  showToast(formatDateKo(recSelectedDate) + '에 코디가 저장되었습니다');
}

function deleteOutfit(dateKey) {
  const outfitStore = JSON.parse(localStorage.getItem('cal_outfits') || '{}');
  delete outfitStore[dateKey];
  localStorage.setItem('cal_outfits', JSON.stringify(outfitStore));
  renderCalOutfit();
}

function renderCalOutfit() {
  const wrap = document.getElementById('cal-outfit-wrap');
  if (!wrap || !calSelectedDate) return;
  const outfitStore = JSON.parse(localStorage.getItem('cal_outfits') || '{}');
  const outfit = outfitStore[calSelectedDate];
  if (!outfit) { wrap.innerHTML = ''; return; }
  const itemPills = (outfit.items || []).map(item =>
    `<span class="cal-outfit-item-pill">${item.color} ${item.type}</span>`
  ).join('');
  wrap.innerHTML = `
    <div class="cal-outfit-card">
      <div class="cal-outfit-header"><span>✦</span> 저장된 코디</div>
      <div class="cal-outfit-style">${outfit.style || ''} ${outfit.tpo ? '· ' + outfit.tpo : ''}</div>
      <div class="cal-outfit-desc">${outfit.description || ''}</div>
      <div class="cal-outfit-items">${itemPills}</div>
      <button class="cal-outfit-del" onclick="deleteOutfit('${calSelectedDate}')">× 코디 삭제</button>
    </div>`;
}

// ── 초기화 ────────────────────────────────────
loadHomeData();
loadRecWeather();
loadDbStatus();
initRecDate();  // 오늘 날짜 기본 선택
</script>
</body>
</html>"""


# ─────────────────────────────────────────────
# Flask 라우트
# ─────────────────────────────────────────────
@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/save_profile", methods=["POST"])
def save_profile_route():
    save_profile(request.get_json(force=True) or {})
    return jsonify({"ok": True})

@app.route("/get_wardrobe")
def get_wardrobe_route():
    return jsonify(load_wardrobe())

@app.route("/get_weather")
def get_weather_route():
    return jsonify(get_weather())

@app.route("/db_status")
def db_status_route():
    return jsonify({
        "public_count":   len(public_metadata),
        "wardrobe_count": len(load_wardrobe())
    })

@app.route("/add_wardrobe", methods=["POST"])
def add_wardrobe_route():
    try:
        data      = request.get_json(force=True) or {}
        image_b64 = data.get("image")
        if not image_b64:
            return jsonify({"error": "이미지 없음"}), 400

        _, b64  = image_b64.split(",", 1)
        pil_img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")

        thumb = pil_img.copy()
        thumb.thumbnail((512, 512))

        raw   = gemini_vision(
            thumb,
            '이 옷을 분석하여 순수 JSON만 출력하세요. 마크다운 없이.\n{"category":"상의/하의/아우터/원피스 중 하나","type":"아이템명","color":"색상","material":"소재"}'
        )
        clean = raw.replace("```json","").replace("```","").strip()
        item  = json.loads(clean)
        if isinstance(item, list):
            item = item[0]

        buf = BytesIO()
        thumb.save(buf, format="JPEG", quality=75)
        item["image"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

        embedding = get_image_embedding(pil_img)

        wardrobe   = load_wardrobe()
        embeddings = load_wardrobe_embeddings()
        wardrobe.append(item)
        embeddings.append(embedding)
        save_wardrobe(wardrobe)
        save_wardrobe_embeddings(embeddings)

        print(f"[옷장 추가] {item['category']} / {item['color']} {item['type']}")
        return jsonify({"item": item})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/delete_wardrobe", methods=["POST"])
def delete_wardrobe_route():
    try:
        idx        = (request.get_json(force=True) or {}).get("index", -1)
        wardrobe   = load_wardrobe()
        embeddings = load_wardrobe_embeddings()
        if 0 <= idx < len(wardrobe):
            wardrobe.pop(idx)
            if idx < len(embeddings):
                embeddings.pop(idx)
            save_wardrobe(wardrobe)
            save_wardrobe_embeddings(embeddings)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/recommend", methods=["POST"])
def recommend_route():
    try:
        body    = request.get_json(force=True) or {}
        tpo     = body.get("tpo", "일상·캐주얼")
        mode    = body.get("mode", "rag")          # "rag" 또는 "blind"
        profile = load_profile()
        weather = get_weather()

        wardrobe        = load_wardrobe()
        wardrobe_embeds = load_wardrobe_embeddings()
        matched_items   = []
        ref_items       = []

        # ── Mode A: RAG ──────────────────────────────────────────────────
        if mode == "rag":
            candidates, needs_outer = filter_wardrobe_candidates(wardrobe, weather["temp"])
            outfit = get_outfit_recommendation_rag(tpo, weather, profile, candidates, needs_outer)
            print(f"\n[RAG 추천] {outfit.get('description','')}")

            # AI가 선택한 index로 옷장에서 직접 조회
            cat_key_map = {
                "top":    "상의",
                "bottom": "하의",
                "outer":  "아우터",
            }
            for key, cat in cat_key_map.items():
                slot = outfit.get(key)
                if not slot:
                    continue

                idx = slot.get("index")
                if idx is not None and 0 <= idx < len(wardrobe):
                    # AI가 옷장 후보 중 직접 선택한 경우 → 인덱스로 바로 조회
                    item  = wardrobe[idx]
                    query = slot.get("search_query", f"{slot['color']} {slot['type']}")
                    # 해당 아이템의 임베딩으로 유사도 계산 (표시용)
                    if idx < len(wardrobe_embeds):
                        q_vec = np.array(get_text_embedding(query), dtype="float32")
                        score = float(np.dot(q_vec, np.array(wardrobe_embeds[idx], dtype="float32")))
                    else:
                        score = 1.0
                    matched_items.append({
                        "category": item.get("category", cat),
                        "type":     item.get("type", ""),
                        "color":    item.get("color", ""),
                        "image":    item.get("image", ""),
                        "score":    round(score, 3)
                    })
                    print(f"[RAG 직접매칭] {cat}: idx={idx} {item.get('color','')} {item.get('type','')} ({score:.3f})")
                else:
                    # 해당 카테고리에 후보 없어서 AI가 자유 제안한 경우 → CLIP으로 옷장 검색
                    query = slot.get("search_query", f"{slot['color']} {slot['type']}")
                    best_item, best_score = match_wardrobe_by_clip(wardrobe, wardrobe_embeds, query, cat)
                    if best_item:
                        matched_items.append({
                            "category": best_item.get("category", cat),
                            "type":     best_item.get("type", ""),
                            "color":    best_item.get("color", ""),
                            "image":    best_item.get("image", ""),
                            "score":    round(best_score, 3)
                        })
                        print(f"[RAG CLIP폴백] {cat}: {best_item.get('color','')} {best_item.get('type','')} ({best_score:.3f})")

                # 공개 DB 참고 이미지 (공통)
                query = slot.get("search_query", f"{slot['color']} {slot['type']}")
                ref   = search_public_db(query, cat)
                if ref:
                    try:
                        with open(ref["img_path"], "rb") as f:
                            img_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
                    except:
                        img_b64 = ""
                    ref_items.append({
                        "category":     ref["category"],
                        "article_type": ref.get("article_type", ""),
                        "color":        ref.get("color", ""),
                        "img_url":      img_b64
                    })

        # ── Mode B: 추천 우선 (AI 독립 생성 → 로컬 CLIP 매칭) ──────────
        else:
            outfit = get_outfit_recommendation_blind(tpo, weather, profile)
            print(f"\n[추천우선] {outfit.get('description','')}")

            cat_map = {
                "top":    ("상의",  outfit["top"].get("search_query",  f"{outfit['top']['color']} {outfit['top']['type']}")),
                "bottom": ("하의",  outfit["bottom"].get("search_query", f"{outfit['bottom']['color']} {outfit['bottom']['type']}")),
            }
            if outfit.get("outer"):
                cat_map["outer"] = (
                    "아우터",
                    outfit["outer"].get("search_query", f"{outfit['outer']['color']} {outfit['outer']['type']}")
                )

            for key, (cat, query) in cat_map.items():
                best_item, best_score = match_wardrobe_by_clip(wardrobe, wardrobe_embeds, query, cat)
                if best_item:
                    matched_items.append({
                        "category": best_item.get("category", cat),
                        "type":     best_item.get("type", ""),
                        "color":    best_item.get("color", ""),
                        "image":    best_item.get("image", ""),
                        "score":    round(best_score, 3)
                    })
                    print(f"[추천우선 CLIP] {cat}: {best_item.get('color','')} {best_item.get('type','')} ({best_score:.3f})")

                ref = search_public_db(query, cat)
                if ref:
                    try:
                        with open(ref["img_path"], "rb") as f:
                            img_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
                    except:
                        img_b64 = ""
                    ref_items.append({
                        "category":     ref["category"],
                        "article_type": ref.get("article_type", ""),
                        "color":        ref.get("color", ""),
                        "img_url":      img_b64
                    })

        composed_b64 = compose_outfit_image(matched_items)

        return jsonify({
            "outfit":         outfit,
            "matched_items":  matched_items,
            "ref_items":      ref_items,
            "composed_image": composed_b64,
            "mode":           mode
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────
def open_browser():
    webbrowser.open("http://127.0.0.1:5000")

if __name__ == "__main__":
    if API_KEY == "여기에_Gemini_API_키_입력":
        print("\n[오류] API_KEY를 설정해주세요.")
        sys.exit(1)

    load_public_db()

    print("\n" + "="*45)
    print("  AI 스마트 옷장 - 리팩토링 버전")
    print("  브라우저: http://127.0.0.1:5000")
    print("  종료: Ctrl + C")
    print("="*45 + "\n")

    threading.Timer(1.0, open_browser).start()
    app.run(debug=False, port=5000)