"""
idle_analysis_service.py — 유휴 의류 분석

브랜치: feature/vit-lightgbm

설계 원칙
--------
이 모듈은 의도적으로 3단계로 분리.

1. build_wear_features()  — DB에서 데이터를 가져와 특징(feature)을 계산
2. predict_idle_items()   — 특징을 보고 "유휴 의류인지" 판단  ← 나중에 LightGBM으로 교체될 부분
3. get_idle_analysis()    — 위 두 단계를 순서대로 실행하는 진입점

지금은 2번이 규칙 기반(days_since_worn >= threshold).
나중에 데이터가 충분히 쌓이면, 2번 함수 내부만 LightGBM 모델 호출로
교체하면 됨. 1번(특징 계산)과 3번(진입점), 그리고 이 모듈을 호출하는
main.py의 엔드포인트는 전혀 손댈 필요 XX.

왜 "미착용" 아이템도 다뤄야 하는가
--------------------------------
분석 대상은 두 종류로 분류.
- 한 번 이상 코디로 선택된 적 있지만, 마지막 선택일이 오래된 아이템
- 등록만 되어 있고 한 번도 선택된 적 없는 아이템 (가장 유휴에 가까움)

후자를 놓치면 안 되므로, wardrobe_item 테이블 전체를 기준으로 삼고
recommendation 이력을 왼쪽 조인(LEFT JOIN) 하듯이 결합하도록 지정.
"""

import os
import json
import pymysql
from datetime import datetime, date, timedelta
from collections import defaultdict

DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "recommendai"
DB_USER = "root"

SLOT_KEYS = ["top", "bottom", "outer", "onepiece"]

# 이 일수 이상 "입을 수 있는 계절 안에서" 안 입으면 유휴로 판단 (규칙 기반 기준값).
# 근거가 검증된 값이 아니라 휴리스틱. 파라미터(threshold_days)로 언제든 변경 가능.
DEFAULT_THRESHOLD_DAYS = 60

# ── 계절 태깅 (키워드 규칙) ─────────────────────────────────────────
# 월 범위는 서울 기후를 가정한 설계값이며 검증된 기준 아님.
SEASON_MONTHS = {
    "summer": {5, 6, 7, 8, 9},
    "winter": {11, 12, 1, 2, 3},
    "mid":    {3, 4, 5, 9, 10, 11},
    "all":    set(range(1, 13)),
}
SEASON_LABELS = {"summer": "여름", "winter": "겨울", "mid": "간절기", "all": "사계절"}

# 우선순위: 위에서부터 먼저 일치한 그룹이 적용.
#  1) 트렌치는 'coat'가 있어도 간절기이므로 겨울 키워드보다 먼저 검사
#  2) 겨울: 니트/스웻은 두께와 상관없이 겨울로 분류(사용자 결정).
#     따라서 "니트 가디건"은 가디건(간절기)이 아니라 겨울로 분류.
#     "니타"는 실제 DB에 있는 표기("니타 언밸런스 골지 티")를 반영한 것.
#  3) 간절기: 긴팔/long sleeve 포함. 긴팔이 있으면 아래 여름 검사에 도달하지 못하므로
#     "오프숄더 긴팔"은 여름으로 분류되지 않음.
#  4) 여름
SEASON_KEYWORDS = [
    ("mid",    ["트렌치", "trench"]),
    ("winter", ["패딩", "padding", "padded", "puffer", "코트", "coat", "기모", "fleece",
                "플리스", "터틀넥", "turtleneck", "무스탕", "shearling", "wool", "울 ",
                "니트", "니타", "knit", "스웻", "스웨트", "스웨터", "sweat"]),
    ("mid",    ["긴팔", "long sleeve", "long-sleeve", "long_sleeve", "longsleeve",
                "가디건", "cardigan", "후드", "hood", "맨투맨",
                "바람막이", "windbreaker", "자켓", "재킷", "jacket"]),
    ("summer", ["민소매", "나시", "sleeveless", "tank", "반팔", "short sleeve", "short-sleeve",
                "short_sleeve", "반바지", "shorts", "린넨", "linen", "시폰", "chiffon",
                "off shoulder", "오프숄더"]),
]


def classify_season(item_type, category=None):
    """
    type/category 문자열의 키워드로 계절 태그 생성.
    키워드가 없으면 "all"(사계절)이며, 아우터만 예외로 "mid"(간절기)로 설정(가정).
    한계: 키워드 사전 밖의 type(예: 니트, 데님)은 사계절로 분류.
    """
    text = f"{item_type or ''} {category or ''}".lower() + " "
    for season, keywords in SEASON_KEYWORDS:
        if any(k in text for k in keywords):
            return season
    if category == "아우터":
        return "mid"
    return "all"


