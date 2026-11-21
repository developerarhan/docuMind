import numpy as np
from langchain_core.documents import Document


def retrieve_documents(
    vector_store,
    question: str,
    embedding_model,
    document_id: int,
    user_id: int,
    threshold: float = 0.60
) -> tuple[list[Document], list[float]]:

    # 1. Generate query embedding only
    query_embedding = np.array(
        embedding_model.embed_query(question)
    )

    # 2. Retrieve diverse documents using MMR
    results = vector_store.max_marginal_relevance_search_by_vector(
        embedding=query_embedding.tolist(),
        k=4,
        fetch_k=20,
        lambda_mult=0.5,
        filter={
            "$and": [
                {"document_id": document_id},
                {"user_id": user_id}
            ]
        }
    )

    if not results:
        return [], []

    # 3. Get stored embeddings for retrieved documents
    def _extract_id(doc):
        if getattr(doc, "id", None):
            return doc.id
        if getattr(doc, "metadata", None) and doc.metadata.get("chunk_id"):
            return doc.metadata["chunk_id"]
        return None

    doc_ids = [_extract_id(doc) for doc in results]
    valid_ids = [d_id for d_id in doc_ids if d_id is not None]

    collection = vector_store._collection
    embedding_map = {}

    if valid_ids:
        result = collection.get(
            ids=valid_ids,
            include=["embeddings"]
        )
        embedding_map = {
            doc_id: embedding
            for doc_id, embedding in zip(
                result.get("ids", []),
                result.get("embeddings", [])
            )
        }

    # 4. Calculate cosine similarity
    scores = []
    query_norm = np.linalg.norm(query_embedding)

    for doc, d_id in zip(results, doc_ids):
        stored_embedding = embedding_map.get(d_id) if d_id else None

        if stored_embedding is None:
            stored_embedding = embedding_model.embed_query(doc.page_content)

        doc_vector = np.array(stored_embedding)
        doc_norm = np.linalg.norm(doc_vector)

        if query_norm == 0 or doc_norm == 0:
            similarity = 0.0
        else:
            similarity = np.dot(
                query_embedding, doc_vector
            ) / (query_norm * doc_norm)

        scores.append(float(similarity))

    # 5. Apply threshold
    filtered_results = [
        (doc, score)
        for doc, score in zip(results, scores)
        if score >= threshold
    ]

    return (
        [doc for doc, score in filtered_results],
        [score for doc, score in filtered_results]
    )
