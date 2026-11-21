import uuid
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import Document, Conversation, UserMemory
from core.views import serialize_messages

User = get_user_model()


class UnauthenticatedRequestsSecurityTests(TestCase):
    """
    Checklist: Test unauthenticated requests.
    Verifies that all protected endpoints reject requests lacking valid credentials,
    and invalid/expired tokens are properly denied with 401.
    """
    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_requests_denied_with_401_or_403(self):
        dummy_uuid = uuid.uuid4()
        endpoints = [
            ("get", "/api/documents/"),
            ("post", "/api/documents/"),
            ("delete", "/api/documents/1/"),
            ("post", "/api/documents/1/process/"),
            ("post", "/api/documents/1/chat/"),
            ("get", "/api/memories/"),
            ("post", "/api/memories/"),
            ("delete", "/api/memories/1/"),
            ("get", "/api/conversations/"),
            ("get", f"/api/conversations/{dummy_uuid}/"),
            ("delete", f"/api/conversations/{dummy_uuid}/"),
            ("get", f"/api/conversations/{dummy_uuid}/messages/"),
            ("get", "/api/auth/me/"),
            ("post", "/api/auth/logout/"),
        ]
        for method, url in endpoints:
            response = getattr(self.client, method)(url)
            self.assertIn(
                response.status_code,
                [401, 403],
                f"Expected 401 or 403 for {method.upper()} {url}, got {response.status_code}",
            )

    def test_invalid_token_rejected_with_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token invalid_or_expired_token_value_12345")
        response = self.client.get("/api/documents/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data.get("detail"), "Invalid token.")


class MultiTenantCrossUserDocumentSecurityTests(TestCase):
    """
    Checklist: Test accessing another user's documents.
    Verifies strict multi-tenant isolation: User A cannot read, process, chat with,
    or delete User B's documents, conversations, or memories.
    """
    def setUp(self):
        self.user_a = User.objects.create_user(username="tenant_a", password="password_a")
        self.user_b = User.objects.create_user(username="tenant_b", password="password_b")

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

        # Document belonging to User B
        self.doc_b = Document.objects.create(
            user=self.user_b,
            title="User B Confidential Document",
            file="documents/confidential_b.pdf",
            file_size=2048,
            status=Document.DocumentStatus.READY,
        )

        # Conversation belonging to User B
        self.conv_b = Conversation.objects.create(user=self.user_b, document=self.doc_b)

        # Memory belonging to User B
        self.mem_b = UserMemory.objects.create(
            user=self.user_b,
            memory="User B private financial information",
            category=UserMemory.Category.PREFERENCE,
        )

    def test_user_a_cannot_view_user_b_documents(self):
        response = self.client_a.get("/api/documents/")
        self.assertEqual(response.status_code, 200)
        doc_ids = [d["id"] for d in response.data]
        self.assertNotIn(self.doc_b.id, doc_ids)

    def test_user_a_cannot_delete_user_b_document(self):
        response = self.client_a.delete(f"/api/documents/{self.doc_b.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Document.objects.filter(id=self.doc_b.id).exists())

    def test_user_a_cannot_process_user_b_document(self):
        response = self.client_a.post(f"/api/documents/{self.doc_b.id}/process/")
        self.assertEqual(response.status_code, 404)

    def test_user_a_cannot_chat_with_user_b_document(self):
        response = self.client_a.post(
            f"/api/documents/{self.doc_b.id}/chat/",
            data={"question": "What confidential data is here?"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("Document not found", response.data.get("error", ""))

    def test_user_a_cannot_view_or_delete_user_b_conversation(self):
        # GET detail
        response = self.client_a.get(f"/api/conversations/{self.conv_b.id}/")
        self.assertEqual(response.status_code, 404)

        # DELETE detail
        response = self.client_a.delete(f"/api/conversations/{self.conv_b.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Conversation.objects.filter(id=self.conv_b.id).exists())

    def test_user_a_cannot_access_user_b_conversation_messages(self):
        response = self.client_a.get(f"/api/conversations/{self.conv_b.id}/messages/")
        self.assertEqual(response.status_code, 404)

    def test_user_a_cannot_delete_user_b_memory(self):
        response = self.client_a.delete(f"/api/memories/{self.mem_b.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(UserMemory.objects.filter(id=self.mem_b.id).exists())


class InvalidRequestPayloadsSecurityTests(TestCase):
    """
    Checklist: Test invalid request payloads.
    Verifies that malformed, incomplete, or invalid payloads return 400 Bad Request.
    """
    def setUp(self):
        self.user = User.objects.create_user(username="payload_tester", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.ready_doc = Document.objects.create(
            user=self.user,
            title="Ready Doc",
            file="ready.pdf",
            file_size=1024,
            status=Document.DocumentStatus.READY,
        )
        self.pending_doc = Document.objects.create(
            user=self.user,
            title="Pending Doc",
            file="pending.pdf",
            file_size=1024,
            status=Document.DocumentStatus.PENDING,
        )

    def test_upload_missing_file_payload_returns_400(self):
        response = self.client.post("/api/documents/", data={"title": "Missing File"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    def test_upload_empty_file_returns_400(self):
        empty_file = SimpleUploadedFile("empty.pdf", b"", content_type="application/pdf")
        response = self.client.post("/api/documents/", data={"file": empty_file, "title": "Empty"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", str(response.data).lower())

    def test_upload_corrupted_non_pdf_file_returns_400(self):
        fake_pdf = SimpleUploadedFile("fake.pdf", b"This is plain text not PDF", content_type="application/pdf")
        response = self.client.post("/api/documents/", data={"file": fake_pdf, "title": "Fake"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid file format", str(response.data))

    def test_chat_missing_question_returns_400(self):
        # Empty string
        response = self.client.post(
            f"/api/documents/{self.ready_doc.id}/chat/",
            data={"question": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Question is required", response.data.get("error", ""))

        # Missing key completely
        response = self.client.post(
            f"/api/documents/{self.ready_doc.id}/chat/",
            data={},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Question is required", response.data.get("error", ""))

    def test_chat_on_pending_document_returns_400(self):
        response = self.client.post(
            f"/api/documents/{self.pending_doc.id}/chat/",
            data={"question": "Is this document ready?"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Document is not ready for chat", response.data.get("error", ""))

    def test_chat_invalid_conversation_uuid_returns_400(self):
        response = self.client.post(
            f"/api/documents/{self.ready_doc.id}/chat/",
            data={"question": "What is in here?", "conversation_id": "malformed-not-a-uuid"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid conversation ID", response.data.get("error", ""))

    def test_chat_cross_document_conversation_hijacking_returns_404(self):
        doc_2 = Document.objects.create(
            user=self.user,
            title="Second Doc",
            file="doc2.pdf",
            file_size=500,
            status=Document.DocumentStatus.READY,
        )
        conv_2 = Conversation.objects.create(user=self.user, document=doc_2)

        # Attempt to chat with ready_doc using conv_2's ID
        response = self.client.post(
            f"/api/documents/{self.ready_doc.id}/chat/",
            data={"question": "Hello", "conversation_id": str(conv_2.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("Conversation not found", response.data.get("error", ""))

    def test_memory_creation_missing_text_returns_400(self):
        response = self.client.post(
            "/api/memories/",
            data={"category": "preference"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("memory", response.data)

    def test_memory_creation_invalid_category_returns_400(self):
        response = self.client.post(
            "/api/memories/",
            data={"memory": "I like dark mode", "category": "non_existent_category_type"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("category", response.data)

    def test_register_invalid_payload_returns_400(self):
        unauth_client = APIClient()
        # Passwords mismatch
        response = unauth_client.post(
            "/api/auth/register/",
            data={
                "username": "mismatch_user",
                "password": "Password123!",
                "password_confirm": "DifferentPassword123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.data)

        # Password too short (< 8 chars)
        response = unauth_client.post(
            "/api/auth/register/",
            data={
                "username": "short_pw_user",
                "password": "123",
                "password_confirm": "123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)


class MissingDocumentsAndConversationsSecurityTests(TestCase):
    """
    Checklist: Test missing documents and conversations.
    Verifies that non-existent entity lookups return 404 cleanly across all views.
    """
    def setUp(self):
        self.user = User.objects.create_user(username="not_found_user", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.non_existent_id = 999999
        self.non_existent_uuid = uuid.uuid4()

    def test_missing_document_delete_returns_404(self):
        response = self.client.delete(f"/api/documents/{self.non_existent_id}/")
        self.assertEqual(response.status_code, 404)

    def test_missing_document_process_returns_404(self):
        response = self.client.post(f"/api/documents/{self.non_existent_id}/process/")
        self.assertEqual(response.status_code, 404)

    def test_missing_document_chat_returns_404(self):
        response = self.client.post(
            f"/api/documents/{self.non_existent_id}/chat/",
            data={"question": "Does this document exist?"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("Document not found", response.data.get("error", ""))

    def test_missing_conversation_detail_returns_404(self):
        response = self.client.get(f"/api/conversations/{self.non_existent_uuid}/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Conversation not found", response.data.get("detail", ""))

    def test_missing_conversation_delete_returns_404(self):
        response = self.client.delete(f"/api/conversations/{self.non_existent_uuid}/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Conversation not found", response.data.get("detail", ""))

    def test_missing_conversation_messages_returns_404(self):
        response = self.client.get(f"/api/conversations/{self.non_existent_uuid}/messages/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Conversation not found", response.data.get("detail", ""))

    def test_missing_memory_delete_returns_404(self):
        response = self.client.delete(f"/api/memories/{self.non_existent_id}/")
        self.assertEqual(response.status_code, 404)


class RedisCeleryDispatchFailuresTests(TestCase):
    """
    Checklist: Test Redis/Celery dispatch failures.
    Verifies that when task queue dispatch fails, the API responds with 503 Service
    Unavailable, marks the document status as FAILED, and allows subsequent retries.
    """
    def setUp(self):
        self.user = User.objects.create_user(username="celery_tester", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.document = Document.objects.create(
            user=self.user,
            title="Dispatch Test Document",
            file="dispatch.pdf",
            file_size=2048,
            status=Document.DocumentStatus.PENDING,
        )

    @patch("core.views.process_document.delay")
    def test_celery_dispatch_failure_returns_503_and_marks_document_failed(self, mock_delay):
        mock_delay.side_effect = Exception("Redis broker connection refused: localhost:6379")

        response = self.client.post(f"/api/documents/{self.document.id}/process/")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Failed to dispatch document processing task", response.data.get("detail", ""))
        self.assertEqual(response.data.get("status"), Document.DocumentStatus.FAILED)

        # Database state verification
        self.document.refresh_from_db()
        self.assertEqual(self.document.status, Document.DocumentStatus.FAILED)

    @patch("core.views.process_document.delay")
    def test_retry_after_celery_dispatch_failure_succeeds(self, mock_delay):
        # 1. First trigger failure
        mock_delay.side_effect = Exception("Temporary Redis outage")
        fail_response = self.client.post(f"/api/documents/{self.document.id}/process/")
        self.assertEqual(fail_response.status_code, 503)

        self.document.refresh_from_db()
        self.assertEqual(self.document.status, Document.DocumentStatus.FAILED)

        # 2. Celery/Redis recovers; retry processing
        mock_delay.side_effect = None
        mock_delay.return_value = MagicMock(id="task-recovery-id-123")

        retry_response = self.client.post(f"/api/documents/{self.document.id}/process/")
        self.assertEqual(retry_response.status_code, 202)
        self.assertEqual(retry_response.data.get("status"), Document.DocumentStatus.PROCESSING)

        self.document.refresh_from_db()
        self.assertEqual(self.document.status, Document.DocumentStatus.PROCESSING)


class DatabaseAndVectorStoreFailuresTests(TestCase):
    """
    Checklist: Test database and vector-store failures.
    Verifies that backend operational errors or vector-store failures are caught gracefully
    without exposing raw exceptions or breaking the service.
    """
    def setUp(self):
        self.user = User.objects.create_user(username="failure_tester", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.ready_doc = Document.objects.create(
            user=self.user,
            title="Vector Failure Test Doc",
            file="ready.pdf",
            file_size=1024,
            status=Document.DocumentStatus.READY,
        )

    @patch("core.views.chat_with_document")
    def test_vector_store_timeout_during_chat_returns_500(self, mock_chat):
        mock_chat.side_effect = RuntimeError("ChromaDB vector store connection timeout: port 8000")

        response = self.client.post(
            f"/api/documents/{self.ready_doc.id}/chat/",
            data={"question": "Query that hits failing vector store"},
            format="json",
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data.get("error"), "Failed to generate document answer.")
        # Ensure internal stack trace is not exposed
        self.assertNotIn("ChromaDB vector store connection timeout", str(response.data))

    @patch("core.views.get_checkpointer")
    def test_checkpointer_storage_deletion_isolated(self, mock_get_checkpointer):
        conv = Conversation.objects.create(user=self.user, document=self.ready_doc)
        mock_checkpointer = MagicMock()
        mock_get_checkpointer.return_value = mock_checkpointer

        response = self.client.delete(f"/api/conversations/{conv.id}/")
        self.assertEqual(response.status_code, 204)
        mock_checkpointer.delete_thread.assert_called_once_with(str(conv.id))
        self.assertFalse(Conversation.objects.filter(id=conv.id).exists())


class InformationDisclosureSecurityTests(TestCase):
    """
    Checklist: Verify API responses don't expose internal paths, credentials or unnecessary document data.
    Verifies that:
    1. Document serialization returns only public/relative media URLs, not absolute server disk paths.
    2. UserProfile and Auth responses never include password hashes, salts, or privileged flags.
    3. Error payloads omit internal database credentials and system secret keys.
    """
    def setUp(self):
        self.user = User.objects.create_user(
            username="disclosure_tester",
            email="tester@documind.internal",
            password="StrongPassword123!",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.doc = Document.objects.create(
            user=self.user,
            title="Data Safety Document",
            file="documents/safety_test.pdf",
            file_size=4096,
            status=Document.DocumentStatus.READY,
        )

    def test_document_list_does_not_expose_absolute_internal_filesystem_paths(self):
        response = self.client.get("/api/documents/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) > 0)

        for doc_data in response.data:
            file_url = doc_data.get("file", "")
            # Ensure no absolute paths like D:\, C:\, /home/, /var/ are leaked
            self.assertFalse(
                file_url.startswith("C:") or file_url.startswith("D:") or file_url.startswith("/home"),
                f"Absolute filesystem path leaked in file field: {file_url}"
            )
            self.assertNotIn("FullStackProject", file_url)
            self.assertNotIn("appDataDir", file_url)

    def test_user_profile_does_not_expose_password_hash_or_superuser_fields(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)

        # Expected public fields
        self.assertIn("id", response.data)
        self.assertIn("username", response.data)
        self.assertIn("email", response.data)

        # Sensitive fields that MUST NOT be exposed
        self.assertNotIn("password", response.data)
        self.assertNotIn("is_superuser", response.data)
        self.assertNotIn("is_staff", response.data)
        self.assertNotIn("user_permissions", response.data)
        self.assertNotIn("groups", response.data)

    def test_auth_login_and_register_response_does_not_leak_password_hashes(self):
        unauth_client = APIClient()
        response = unauth_client.post(
            "/api/auth/login/",
            data={"username": "disclosure_tester", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        user_info = response.data.get("user", {})
        self.assertNotIn("password", user_info)
        self.assertNotIn("password_hash", user_info)

    def test_error_responses_do_not_leak_database_credentials_or_environment_secrets(self):
        # Trigger an intentional error (chat on non-existent document)
        response = self.client.post(
            "/api/documents/99999/chat/",
            data={"question": "Secret test query?"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        response_str = str(response.data)

        # Sensitive secrets that must never appear in API responses
        forbidden_strings = [
            "POSTGRES_PASSWORD",
            "documind_user",
            "DJANGO_SECRET_KEY",
            "SECRET_KEY",
            "OPENAI_API_KEY",
            "psycopg",
            "Traceback (most recent call last)",
        ]
        for secret in forbidden_strings:
            self.assertNotIn(
                secret,
                response_str,
                f"Sensitive configuration '{secret}' exposed in API error response: {response_str}"
            )

    @patch("core.views.extract_conversation_memories.delay")
    @patch("core.views.chat_with_document")
    def test_chat_response_payload_structure_cleanliness(self, mock_chat, mock_extract):
        mock_chat.return_value = {
            "answer": "Document summary according to [Source 1].",
            "sources": [
                {
                    "source_id": 1,
                    "page": 3,
                    "relevance_score": 0.95,
                }
            ],
        }

        response = self.client.post(
            f"/api/documents/{self.doc.id}/chat/",
            data={"question": "Give summary"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["answer"], "Document summary according to [Source 1].")
        self.assertIn("conversation_id", response.data)
        self.assertIn("document_id", response.data)

        # Ensure sources does not leak server host files or raw embedding vectors
        for src in response.data.get("sources", []):
            self.assertNotIn("embedding", src)
            self.assertNotIn("absolute_path", src)


class MessageSerializationTests(TestCase):
    """
    Tests message role mapping utility.
    """
    def test_serialize_messages_role_mapping(self):
        msg_human = MagicMock(type="human", content="Hello!")
        msg_ai = MagicMock(type="ai", content="Hi there!")
        msg_system = MagicMock(type="system", content="System instruction")

        serialized = serialize_messages([msg_human, msg_ai, msg_system])
        self.assertEqual(serialized[0], {"role": "human", "content": "Hello!"})
        self.assertEqual(serialized[1], {"role": "assistant", "content": "Hi there!"})
        self.assertEqual(serialized[2], {"role": "system", "content": "System instruction"})
