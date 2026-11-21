import os
import mimetypes
from typing import Optional
from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible


@deconstructible
class SupabaseStorage(Storage):
    """
    Django Storage backend powered by Supabase's native Python SDK (supabase-py).
    Does NOT use S3-compatible storage, boto3, AWS S3, or S3 access keys.
    Compatible with Supabase's Free plan.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        self.supabase_url = url or os.getenv("SUPABASE_URL")
        self.key = (
            key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("SUPABASE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        self.bucket_name = (
            bucket_name
            or os.getenv("SUPABASE_STORAGE_BUCKET")
            or "documind-pdfs"
        )
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not self.supabase_url or not self.key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) "
                    "environment variables must be set to use SupabaseStorage."
                )
            from supabase import create_client
            self._client = create_client(self.supabase_url, self.key)
        return self._client

    @property
    def bucket(self):
        return self.client.storage.from_(self.bucket_name)

    def _normalize_name(self, name: str) -> str:
        return name.replace("\\", "/").lstrip("/")

    def _open(self, name: str, mode: str = "rb"):
        norm_name = self._normalize_name(name)
        data = self.bucket.download(norm_name)
        file = ContentFile(data, name=norm_name)
        file.mode = mode
        return file

    def _save(self, name: str, content) -> str:
        norm_name = self._normalize_name(name)
        if hasattr(content, "read"):
            content_bytes = content.read()
        elif isinstance(content, bytes):
            content_bytes = content
        else:
            content_bytes = str(content).encode("utf-8")

        content_type, _ = mimetypes.guess_type(norm_name)
        file_options = {
            "upsert": "true",
            "content-type": content_type or "application/pdf",
        }

        self.bucket.upload(
            path=norm_name,
            file=content_bytes,
            file_options=file_options,
        )
        return norm_name

    def delete(self, name: str) -> None:
        norm_name = self._normalize_name(name)
        try:
            self.bucket.remove([norm_name])
        except Exception:
            pass

    def exists(self, name: str) -> bool:
        norm_name = self._normalize_name(name)
        try:
            return bool(self.bucket.exists(norm_name))
        except Exception:
            return False

    def url(self, name: str) -> str:
        norm_name = self._normalize_name(name)
        try:
            return self.bucket.get_public_url(norm_name)
        except Exception:
            base_url = (self.supabase_url or "").rstrip("/")
            return f"{base_url}/storage/v1/object/public/{self.bucket_name}/{norm_name}"

    def size(self, name: str) -> int:
        norm_name = self._normalize_name(name)
        try:
            meta = self.bucket.info(norm_name)
            if isinstance(meta, dict) and "size" in meta:
                return int(meta["size"])
        except Exception:
            pass
        try:
            data = self.bucket.download(norm_name)
            return len(data)
        except Exception:
            return 0

    def path(self, name: str) -> str:
        raise NotImplementedError("This backend does not support absolute filesystem paths.")