def count_in_season_days(season, days_since_worn, today):
    """
    오늘부터 과거로 거슬러 올라가며, '현재 시즌 구간'(연속된 착용 가능 월)에 속하는
    날짜 수 count. 마지막 착용일(또는 등록일)보다 이전은 not count.
    오늘이 시즌 밖이면 0을 반환.
    """
    months = SEASON_MONTHS[season]
    if today.month not in months:
        return 0
    count = 0
    d = today
    while count <= days_since_worn:
        if d.month not in months:
            break
        count += 1
        d -= timedelta(days=1)
    return min(count, days_since_worn)


def _get_db_password():
    """
    DB 비밀번호를 환경변수에서 읽어옴.
    (이 함수 안에서만 필요할 때 읽어서, 모듈 import 시점에 서버가
     죽는 것을 방지. main.py가 이 모듈을 import할 때
     DB_PASSWORD가 아직 없어도 서버 자체는 정상 기동.)
    """
    # 다른 모듈(gemini_service)이 먼저 import되어 .env가 로드되어 있다고 가정하지 않고,
    # ai_server/.env를 직접 읽음. (이미 설정된 환경변수는 덮어쓰지 않습니다)
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
    except ImportError:
        pass

    password = os.environ.get("DB_PASSWORD")
    if not password:
        raise RuntimeError(
            "DB_PASSWORD 환경변수가 설정되지 않았습니다. "
            ".env 파일에 DB_PASSWORD=본인_MySQL_비밀번호 를 추가하세요."
        )
    return password


def _get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=_get_db_password(),
        database=DB_NAME, charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
    )


def _fetch_wardrobe_items(user_id: str):
    """
    해당 사용자의 옷장 아이템 전체를 업로드.
    season 컬럼(사용자가 직접 지정한 계절)이 아직 DB에 없으면(Spring 미재시작 등)
    season 없이 다시 조회하고 season=None으로 설정함.
    """
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            try:
                cursor.execute("""
                    SELECT item_id, category, item_type, color, image_thumbnail, created_at, season
                    FROM wardrobe_item
                    WHERE user_id = %s
                """, (user_id,))
                return cursor.fetchall()
            except pymysql.err.OperationalError as e:
                if e.args and e.args[0] == 1054:  # Unknown column
                    cursor.execute("""
                        SELECT item_id, category, item_type, color, image_thumbnail, created_at
                        FROM wardrobe_item
                        WHERE user_id = %s
                    """, (user_id,))
                    rows = cursor.fetchall()
                    for r in rows:
                        r["season"] = None
                    return rows
                raise
    finally:
        conn.close()


