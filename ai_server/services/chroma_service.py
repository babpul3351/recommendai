
"""
ChromaDB 벡터 저장/검색 서비스

Look at Life 프로젝트 — Phase 1.4 (ChromaDB 벡터 DB 전환)

역할
----
의류 아이템의 CLIP 이미지 임베딩(512차원)을 로컬 디스크에 영구 저장하고,
텍스트 쿼리 임베딩으로 유사한 아이템을 검색합니다.

저장 위치
--------
ai_server/chroma_data/  (이 파일 기준 상위 폴더에 자동 생성됩니다)
서버를 재시작해도 데이터가 유지됩니다. (기존 MySQL처럼 영구 저장소)
"""

import os
import chromadb

# ai_server/chroma_data 에 저장 (이 파일은 ai_server/services/ 안에 위치)
CHROMA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "chroma_data"
)

_client = None
_collection = None


def get_collection():
    """ChromaDB 컬렉션을 반환합니다. 최초 호출 시에만 초기화합니다."""
    global _client, _collection
    if _collection is not None:
        return _collection

    _client = chromadb.PersistentClient(path=CHROMA_PATH)
    _collection = _client.get_or_create_collection(
        name="wardrobe_items",
        metadata={"hnsw:space": "cosine"}  # 코사인 유사도 기준 인덱싱
    )
    print(f"[ChromaDB] 컬렉션 준비 완료 (저장 경로: {CHROMA_PATH})")
    return _collection


def upsert_item_embedding(item_id, embedding: list, metadata: dict):
    """
    의류 아이템의 임베딩을 저장(또는 갱신)합니다.

    Parameters
    ----------
    item_id   : wardrobe_item.id (Spring Boot에서 발급된 ID)
    embedding : CLIP 이미지 임베딩, 512차원 리스트
    metadata  : {"user_id": str, "category": str, "color": str, "type": str}
    """
    collection = get_collection()
    collection.upsert(
        ids=[str(item_id)],
        embeddings=[embedding],
        metadatas=[metadata],
    )


def delete_item_embedding(item_id):
    """의류 삭제 시 임베딩도 함께 제거합니다."""
    collection = get_collection()
    collection.delete(ids=[str(item_id)])


def query_similar(query_embedding: list, category: str = None, user_id: str = None, n_results: int = 20):
    """
    쿼리 임베딩과 유사한 아이템을 검색합니다.

    Returns
    -------
    list of (item_id: str, distance: float, metadata: dict)
        distance는 코사인 거리 (0에 가까울수록 유사, 1 - distance = 유사도)
    """
    collection = get_collection()

    conditions = []
    if category:
        conditions.append({"category": category})
    if user_id is not None:
        conditions.append({"user_id": str(user_id)})

    where_clause = None
    if len(conditions) == 1:
        where_clause = conditions[0]
    elif len(conditions) > 1:
        where_clause = {"$and": conditions}

    # 컬렉션이 비어있으면 빈 리스트 반환 (초기 상태 대응)
    if collection.count() == 0:
        return []

    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, collection.count()),
        where=where_clause,
    )

    ids = result.get("ids", [[]])[0]
    distances = result.get("distances", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]

    return list(zip(ids, distances, metadatas))


def get_stats():
    """현재 저장된 아이템 개수를 반환합니다. (디버깅/확인용)"""
    collection = get_collection()
    return {"total_items": collection.count()}
