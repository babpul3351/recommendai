"""
착용 이력 집계 스크립트 (LightGBM 학습 데이터 준비)

브랜치: feature/vit-lightgbm

배경
----
DB에 wear_count, last_worn_date 컬럼이 별도로 존재X.
대신 recommendation.outfits_json + accepted_outfit_index를 파싱하면
"사용자가 실제로 어떤 옷을 선택했는지" 이력을 재구성 가능.

이 스크립트는 그 이력을 집계해서, 아이템별로 아래 정보를 계산.
- wear_count      : 선택된 총 횟수
- last_worn_date  : 마지막으로 선택된 날짜
- days_since_worn : 오늘 기준 마지막 착용 후 며칠 지났는지

주의사항
-------
1. outfits_json이 NULL인 행은 건너띄기. (예: 884a252d-... 케이스)
2. 슬롯의 id가 null인 경우(ChromaDB 검색 매칭이 안 된 텍스트 전용 추천)는
   실제 옷장 아이템이 아니므로 집계에서 제외.
3. 코디 슬롯은 top/bottom/outer/onepiece 네 종류 존재.
4. accepted_outfit_index는 outfits_json 배열의 인덱스를 표시.
   (0번째 코디를 선택했으면 0, 1번째면 1)

실행 방법
--------
    cd ai_server
    export DB_PASSWORD='본인_MySQL_비밀번호'
    python3 analyze_wear_history.py
"""

import os
import sys
import json
import pymysql
from datetime import datetime, date
from collections import defaultdict

DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "recommendai"
DB_USER = "root"
DB_PASSWORD = os.environ.get("DB_PASSWORD")

if not DB_PASSWORD:
    print("에러: 환경변수 DB_PASSWORD가 설정되지 않았습니다.")
    print("  export DB_PASSWORD='본인_MySQL_비밀번호'")
    sys.exit(1)

SLOT_KEYS = ["top", "bottom", "outer", "onepiece"]


def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
    )


def fetch_accepted_recommendations():
    """수락된(accepted_outfit_index가 NULL이 아닌) 추천만 가져옵니다."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT rec_id, user_id, outfit_date, accepted_outfit_index,
                       outfits_json, created_at
                FROM recommendation
                WHERE accepted_outfit_index IS NOT NULL
            """)
            return cursor.fetchall()
    finally:
        conn.close()


def extract_accepted_item_ids(row):
    """
    한 행(row)에서, 실제로 수락된 코디에 포함된 실물 item_id 목록을 추출합니다.
    id가 null인 슬롯(텍스트 전용 추천)은 제외합니다.
    """
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


def aggregate_wear_history(rows):
    """
    아이템별 착용 이력을 집계합니다.

    Returns
    -------
    dict: {item_id: {"wear_count": int, "last_worn_date": date, "user_id": str}}
    """
    stats = defaultdict(lambda: {"wear_count": 0, "last_worn_date": None, "user_id": None})

    skipped_null_json = 0
    skipped_no_matched_item = 0

    for row in rows:
        item_ids = extract_accepted_item_ids(row)

        if not row["outfits_json"]:
            skipped_null_json += 1
            continue
        if not item_ids:
            skipped_no_matched_item += 1
            continue

        # 착용 날짜: outfit_date가 있으면 그걸, 없으면 created_at 날짜 사용
        worn_date = row["outfit_date"] or (
            row["created_at"].date() if isinstance(row["created_at"], datetime) else row["created_at"]
        )

        for item_id in item_ids:
            stats[item_id]["wear_count"] += 1
            stats[item_id]["user_id"] = row["user_id"]
            if stats[item_id]["last_worn_date"] is None or worn_date > stats[item_id]["last_worn_date"]:
                stats[item_id]["last_worn_date"] = worn_date

    return dict(stats), skipped_null_json, skipped_no_matched_item


def main():
    print("recommendation 테이블에서 수락된 추천 이력을 가져오는 중...")
    rows = fetch_accepted_recommendations()
    print(f"수락된 추천 {len(rows)}건 발견\n")

    stats, skipped_null, skipped_no_match = aggregate_wear_history(rows)

    print(f"건너뜀 (outfits_json 없음)      : {skipped_null}건")
    print(f"건너뜀 (매칭된 실물 아이템 없음) : {skipped_no_match}건")
    print(f"집계된 고유 아이템 수           : {len(stats)}개\n")

    if not stats:
        print("집계된 착용 이력이 없습니다. LightGBM 학습을 진행하기엔 데이터가 부족합니다.")
        return

    today = date.today()

    print("=" * 70)
    print(f"{'item_id':38s} {'wear_count':>10s} {'last_worn_date':>15s} {'days_since':>10s}")
    print("=" * 70)

    # wear_count 내림차순 정렬해서 출력
    sorted_items = sorted(stats.items(), key=lambda x: x[1]["wear_count"], reverse=True)

    for item_id, info in sorted_items:
        last_worn = info["last_worn_date"]
        days_since = (today - last_worn).days if last_worn else "N/A"
        print(f"{item_id:38s} {info['wear_count']:>10d} {str(last_worn):>15s} {str(days_since):>10s}")

    # ── 통계 요약 ──
    wear_counts = [v["wear_count"] for v in stats.values()]
    print("\n" + "=" * 70)
    print("요약 통계")
    print("=" * 70)
    print(f"평균 착용 횟수 : {sum(wear_counts) / len(wear_counts):.2f}")
    print(f"최대 착용 횟수 : {max(wear_counts)}")
    print(f"최소 착용 횟수 : {min(wear_counts)}")

    # ── CSV로 저장 (다음 단계인 LightGBM 학습에서 바로 사용 가능) ──
    output_path = "wear_history.csv"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("item_id,user_id,wear_count,last_worn_date,days_since_worn\n")
        for item_id, info in sorted_items:
            last_worn = info["last_worn_date"]
            days_since = (today - last_worn).days if last_worn else ""
            f.write(f"{item_id},{info['user_id']},{info['wear_count']},{last_worn or ''},{days_since}\n")

    print(f"\n결과가 저장되었습니다: {output_path}")
    print("이 파일을 다음 단계(LightGBM 학습)에서 입력 데이터로 사용합니다.")


if __name__ == "__main__":
    main()