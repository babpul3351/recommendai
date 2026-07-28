import chromadb

client = chromadb.PersistentClient(path="./chroma_db")

# 기존 Collection 삭제(실습용)
try:
    client.delete_collection("fashion")
except:
    pass

collection = client.create_collection("fashion")

# 여러 개 벡터 저장
collection.add(
    ids=[
        "shirt1",
        "shirt2",
        "shirt3",
        "shirt4",
        "shirt5"
    ],

    embeddings=[
        [0.20,0.30,0.50],
        [0.80,0.70,0.10],
        [0.21,0.31,0.49],
        [0.90,0.10,0.20],
        [0.22,0.33,0.48]
    ],

    metadatas=[
        {"name":"흰 셔츠"},
        {"name":"검정 셔츠"},
        {"name":"흰 반팔"},
        {"name":"청바지"},
        {"name":"흰 후드"}
    ]
)

print("벡터 5개 저장 완료!")

result = collection.query(

    query_embeddings=[
        [0.21,0.30,0.50]
    ],

    n_results=3

)

print(result)