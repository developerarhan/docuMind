import os
import sys
from functools import lru_cache


@lru_cache(maxsize=1)
def get_embedding_model():
    """
    Returns the configured embedding model.
    In cloud/production (when GEMINI_API_KEY is configured), uses the lightweight
    GeminiEmbeddings API client to run under Render's 512MB RAM ceiling.
    In local test environments or when explicitly requested, falls back to local HuggingFace embeddings.
    """
    provider = os.getenv("EMBEDDING_PROVIDER", "").lower()
    has_gemini_key = bool(os.getenv("GEMINI_API_KEY"))

    if (provider == "gemini" or has_gemini_key) and "test" not in sys.argv and provider != "huggingface":
        from ai_engine.rag.gemini_embeddings import GeminiEmbeddings
        return GeminiEmbeddings()

    from langchain_huggingface import HuggingFaceEmbeddings
    model = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    return model
