import chromadb
from chromadb.config import Settings

# 서버 재시작 시 데이터 유지 (디스크 저장)
_client = chromadb.PersistentClient(path="./chroma_db")

def get_collection(user_id: str):
    # 사용자별 컬렉션 분리
    return _client.get_or_create_collection(
        name=f"wardrobe_{user_id}",
        metadata={"hnsw:space": "cosine"} #consine similarity 사용
    )
