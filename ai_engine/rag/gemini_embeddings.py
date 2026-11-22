import os
import time
import logging
import requests
from typing import List
from langchain_core.embeddings import Embeddings

logger = logging.getLogger(__name__)


class GeminiEmbeddings(Embeddings):
    """
    Lightweight Gemini Embedding API client.
    Uses direct HTTP requests without PyTorch.
    """

    def __init__(
        self,
        api_key: str = None,
        model_name: str = None,
        timeout: int = 30,
        dimensions: int = 768,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")

        raw_model = (
            model_name
            or os.getenv("GEMINI_EMBEDDING_MODEL")
            or "models/gemini-embedding-001"
        )
        self.model_name = (
            raw_model if raw_model.startswith("models/")
            else f"models/{raw_model}"
        )

        self.timeout = timeout
        self.dimensions = int(os.getenv("GEMINI_EMBEDDING_DIMENSIONS", dimensions))

        base_url = (
            "https://generativelanguage.googleapis.com/v1beta/"
            f"{self.model_name}"
        )

        self.endpoint_single = f"{base_url}:embedContent"
        self.endpoint_batch = f"{base_url}:batchEmbedContents"

        self.headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        self.session = requests.Session()

        logger.info(
            "Initialized Gemini embeddings: model=%s, dimensions=%s",
            self.model_name,
            self.dimensions,
        )

    def _post(self, endpoint, payload):
        """HTTP request with retries for transient failures."""

        for attempt in range(3):
            try:
                response = self.session.post(
                    endpoint,
                    headers=self.headers,
                    json=payload,
                    timeout=self.timeout,
                )

                # Do not retry permanent errors such as 400 or 404.
                if response.status_code in (400, 401, 403, 404):
                    raise RuntimeError(
                        f"Gemini API HTTP {response.status_code}: "
                        f"{response.text[:500]}"
                    )

                if response.status_code == 429 or response.status_code >= 500:
                    if attempt == 2:
                        response.raise_for_status()

                    delay = 2 ** attempt
                    logger.warning(
                        "Gemini API temporary error %s. Retrying in %ss",
                        response.status_code,
                        delay,
                    )
                    time.sleep(delay)
                    continue

                response.raise_for_status()
                return response.json()

            except (requests.Timeout, requests.ConnectionError):
                if attempt == 2:
                    raise

                time.sleep(2 ** attempt)

        raise RuntimeError("Gemini API request failed")

    def _embedding_request(self, text, task_type):
        return {
            "model": self.model_name,
            "content": {
                "parts": [{"text": str(text)}]
            },
            "taskType": task_type,
            "outputDimensionality": self.dimensions,
        }

    def embed_query(self, text: str) -> List[float]:

        if not text or not str(text).strip():
            raise ValueError("Cannot embed empty query")

        payload = self._embedding_request(
            text,
            "RETRIEVAL_QUERY",
        )

        data = self._post(self.endpoint_single, payload)

        values = data["embedding"]["values"]

        if len(values) != self.dimensions:
            raise RuntimeError(
                f"Unexpected embedding dimensions: {len(values)}"
            )

        return values

    def embed_documents(self, texts: List[str]) -> List[List[float]]:

        if not texts:
            return []

        batch_size = 50
        all_embeddings = []

        logger.info(
            "Embedding %s documents using batches of %s",
            len(texts),
            batch_size,
        )

        for i in range(0, len(texts), batch_size):

            chunk = texts[i:i + batch_size]

            requests_list = [
                self._embedding_request(
                    text,
                    "RETRIEVAL_DOCUMENT",
                )
                for text in chunk
            ]

            payload = {
                "requests": requests_list
            }

            data = self._post(
                self.endpoint_batch,
                payload,
            )

            batch_vectors = [
                item["values"]
                for item in data["embeddings"]
            ]

            if len(batch_vectors) != len(chunk):
                raise RuntimeError(
                    "Gemini returned an unexpected number of embeddings"
                )

            for vector in batch_vectors:
                if len(vector) != self.dimensions:
                    raise RuntimeError(
                        f"Unexpected embedding dimensions: {len(vector)}"
                    )

            all_embeddings.extend(batch_vectors)

            logger.info(
                "Embedded documents %s-%s of %s",
                i + 1,
                i + len(chunk),
                len(texts),
            )

        return all_embeddings
