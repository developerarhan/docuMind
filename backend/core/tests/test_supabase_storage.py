from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase
from django.core.files.base import ContentFile
from core.supabase_storage import SupabaseStorage


class SupabaseStorageTests(SimpleTestCase):
    def setUp(self):
        self.mock_client = MagicMock()
        self.mock_bucket = MagicMock()
        self.mock_client.storage.from_.return_value = self.mock_bucket

    @patch("supabase.create_client")
    def test_storage_initialization_and_client_property(self, mock_create):
        mock_create.return_value = self.mock_client
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="test-bucket"
        )
        self.assertEqual(storage.bucket_name, "test-bucket")
        self.assertEqual(storage.client, self.mock_client)
        mock_create.assert_called_once_with("https://test.supabase.co", "test-key")

    @patch("supabase.create_client")
    def test_save_method(self, mock_create):
        mock_create.return_value = self.mock_client
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )
        content = ContentFile(b"%PDF-1.4 test content", name="documents/2026/test.pdf")
        
        saved_name = storage._save("documents/2026/test.pdf", content)

        self.assertEqual(saved_name, "documents/2026/test.pdf")
        self.mock_bucket.upload.assert_called_once()
        args, kwargs = self.mock_bucket.upload.call_args
        self.assertEqual(kwargs["path"], "documents/2026/test.pdf")
        self.assertEqual(kwargs["file"], b"%PDF-1.4 test content")
        self.assertEqual(kwargs["file_options"]["upsert"], "true")

    @patch("supabase.create_client")
    def test_open_method(self, mock_create):
        mock_create.return_value = self.mock_client
        self.mock_bucket.download.return_value = b"%PDF-1.4 test content"
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )

        opened = storage._open("documents/2026/test.pdf")
        self.assertEqual(opened.read(), b"%PDF-1.4 test content")
        self.mock_bucket.download.assert_called_once_with("documents/2026/test.pdf")

    @patch("supabase.create_client")
    def test_delete_method(self, mock_create):
        mock_create.return_value = self.mock_client
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )

        storage.delete("documents/2026/test.pdf")
        self.mock_bucket.remove.assert_called_once_with(["documents/2026/test.pdf"])

    @patch("supabase.create_client")
    def test_exists_method(self, mock_create):
        mock_create.return_value = self.mock_client
        self.mock_bucket.exists.return_value = True
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )

        self.assertTrue(storage.exists("documents/2026/test.pdf"))
        self.mock_bucket.exists.assert_called_once_with("documents/2026/test.pdf")

    @patch("supabase.create_client")
    def test_url_method(self, mock_create):
        mock_create.return_value = self.mock_client
        self.mock_bucket.get_public_url.return_value = "https://test.supabase.co/storage/v1/object/public/documind-pdfs/test.pdf"
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )

        url = storage.url("test.pdf")
        self.assertEqual(url, "https://test.supabase.co/storage/v1/object/public/documind-pdfs/test.pdf")

    @patch("supabase.create_client")
    def test_size_method(self, mock_create):
        mock_create.return_value = self.mock_client
        self.mock_bucket.info.return_value = {"size": 42}
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key",
            bucket_name="documind-pdfs"
        )

        self.assertEqual(storage.size("test.pdf"), 42)

    def test_path_raises_not_implemented(self):
        storage = SupabaseStorage(
            url="https://test.supabase.co",
            key="test-key"
        )
        with self.assertRaises(NotImplementedError):
            storage.path("test.pdf")
