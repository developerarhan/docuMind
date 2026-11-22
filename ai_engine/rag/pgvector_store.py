import json
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from django.db import connection
from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class PgVectorStore:
    """
    Lightweight, persistent PostgreSQL + pgvector Vector Store.
    Stores document chunk embeddings in Supabase PostgreSQL using pgvector,
    avoiding local filesystem disk persistence issues on Render.
    Maintains compatibility with Chroma-style collection calls (_collection.upsert, get, delete).
    """

    def __init__(self, embedding_function=None):
        self.embedding_function = embedding_function
        self._collection = self  # Compatibility with existing vector_store._collection calls
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        try:
            with connection.cursor() as cursor:
                # Enable vector extension on Supabase PostgreSQL
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS documind_embeddings (
                        id VARCHAR(64) PRIMARY KEY,
                        document_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        page_content TEXT NOT NULL,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        embedding vector NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS documind_embeddings_doc_user_idx 
                    ON documind_embeddings (document_id, user_id);
                """)
        except Exception as e:
            logger.warning("Could not initialize documind_embeddings table (may be running on SQLite/test): %s", e)

    def upsert(
        self,
        ids: List[str],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ):
        doc_id = metadatas[0].get("document_id") if metadatas else "unknown"
        user_id = metadatas[0].get("user_id") if metadatas else "unknown"
        logger.info(
            "Upserting %s chunks to pgvector documind_embeddings (document_id=%s, user_id=%s)",
            len(ids),
            doc_id,
            user_id,
        )
        with connection.cursor() as cursor:
            for chunk_id, doc_text, meta, emb in zip(ids, documents, metadatas, embeddings):
                doc_id = meta.get("document_id", 0)
                user_id = meta.get("user_id", 0)
                meta_json = json.dumps(meta)
                emb_str = "[" + ",".join(str(float(x)) for x in emb) + "]"

                cursor.execute("""
                    INSERT INTO documind_embeddings (id, document_id, user_id, page_content, metadata, embedding)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s::vector)
                    ON CONFLICT (id) DO UPDATE SET
                        page_content = EXCLUDED.page_content,
                        metadata = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding;
                """, [chunk_id, doc_id, user_id, doc_text, meta_json, emb_str])
        logger.debug("Successfully upserted %s chunks to pgvector", len(ids))

    def get(
        self,
        ids: Optional[List[str]] = None,
        where: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
        include: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        include = include or ["documents", "metadatas"]
        params = []
        conditions = []

        if ids:
            conditions.append("id = ANY(%s)")
            params.append(ids)

        if where:
            doc_id, user_id = self._parse_where_filter(where)
            if doc_id is not None:
                conditions.append("document_id = %s")
                params.append(doc_id)
            if user_id is not None:
                conditions.append("user_id = %s")
                params.append(user_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        limit_clause = f"LIMIT {int(limit)}" if limit else ""

        sql = f"""
            SELECT id, page_content, metadata, embedding::text
            FROM documind_embeddings
            {where_clause}
            ORDER BY id
            {limit_clause};
        """

        res_ids = []
        res_docs = []
        res_metas = []
        res_embeddings = []

        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            for r_id, content, meta, emb_str in rows:
                res_ids.append(r_id)
                res_docs.append(content)
                meta_dict = meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
                res_metas.append(meta_dict)
                if "embeddings" in include and emb_str:
                    try:
                        clean_str = emb_str.strip("[]")
                        emb_vals = [float(x) for x in clean_str.split(",") if x.strip()]
                        res_embeddings.append(emb_vals)
                    except Exception:
                        res_embeddings.append([])

        result = {
            "ids": res_ids,
            "documents": res_docs,
            "metadatas": res_metas,
        }
        if "embeddings" in include:
            result["embeddings"] = res_embeddings

        return result

    def delete(
        self,
        ids: Optional[List[str]] = None,
        where: Optional[Dict[str, Any]] = None,
    ):
        params = []
        conditions = []

        if ids:
            conditions.append("id = ANY(%s)")
            params.append(ids)

        if where:
            doc_id, user_id = self._parse_where_filter(where)
            if doc_id is not None:
                conditions.append("document_id = %s")
                params.append(doc_id)
            if user_id is not None:
                conditions.append("user_id = %s")
                params.append(user_id)

        if not conditions:
            return

        sql = f"DELETE FROM documind_embeddings WHERE {' AND '.join(conditions)};"
        with connection.cursor() as cursor:
            cursor.execute(sql, params)

    def max_marginal_relevance_search_by_vector(
        self,
        embedding: List[float],
        k: int = 4,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        doc_id, user_id = self._parse_where_filter(filter)
        emb_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

        params = [emb_str, emb_str]
        conditions = []
        if doc_id is not None:
            conditions.append("document_id = %s")
            params.append(doc_id)
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(fetch_k)

        sql = f"""
            SELECT id, page_content, metadata, embedding::text, (1.0 - (embedding <=> %s::vector)) AS similarity
            FROM documind_embeddings
            {where_clause}
            ORDER BY embedding <=> %s::vector ASC
            LIMIT %s;
        """

        candidates = []
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            for r_id, content, meta, emb_text, sim in rows:
                meta_dict = meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
                meta_dict["chunk_id"] = r_id
                candidates.append({
                    "id": r_id,
                    "content": content,
                    "metadata": meta_dict,
                    "similarity": float(sim or 0.0),
                    "embedding": emb_text
                })

        if not candidates:
            return []

        # Parse vector embeddings for MMR diversity selection
        candidate_embeddings = []
        for c in candidates:
            try:
                emb_vals = [float(x) for x in c["embedding"].strip("[]").split(",") if x.strip()]
            except Exception:
                emb_vals = []
            candidate_embeddings.append(emb_vals)

        # Standard MMR ranking
        query_vec = np.array(embedding)
        cand_mat = np.array(candidate_embeddings)

        if len(candidates) <= k or cand_mat.shape[1] == 0:
            return [
                Document(page_content=c["content"], metadata=c["metadata"], id=c["id"])
                for c in candidates[:k]
            ]

        selected_indices = []
        unselected_indices = list(range(len(candidates)))

        while len(selected_indices) < min(k, len(candidates)):
            best_idx = None
            best_score = -float("inf")

            for idx in unselected_indices:
                sim_to_query = candidates[idx]["similarity"]

                if not selected_indices:
                    max_sim_to_selected = 0.0
                else:
                    selected_mat = cand_mat[selected_indices]
                    cand_vec = cand_mat[idx]
                    norm_cand = np.linalg.norm(cand_vec)
                    norm_sel = np.linalg.norm(selected_mat, axis=1)
                    denom = norm_cand * norm_sel
                    denom[denom == 0] = 1e-9
                    dots = np.dot(selected_mat, cand_vec) / denom
                    max_sim_to_selected = float(np.max(dots))

                mmr_score = lambda_mult * sim_to_query - (1 - lambda_mult) * max_sim_to_selected
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            if best_idx is not None:
                selected_indices.append(best_idx)
                unselected_indices.remove(best_idx)
            else:
                break

        return [
            Document(page_content=candidates[i]["content"], metadata=candidates[i]["metadata"], id=candidates[i]["id"])
            for i in selected_indices
        ]

    def _parse_where_filter(self, where: Optional[Dict[str, Any]]):
        if not where:
            return None, None

        doc_id = None
        user_id = None

        if "$and" in where and isinstance(where["$and"], list):
            for cond in where["$and"]:
                if isinstance(cond, dict):
                    if "document_id" in cond:
                        doc_id = cond["document_id"]
                    if "user_id" in cond:
                        user_id = cond["user_id"]
        elif isinstance(where, dict):
            doc_id = where.get("document_id")
            user_id = where.get("user_id")

        return doc_id, user_id
