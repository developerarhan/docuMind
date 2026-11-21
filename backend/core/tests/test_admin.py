from django.test import TestCase, RequestFactory
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock

from core.models import Document, Conversation
from core.admin import DocumentAdmin, ConversationAdmin

User = get_user_model()


class MockAdminSite(AdminSite):
    pass


class AdminDisplayTests(TestCase):
    def setUp(self):
        self.site = MockAdminSite()
        self.user = User.objects.create_user(username="admintester", password="password123")
        self.factory = RequestFactory()

        self.doc = Document.objects.create(
            user=self.user,
            title="Admin Test Document",
            file="documents/test.pdf",
            file_size=1024,
            status=Document.DocumentStatus.READY,
        )
        self.conv = Conversation.objects.create(user=self.user, document=self.doc)

    def test_document_admin_renders_chunks_safely_without_format_html_errors(self):
        admin = DocumentAdmin(Document, self.site)

        # 1. Test when no chunks exist
        count_html = admin.chroma_chunks_count(self.doc)
        self.assertIn("0 chunks", str(count_html))

        preview_html = admin.chroma_chunks_preview(self.doc)
        self.assertIn("No vector chunks found", str(preview_html))

        # 2. Test when chunks contain curly braces (e.g. JSON, CSS snippets)
        mock_chunks = [
            {
                "id": "chunk_abc123456789",
                "text": "Code with curly braces: function test() { return {'status': 200}; }",
                "page": 1,
                "length": 65,
            }
        ]
        with patch("core.admin._get_chroma_chunks_for_document", return_value=mock_chunks):
            count_html = admin.chroma_chunks_count(self.doc)
            self.assertIn("1 chunks", str(count_html))

            # Must render without KeyError or ValueError from format_html
            preview_html = admin.chroma_chunks_preview(self.doc)
            self.assertIn("function test()", str(preview_html))
            self.assertIn("Page 1", str(preview_html))

    def test_conversation_admin_renders_messages_safely_without_format_html_errors(self):
        admin = ConversationAdmin(Conversation, self.site)

        # 1. Test empty thread
        with patch("core.admin.get_conversation_messages", return_value=[]):
            status_html = admin.checkpoint_thread_status(self.conv)
            self.assertIn("Empty thread", str(status_html))

            empty_history = admin.checkpoint_memory_history(self.conv)
            self.assertIn("No message history found", str(empty_history))

        # 2. Test messages with curly braces, JSON payloads, and tool outputs
        mock_msg_human = MagicMock(type="human", content="Query with json { 'key': 'value' }")
        mock_msg_ai = MagicMock(type="ai", content="AI response: { 'result': 42 }")
        mock_msg_tool = MagicMock(type="tool", content="Tool snippet { x: 1 }")
        mock_msg_tool.name = "summarize_document"

        with patch("core.admin.get_conversation_messages", return_value=[mock_msg_human, mock_msg_ai, mock_msg_tool]):
            status_html = admin.checkpoint_thread_status(self.conv)
            self.assertIn("3 messages", str(status_html))

            # Must render without KeyError or ValueError from format_html
            history_html = admin.checkpoint_memory_history(self.conv)
            self.assertIn("User (Human)", str(history_html))
            self.assertIn("DocuMind AI", str(history_html))
            self.assertIn("Tool (summarize_document)", str(history_html))
            self.assertIn("Query with json", str(history_html))
