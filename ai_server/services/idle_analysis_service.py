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
교체 필요. 1번(특징 계산)과 3번(진입점), 그리고 이 모듈을 호출하는
main.py의 엔드포인트는 전혀 손댈 필요없도록 진행.

왜 "미착용" 아이템도 다뤄야 하는가
--------------------------------
분석 대상은 두 종류로 분할.
- 한 번 이상 코디로 선택된 적 있지만, 마지막 선택일이 오래된 아이템
- 등록만 되어 있고 한 번도 선택된 적 없는 아이템 (가장 유휴에 가까움)

후자를 놓치면 안 되므로, wardrobe_item 테이블 전체를 기준으로 삼고
recommendation 이력을 왼쪽 조인(LEFT JOIN) 하듯이 결합.
"""

import os
import json
import pymysql
from datetime import datetime, date
from collections import defaultdict

DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "recommendai"
DB_USER = "root"

SLOT_KEYS = ["top", "bottom", "outer", "onepiece"]

DEFAULT_THRESHOLD_DAYS = 30  # 이 일수 이상 안 입으면 "유휴"로 판단 (규칙 기반 기준값)


def _get_db_password():
    """
    DB 비밀번호를 환경변수에서 bring.
    (이 함수 안에서만 필요할 때 읽어서, 모듈 import 시점에 서버가
     죽는 것을 방지. main.py가 이 모듈을 import할 때
     DB_PASSWORD가 아직 없어도 서버 자체는 정상 기동.)
    """
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
    """해당 사용자의 옷장 아이템 전체를 가져와 사용."""
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT item_id, category, item_type, color, image_thumbnail, created_at
                FROM wardrobe_item
                WHERE user_id = %s
            """, (user_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def _fetch_accepted_recommendations(user_id: str):
    """해당 사용자의 수락된 추천 이력을 가져와 사용."""
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
    반환되는 특징이 이후 predict_idle_items()의 입력.

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
        })

    return features


def predict_idle_items(features: list, threshold_days: int = DEFAULT_THRESHOLD_DAYS):
    """
    [2단계 — 교체 대상] 특징을 보고 유휴 의류 여부를 판단.

    현재 구현: 규칙 기반
        days_since_worn >= threshold_days 이면 유휴 의류로 판단.

    나중에 LightGBM으로 교체할 때
        이 함수의 내부만 아래처럼 변경하면 됨. 함수 시그니처
        (입력: features 리스트, 출력: is_idle이 채워진 리스트)는 그대로 유지해야 함.

            import joblib
            model = joblib.load("models/idle_classifier.pkl")
            X = [[f["wear_count"], f["days_since_worn"], ...] for f in features]
            predictions = model.predict(X)
            for f, pred in zip(features, predictions):
                f["is_idle"] = bool(pred)
                f["prediction_method"] = "lightgbm"
            return features

    이렇게 하면 main.py의 엔드포인트나 build_wear_features()는
    전혀 수정할 필요XX.
    """
    for f in features:
        f["is_idle"] = f["days_since_worn"] >= threshold_days
        f["prediction_method"] = "rule_based"  # 나중에 "lightgbm"으로 바뀔 값
    return features


def get_idle_analysis(user_id: str, threshold_days: int = DEFAULT_THRESHOLD_DAYS, idle_only: bool = True):
    """
    [3단계 — 진입점] 특징 계산 + 판단을 순서대로 실행.

    main.py의 /ai/idle-analysis 엔드포인트가 이 함수를 호출.

    Parameters
    ----------
    user_id : str
    threshold_days : int
        규칙 기반 판단 기준 (기본 30일)
    idle_only : bool
        True면 유휴 의류만 반환, False면 전체 아이템에 is_idle 플래그를 붙여 반환

    Returns
    -------
    list of dict (wear_count가 적고 days_since_worn이 큰 순으로 정렬됨)
    """
    features = build_wear_features(user_id)
    results = predict_idle_items(features, threshold_days=threshold_days)

    # 유휴 의류를 우선으로, 그중에서도 오래 안 입은 순으로 정렬
    results.sort(key=lambda x: (not x["is_idle"], -x["days_since_worn"]))

    if idle_only:
        results = [r for r in results if r["is_idle"]]

    return results