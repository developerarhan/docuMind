import io
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import Document, Conversation
from core.serializers import DocumentUploadSerializer
from core.services.document_service import delete_document
from core.tasks import process_document

User = get_user_model()


def create_minimal_valid_pdf_bytes():
    """Generate a valid PDF byte stream using pypdf.PdfWriter."""
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


class DocumentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")

    def test_document_creation_defaults(self):
        doc = Document.objects.create(
            user=self.user,
            title="Sample Research Paper",
            file="documents/sample.pdf",
            file_size=1024,
        )
        self.assertEqual(doc.status, Document.DocumentStatus.PENDING)
        self.assertEqual(str(doc), "Sample Research Paper")
        self.assertIsNotNone(doc.created_at)
        self.assertIsNotNone(doc.updated_at)


class DocumentUploadSerializerValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")

    def test_valid_pdf_file_passes_validation(self):
        pdf_bytes = create_minimal_valid_pdf_bytes()
        uploaded = SimpleUploadedFile("sample.pdf", pdf_bytes, content_type="application/pdf")

        serializer = DocumentUploadSerializer(data={"title": "Valid PDF", "file": uploaded})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_empty_file_rejected(self):
        empty_file = SimpleUploadedFile("empty.pdf", b"", content_type="application/pdf")
        serializer = DocumentUploadSerializer(data={"title": "Empty", "file": empty_file})

        self.assertFalse(serializer.is_valid())
        self.assertTrue(any("empty" in str(e).lower() for e in serializer.errors.get("file", [])))

    def test_file_exceeding_max_size_rejected(self):
        oversized = SimpleUploadedFile("big.pdf", b"%PDF-" + b"0" * 10, content_type="application/pdf")
        oversized.size = 11 * 1024 * 1024  # 11 MB

        serializer = DocumentUploadSerializer(data={"title": "Big", "file": oversized})
        self.assertFalse(serializer.is_valid())
        self.assertIn("File size cannot exceed 10 MB", str(serializer.errors["file"]))

    def test_invalid_header_non_pdf_rejected(self):
        non_pdf = SimpleUploadedFile("text.txt", b"Hello plain text content", content_type="text/plain")
        serializer = DocumentUploadSerializer(data={"title": "Not PDF", "file": non_pdf})

        self.assertFalse(serializer.is_valid())
        self.assertIn("Only valid PDF files are allowed", str(serializer.errors["file"]))

    def test_corrupted_pdf_rejected(self):
        corrupted = SimpleUploadedFile("corrupt.pdf", b"%PDF-corrupted-binary-trash", content_type="application/pdf")
        serializer = DocumentUploadSerializer(data={"title": "Corrupted", "file": corrupted})

        self.assertFalse(serializer.is_valid())
        self.assertIn("PDF file is corrupted or unreadable", str(serializer.errors["file"]))


class DocumentUploadAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_upload_valid_pdf_and_verify_metadata_in_db(self):
        pdf_bytes = create_minimal_valid_pdf_bytes()
        uploaded = SimpleUploadedFile("research.pdf", pdf_bytes, content_type="application/pdf")

        response = self.client.post(
            "/api/documents/",
            data={"title": "Quantum Computing", "file": uploaded},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Quantum Computing")
        self.assertEqual(response.data["status"], "pending")
        self.assertGreater(response.data["file_size"], 0)

        # Verify PostgreSQL database record and ownership
        doc = Document.objects.get(title="Quantum Computing")
        self.assertEqual(doc.user, self.user)
        self.assertEqual(doc.file_size, len(pdf_bytes))
        self.assertEqual(doc.status, Document.DocumentStatus.PENDING)

    def test_upload_rejects_empty_file_via_api(self):
        empty_file = SimpleUploadedFile("empty.pdf", b"", content_type="application/pdf")
        response = self.client.post(
            "/api/documents/",
            data={"title": "Empty Doc", "file": empty_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    @patch("core.serializers.DocumentUploadSerializer.validate_file")
    def test_upload_rejects_oversized_file_via_api(self, mock_validate):
        from rest_framework.exceptions import ValidationError
        mock_validate.side_effect = ValidationError("File size cannot exceed 10 MB.")
        pdf_bytes = create_minimal_valid_pdf_bytes()
        oversized = SimpleUploadedFile("huge.pdf", pdf_bytes, content_type="application/pdf")

        response = self.client.post(
            "/api/documents/",
            data={"title": "Huge Doc", "file": oversized},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("File size cannot exceed 10 MB", str(response.data))

    def test_upload_rejects_non_pdf_file_via_api(self):
        text_file = SimpleUploadedFile("notes.txt", b"Plain text notes", content_type="text/plain")
        response = self.client.post(
            "/api/documents/",
            data={"title": "Notes", "file": text_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Only valid PDF files are allowed", str(response.data))

    def test_upload_rejects_corrupted_pdf_via_api(self):
        corrupted = SimpleUploadedFile("corrupt.pdf", b"%PDF-broken-pdf-stream", content_type="application/pdf")
        response = self.client.post(
            "/api/documents/",
            data={"title": "Corrupt", "file": corrupted},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("PDF file is corrupted or unreadable", str(response.data))


class DocumentProcessViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")
        self.client.force_login(self.user)
        self.doc = Document.objects.create(
            user=self.user,
            title="Doc 1",
            file="documents/sample.pdf",
            file_size=2048,
            status=Document.DocumentStatus.PENDING,
        )

    @patch("core.views.process_document.delay")
    def test_process_pending_document_dispatches_task(self, mock_delay):
        response = self.client.post(f"/api/documents/{self.doc.id}/process/")
        self.assertEqual(response.status_code, 202)
        mock_delay.assert_called_once_with(self.doc.id)

        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, Document.DocumentStatus.PROCESSING)

    @patch("core.views.process_document.delay")
    def test_process_failed_document_can_be_retried(self, mock_delay):
        self.doc.status = Document.DocumentStatus.FAILED
        self.doc.save()

        response = self.client.post(f"/api/documents/{self.doc.id}/process/")
        self.assertEqual(response.status_code, 202)
        mock_delay.assert_called_once_with(self.doc.id)

    def test_process_already_processing_document_rejected(self):
        self.doc.status = Document.DocumentStatus.PROCESSING
        self.doc.save()

        response = self.client.post(f"/api/documents/{self.doc.id}/process/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already being processed", response.data["detail"])

    def test_process_already_ready_document_rejected(self):
        self.doc.status = Document.DocumentStatus.READY
        self.doc.save()

        response = self.client.post(f"/api/documents/{self.doc.id}/process/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already been processed", response.data["detail"])

    @patch("core.views.process_document.delay", side_effect=Exception("Broker unreachable"))
    def test_process_task_dispatch_failure_marks_document_failed(self, mock_delay):
        response = self.client.post(f"/api/documents/{self.doc.id}/process/")
        self.assertEqual(response.status_code, 503)

        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, Document.DocumentStatus.FAILED)


class CeleryDocumentProcessingTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")
        self.doc = Document.objects.create(
            user=self.user,
            title="Processing Task Doc",
            file="documents/sample.pdf",
            file_size=2048,
            status=Document.DocumentStatus.PENDING,
        )

    @patch("ai_engine.rag.vector_store.create_vector_store")
    @patch("ai_engine.rag.embeddings.get_embedding_model")
    @patch("ai_engine.rag.ingestion.split_documents")
    @patch("ai_engine.rag.ingestion.load_document")
    def test_celery_task_success_indexes_to_chroma_and_sets_ready(
        self, mock_load, mock_split, mock_get_emb, mock_create_vs
    ):
        dummy_docs = [MagicMock(page_content="page 1 content")]
        dummy_chunks = [MagicMock(page_content="chunk 1 content")]
        mock_load.return_value = dummy_docs
        mock_split.return_value = dummy_chunks
        mock_emb = MagicMock()
        mock_get_emb.return_value = mock_emb

        result = process_document(self.doc.id)

        # 1. Verify Chroma vector store creation with expected chunks and user ownership
        mock_create_vs.assert_called_once_with(
            dummy_chunks,
            mock_emb,
            document_id=self.doc.id,
            user_id=self.user.id,
        )

        # 2. Verify status transitions to READY in PostgreSQL
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, Document.DocumentStatus.READY)
        self.assertEqual(result, f"Document {self.doc.id} processed successfully.")

    @patch("ai_engine.rag.ingestion.load_document", side_effect=Exception("PDF parse failure"))
    def test_celery_task_retries_on_failure(self, mock_load):
        # Create mock task instance with retry tracking
        task = process_document
        task.request.retries = 1
        task.max_retries = 3

        with patch.object(task, "retry", side_effect=Exception("Task retry invoked")) as mock_retry:
            with self.assertRaises(Exception) as ctx:
                task(self.doc.id)

            self.assertIn("Task retry invoked", str(ctx.exception))
            mock_retry.assert_called_once()
            call_kwargs = mock_retry.call_args[1]
            self.assertEqual(call_kwargs["countdown"], 120)  # 60 * 2^1

    @patch("ai_engine.rag.ingestion.load_document", side_effect=Exception("Permanent failure"))
    def test_celery_task_final_failure_marks_document_failed(self, mock_load):
        task = process_document
        task.request.retries = 3
        task.max_retries = 3

        with self.assertRaises(Exception) as ctx:
            task(self.doc.id)

        self.assertIn("Permanent failure", str(ctx.exception))
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, Document.DocumentStatus.FAILED)


class DocumentDeletionServiceAndAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.doc = Document.objects.create(
            user=self.user,
            title="To Delete",
            file="documents/sample.pdf",
            file_size=1024,
            status=Document.DocumentStatus.READY,
        )
        self.conv = Conversation.objects.create(user=self.user, document=self.doc)

    @patch("core.services.document_service.get_vector_store")
    @patch("core.services.document_service.get_embedding_model")
    @patch("core.services.document_service.get_checkpointer")
    def test_delete_document_cleans_resources_and_removes_db_record(
        self, mock_get_checkpointer, mock_get_embedding, mock_get_vector_store
    ):
        mock_vs = MagicMock()
        mock_get_vector_store.return_value = mock_vs
        mock_checkpointer = MagicMock()
        mock_get_checkpointer.return_value = mock_checkpointer

        doc_id = self.doc.id
        conv_id = str(self.conv.id)

        delete_document(self.doc)

        # 1. Chroma vector store deletion called for document and user
        mock_vs._collection.delete.assert_called_once_with(
            where={"$and": [{"document_id": doc_id}, {"user_id": self.user.id}]}
        )
        # 2. Checkpoint thread deletion called for all associated conversations
        mock_checkpointer.delete_thread.assert_called_with(conv_id)
        # 3. Document record deleted from DB
        self.assertFalse(Document.objects.filter(id=doc_id).exists())
        # 4. Associated conversation cascaded
        self.assertFalse(Conversation.objects.filter(id=conv_id).exists())

    @patch("core.services.document_service.get_vector_store")
    @patch("core.services.document_service.get_embedding_model")
    @patch("core.services.document_service.get_checkpointer")
    def test_delete_document_via_api_returns_204_and_removes_record(
        self, mock_get_checkpointer, mock_get_embedding, mock_get_vector_store
    ):
        mock_get_vector_store.return_value = MagicMock()
        mock_get_checkpointer.return_value = MagicMock()

        doc_id = self.doc.id
        response = self.client.delete(f"/api/documents/{doc_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Document.objects.filter(id=doc_id).exists())
