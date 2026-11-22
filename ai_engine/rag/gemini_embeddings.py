import os
import time
import logging
import requests
from typing import List
from langchain_core.embeddings import Embeddings

logger = logging.getLogger(__name__)


class GeminiEmbeddings(Embeddings):
    """
    Lightweight, high-performance Gemini Embedding API client for text-embedding-004.
    Runs via direct HTTP calls with no PyTorch or heavy C-extensions, keeping
    memory footprint under ~20MB for Render Free tier deployment.
    """
    def __init__(
        self,
        api_key: str = None,
        model_name: str = "models/text-embedding-004",
        timeout: int = 30
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.error("GEMINI_API_KEY is not configured")
            raise ValueError("GEMINI_API_KEY environment variable is required for GeminiEmbeddings.")
        self.model_name = model_name if model_name.startswith("models/") else f"models/{model_name}"
        self.timeout = timeout
        self.endpoint_single = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:embedContent"
        self.endpoint_batch = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:batchEmbedContents"
        logger.debug("Initialized GeminiEmbeddings with model %s", self.model_name)

    def embed_query(self, text: str) -> List[float]:
        if not text or not str(text).strip():
            return [0.0] * 768

        payload = {
            "model": self.model_name,
            "content": {
                "parts": [{"text": str(text)}]
            }
        }
        params = {"key": self.api_key}

        for attempt in range(3):
            try:
                response = requests.post(
                    self.endpoint_single,
                    params=params,
                    json=payload,
                    timeout=self.timeout
                )
                if response.status_code == 429:
                    logger.warning("Gemini embedding rate limited (429), retrying in %ss (attempt %s/3)", 1.0 * (attempt + 1), attempt + 1)
                    time.sleep(1.0 * (attempt + 1))
                    continue
                if not response.ok:
                    logger.warning("Gemini embedContent HTTP %s: %s (attempt %s/3)", response.status_code, response.text[:250], attempt + 1)
                response.raise_for_status()
                data = response.json()
                return data["embedding"]["values"]
            except Exception as e:
                logger.warning("Gemini embed_query error on attempt %s/3: %s", attempt + 1, e)
                if attempt == 2:
                    logger.exception("Gemini embedding API call failed completely after 3 attempts: %s", e)
                    raise RuntimeError(f"Gemini embedding API call failed: {e}") from e
                time.sleep(1.0)
        return [0.0] * 768

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        all_embeddings = []
        batch_size = 50  # Gemini batch limit is 100
        logger.info("Generating Gemini embeddings for %s document chunks (batch_size=%s)", len(texts), batch_size)

        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            requests_list = [
                {
                    "model": self.model_name,
                    "content": {"parts": [{"text": str(t)}]}
                }
                for t in chunk
            ]
            payload = {"requests": requests_list}
            params = {"key": self.api_key}

            for attempt in range(3):
                try:
                    response = requests.post(
                        self.endpoint_batch,
                        params=params,
                        json=payload,
                        timeout=self.timeout
                    )
                    if response.status_code == 429:
                        logger.warning("Gemini batch embedding rate limited (429), retrying in %ss (attempt %s/3)", 1.5 * (attempt + 1), attempt + 1)
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    if not response.ok:
                        logger.warning("Gemini batchEmbedContents HTTP %s: %s (attempt %s/3)", response.status_code, response.text[:250], attempt + 1)
                    response.raise_for_status()
                    data = response.json()
                    batch_vectors = [item["values"] for item in data["embeddings"]]
                    all_embeddings.extend(batch_vectors)
                    logger.debug("Successfully embedded batch %s-%s of %s", i, i + len(chunk), len(texts))
                    break
                except Exception as e:
                    logger.warning("Gemini batchEmbedContents error on attempt %s/3: %s", attempt + 1, e)
                    if attempt == 2:
                        logger.exception("Gemini batch embedding API call failed completely after 3 attempts: %s", e)
                        raise RuntimeError(f"Gemini batch embedding API call failed: {e}") from e
                    time.sleep(1.0)

        logger.info("Finished embedding all %s document chunks", len(texts))
        return all_embeddings
