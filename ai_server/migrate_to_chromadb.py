"""
기존 MySQL wardrobe_item 데이터를 ChromaDB로 마이그레이션하는 스크립트

동작 방식
--------
1. MySQL의 wardrobe_item 테이블 전체를 조회합니다.
2. 각 아이템에 대해 ChromaDB에 이미 등록되어 있는지 확인합니다.
   - 이미 있으면 건너뜁니다. (중복 계산/저장 방지)
   - 없으면 S3의 imageUrl에서 이미지를 다운로드해서 임베딩을 생성하고 저장합니다.
3. 마지막에 전체 처리 결과(성공/건너뜀/실패 개수)를 요약해서 보여줍니다.

실행 위치
--------
반드시 ai_server 폴더 안에서 실행해야 합니다. (services 모듈을 import하기 때문)

실행 방법
--------
    cd ai_server
    export DB_PASSWORD='본인_MySQL_비밀번호'
    python3 migrate_to_chromadb.py
"""

import os
import sys
import time
import requests
import pymysql
from io import BytesIO
from PIL import Image

# ai_server/services 모듈을 import하기 위한 경로 설정
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services import chroma_service
from services.clip_service import get_image_embedding


# ─────────────────────────────────────────────
# DB 접속 설정
# 비밀번호는 환경변수로 받습니다. (코드에 직접 적지 않기 위함)
# ─────────────────────────────────────────────
DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "recommendai"
DB_USER = "root"
DB_PASSWORD = os.environ.get("DB_PASSWORD")

if not DB_PASSWORD:
    print("에러: 환경변수 DB_PASSWORD가 설정되지 않았습니다.")
    print("아래처럼 먼저 설정한 후 다시 실행하세요.")
    print("  export DB_PASSWORD='본인_MySQL_비밀번호'")
    sys.exit(1)


def get_all_wardrobe_items():
    """MySQL에서 옷장 아이템 전체를 조회합니다."""
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT item_id, user_id, category, item_type, color, image_thumbnail
                FROM wardrobe_item
            """)
            return cursor.fetchall()
    finally:
        conn.close()


def already_in_chroma(item_id: str) -> bool:
    """ChromaDB에 해당 item_id가 이미 등록되어 있는지 확인합니다."""
    collection = chroma_service.get_collection()
    if collection.count() == 0:
        return False
    result = collection.get(ids=[str(item_id)])
    return len(result.get("ids", [])) > 0


def download_image(image_url: str) -> Image.Image:
    """S3 URL에서 이미지를 다운로드해서 PIL Image로 반환합니다."""
    response = requests.get(image_url, timeout=15)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGB")


def main():
    print("MySQL에서 옷장 아이템 목록을 가져오는 중...")
    items = get_all_wardrobe_items()
    print(f"전체 {len(items)}개 아이템 발견\n")

    stats = {"success": 0, "skipped": 0, "failed": 0}
    failed_items = []

    for idx, item in enumerate(items, 1):
        item_id = item["item_id"]
        image_url = item["image_thumbnail"]

        print(f"[{idx}/{len(items)}] {item_id} 처리 중...")

        # 이미 ChromaDB에 있으면 건너뜀 (중복 계산 방지)
        if already_in_chroma(item_id):
            print("  → 이미 ChromaDB에 등록되어 있음. 건너뜀.")
            stats["skipped"] += 1
            continue

        if not image_url:
            print("  → 이미지 URL이 없음. 건너뜀.")
            stats["skipped"] += 1
            continue

        try:
            pil_img = download_image(image_url)
            embedding = get_image_embedding(pil_img)

            chroma_service.upsert_item_embedding(
                item_id=item_id,
                embedding=embedding,
                metadata={
                    "user_id":  item["user_id"] or "",
                    "category": item["category"] or "",
                    "color":    item["color"] or "",
                    "type":     item["item_type"] or "",
                }
            )

            print("  → 등록 완료")
            stats["success"] += 1

        except Exception as e:
            print(f"  → 실패: {e}")
            stats["failed"] += 1
            failed_items.append((item_id, str(e)))

        # S3/네트워크 부담 완화를 위한 짧은 대기
        time.sleep(0.1)

    # ── 결과 요약 ──
    print("\n" + "=" * 50)
    print("마이그레이션 결과 요약")
    print("=" * 50)
    print(f"신규 등록 성공 : {stats['success']}개")
    print(f"이미 존재/건너뜀 : {stats['skipped']}개")
    print(f"실패          : {stats['failed']}개")

    if failed_items:
        print("\n실패한 아이템 목록:")
        for item_id, error in failed_items:
            print(f"  - {item_id}: {error}")

    total_in_chroma = chroma_service.get_stats()
    print(f"\nChromaDB 현재 총 저장 개수: {total_in_chroma['total_items']}개")


if __name__ == "__main__":
    main()