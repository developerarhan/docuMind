import os
import sys
import hashlib
from django.conf import settings


def get_vector_store(embedding_model):
    """
    Returns the vector store implementation.
    In production/Supabase deployment (when VECTOR_STORE_TYPE='pgvector' or USE_PGVECTOR='true'),
    uses PostgreSQL + pgvector so vector state is persistent across Render sleeping/restarts.
    In local dev / unit testing, defaults to local ChromaDB.
    """
    store_type = os.getenv("VECTOR_STORE_TYPE", "").lower()
    use_pg = os.getenv("USE_PGVECTOR", "").lower() in ("true", "1")
    is_test = "test" in sys.argv

    if (store_type == "pgvector" or use_pg) and not is_test:
        from ai_engine.rag.pgvector_store import PgVectorStore
        return PgVectorStore(embedding_function=embedding_model)

    from langchain_chroma import Chroma
    vector_store = Chroma(
        collection_name="documind_documents",
        embedding_function=embedding_model,
        persist_directory="./chroma_db"
    )

    return vector_store


def create_vector_store(chunks, embedding_model, document_id, user_id):
    if not chunks:
        raise ValueError("No chunks available for indexing.")

    vector_store = get_vector_store(embedding_model)

    ids = []
    documents = []
    metadatas = []

    for index, chunk in enumerate(chunks):
        chunk_id = hashlib.sha256(
            f"{document_id}:{index}:{chunk.page_content}".encode("utf-8")
        ).hexdigest()

        metadata = chunk.metadata.copy()
        metadata["document_id"] = document_id
        metadata["user_id"] = user_id
        metadata["chunk_id"] = chunk_id

        ids.append(chunk_id)
        documents.append(chunk.page_content)
        metadatas.append(metadata)

    embeddings = embedding_model.embed_documents(documents)

    vector_store._collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings
    )

    existing = vector_store._collection.get(
        where={
            "$and": [
                {"document_id": document_id},
                {"user_id": user_id}
            ]
        },
        include=[]
    )

    existing_ids = set(existing.get("ids", []))

    new_ids = set(ids)
    stale_ids = existing_ids - new_ids

    if stale_ids:
        vector_store._collection.delete(
            ids=list(stale_ids),
            where={
                "$and": [
                    {"document_id": document_id},
                    {"user_id": user_id}
                ]
            }
        )

    return vector_store


def get_document_chunks_by_id(vector_store, document_id, user_id, limit=6):
    """
    Retrieve document chunks directly by document_id and user_id.
    Used for global queries (e.g. summarization, concept extraction)
    where keyword-specific similarity scores might fall below standard thresholds.
    """
    from langchain_core.documents import Document

    collection = vector_store._collection
    result = collection.get(
        where={
            "$and": [
                {"document_id": document_id},
                {"user_id": user_id}
            ]
        },
        limit=limit,
        include=["documents", "metadatas"]
    )

    documents = result.get("documents", []) or []
    metadatas = result.get("metadatas", []) or []

    docs = []
    for text, meta in zip(documents, metadatas):
        docs.append(Document(page_content=text, metadata=meta or {}))

    return docs