def _fetch_accepted_recommendations(user_id: str):
    """해당 사용자의 수락된 추천 이력을 업로드."""
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT outfit_date, accepted_outfit_index, outfits_json, created_at
                FROM recommendation
                WHERE user_id = %s AND accepted_outfit_index IS NOT NULL
            """, (user_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def _extract_accepted_item_ids(row):
    """수락된 코디에 포함된 실물 item_id 목록을 추출. (null id는 제외)"""
    if not row["outfits_json"]:
        return []
    try:
        outfits = json.loads(row["outfits_json"])
    except (json.JSONDecodeError, TypeError):
        return []

    idx = row["accepted_outfit_index"]
    if idx is None or idx >= len(outfits):
        return []

    accepted_outfit = outfits[idx]
    if not isinstance(accepted_outfit, dict):
        return []

    item_ids = []
    for key in SLOT_KEYS:
        slot = accepted_outfit.get(key)
        if isinstance(slot, dict) and slot.get("id"):
            item_ids.append(slot["id"])
    return item_ids


def _build_wear_stats(user_id: str):
    """
    수락된 추천 이력을 집계해서 {item_id: {"wear_count", "last_worn_date"}} 형태로 반환.
    이전 방학 개발 단계에서 만든 analyze_wear_history.py와 동일한 집계 로직.
    """
    rows = _fetch_accepted_recommendations(user_id)
    stats = defaultdict(lambda: {"wear_count": 0, "last_worn_date": None})

    for row in rows:
        item_ids = _extract_accepted_item_ids(row)
        if not item_ids:
            continue

        worn_date = row["outfit_date"] or (
            row["created_at"].date() if isinstance(row["created_at"], datetime) else row["created_at"]
        )

        for item_id in item_ids:
            stats[item_id]["wear_count"] += 1
            if stats[item_id]["last_worn_date"] is None or worn_date > stats[item_id]["last_worn_date"]:
                stats[item_id]["last_worn_date"] = worn_date

    return dict(stats)


def build_wear_features(user_id: str):
    """
    [1단계] 사용자의 옷장 아이템별 특징(feature)을 계산.

    이 함수는 판단 로직(규칙 기반이든 LightGBM이든)과 무관하게 항상 동일.
    반환되는 특징이 이후 predict_idle_items()의 입력됨.

    Returns
    -------
    list of dict, 각 원소:
        {
            "id": str,
            "category": str,
            "type": str,
            "color": str,
            "imageUrl": str,
            "wear_count": int,
            "last_worn_date": date | None,
            "days_since_worn": int,   # 미착용이면 등록일 기준으로 계산
            "never_worn": bool,
        }
    """
    wardrobe_items = _fetch_wardrobe_items(user_id)
    wear_stats = _build_wear_stats(user_id)
    today = date.today()

    features = []
    for item in wardrobe_items:
        item_id = item["item_id"]
        stats = wear_stats.get(item_id)

        if stats:
            wear_count = stats["wear_count"]
            last_worn_date = stats["last_worn_date"]
            days_since_worn = (today - last_worn_date).days
            never_worn = False
        else:
            wear_count = 0
            last_worn_date = None
            registered_date = (
                item["created_at"].date() if isinstance(item["created_at"], datetime) else item["created_at"]
            )
            days_since_worn = (today - registered_date).days
            never_worn = True

        features.append({
            "id":              item_id,
            "category":        item["category"],
            "type":            item["item_type"],
            "color":           item["color"],
            "imageUrl":        item["image_thumbnail"] or "",
            "wear_count":      wear_count,
            "last_worn_date":  last_worn_date.isoformat() if last_worn_date else None,
            "days_since_worn": days_since_worn,
            "never_worn":      never_worn,
            "season_user":     item.get("season"),  # 사용자가 지정한 값(summer/winter/mid/all) 또는 None
        })

    return features


def resolve_season(season_user, item_type, category):
    """
    계절 코드와 출처를 반환.
      source = "user"    : 사용자가 직접 지정한 값
      source = "auto"    : 키워드 규칙으로 분류됨
      source = "unknown" : 키워드가 없어 사계절로 떨어진 경우 (사용자 확인 필요)
    """
    if season_user in SEASON_MONTHS:
        return season_user, "user"
    code = classify_season(item_type, category)
    return code, ("unknown" if code == "all" else "auto")


def predict_idle_items(features: list, threshold_days: int = DEFAULT_THRESHOLD_DAYS, today: date = None):
    """
    [2단계 — 교체 대상] 특징을 보고 유휴 의류 여부를 판단.

    현재 구현: 계절 보정 규칙 기반
        1) 사용자가 지정한 계절(season_user)이 있으면 그것을, 없으면 type/category 키워드로 분류
        2) 키워드로도 분류되지 않으면(source="unknown") status="needs_season"
           -> 계절을 모르는 옷을 단순 경과일로 유휴 처리하지 않기 위함
        3) 오늘이 해당 계절 밖이면 status="off_season"
        4) 계절 안이면 in_season_days >= threshold_days 일 때 "idle", 아니면 "active"
        is_idle은 status == "idle" 과 동일.

    나중에 LightGBM으로 교체할 때는 이 함수 내부만 바꾸고, 입력(features)과
    출력(is_idle/status/prediction_method가 채워진 리스트)은 유지 필요.
    """
    today = today or date.today()
    for f in features:
        season, source = resolve_season(f.get("season_user"), f.get("type"), f.get("category"))
        in_season_days = count_in_season_days(season, f["days_since_worn"], today)

        if source == "unknown":
            status = "needs_season"
        elif today.month not in SEASON_MONTHS[season]:
            status = "off_season"
        elif in_season_days >= threshold_days:
            status = "idle"
        else:
            status = "active"

        f["season"] = SEASON_LABELS[season]
        f["season_code"] = season
        f["season_source"] = source
        f["in_season_days"] = in_season_days
        f["status"] = status
        f["is_idle"] = status == "idle"
        f["prediction_method"] = "rule_based_seasonal"  # 나중에 "lightgbm"으로 바뀔 값
    return features


def get_idle_analysis(user_id: str, threshold_days: int = DEFAULT_THRESHOLD_DAYS, idle_only: bool = True):
    """
    [3단계 — 진입점] 특징 계산 + 판단을 순서대로 실행.

    main.py의 /ai/idle-analysis 엔드포인트가 이 함수를 호출.

    Parameters
    ----------
    threshold_days : int
        시즌 구간 안에서 이 일수 이상 안 입으면 유휴 (기본 60일, 휴리스틱)
    idle_only : bool
        True : status가 "active"인 아이템만 제외 (idle + needs_season + off_season 반환)
        False: 전체 반환
        (이전 버전에서는 idle만 반환했습니다. off_season을 숨기지 않기 위해 변경)

    정렬: idle → active → needs_season → off_season, 각 그룹 내 in_season_days/days_since_worn 큰 순
    """
    features = build_wear_features(user_id)
    results = predict_idle_items(features, threshold_days=threshold_days)

    order = {"idle": 0, "active": 1, "needs_season": 2, "off_season": 3}
    results.sort(key=lambda x: (order[x["status"]], -x["in_season_days"], -x["days_since_worn"]))

    if idle_only:
        results = [r for r in results if r["status"] != "active"]

    return results