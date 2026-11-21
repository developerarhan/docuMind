import uuid
from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from pydantic import ValidationError
from rest_framework.test import APIClient
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from core.models import UserMemory as UserMemoryModel, Conversation, Document
from ai_engine.memory.schemas import UserMemory as UserMemorySchema, MemoryDecision
from ai_engine.agents.trim_messages import trim_conversation
from core.services.memory_service import (
    save_memory,
    save_memories,
    get_memories,
    format_memories_for_agent,
    format_conversation_for_memory,
    extract_and_save_memories,
    process_new_memory,
    execute_memory_decision,
)
from core.tasks import extract_conversation_memories
from ai_engine.memory.schemas import MemoryExtractionResult
from core.services.document_service import get_conversation_messages

User = get_user_model()


class MemoryModelAndServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="charlie", password="password123")

    def test_save_memory_from_dict_creates_record(self):
        data = {"memory": "Prefers dark mode and concise summaries", "category": "preference"}
        record = save_memory(self.user, data)

        self.assertIsNotNone(record)
        self.assertEqual(record.user, self.user)
        self.assertEqual(record.memory, "Prefers dark mode and concise summaries")
        self.assertEqual(record.category, "preference")

    def test_save_memory_from_pydantic_schema(self):
        schema = UserMemorySchema(
            memory="Learning PyTorch for computer vision",
            category="learning_goal"
        )
        record = save_memory(self.user, schema)

        self.assertIsNotNone(record)
        self.assertEqual(record.memory, "Learning PyTorch for computer vision")
        self.assertEqual(record.category, "learning_goal")

    def test_save_memory_empty_string_returns_none(self):
        self.assertIsNone(save_memory(self.user, {"memory": "   ", "category": "other"}))
        self.assertIsNone(save_memory(self.user, {"memory": "", "category": "other"}))

    def test_save_memories_skips_in_batch_duplicates(self):
        batch = [
            UserMemorySchema(memory="Likes Python", category="preference"),
            UserMemorySchema(memory="Likes Python", category="preference"),
            UserMemorySchema(memory="Learning Django", category="learning_goal"),
        ]
        records = save_memories(self.user, batch)
        self.assertEqual(len(records), 2)

    def test_save_memories_skips_existing_db_duplicates(self):
        UserMemoryModel.objects.create(
            user=self.user, memory="Likes Python", category="preference"
        )
        batch = [
            UserMemorySchema(memory="Likes Python", category="preference"),
            UserMemorySchema(memory="Learning LangChain", category="learning_goal"),
        ]
        records = save_memories(self.user, batch)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].memory, "Learning LangChain")

    def test_format_memories_empty(self):
        formatted = format_memories_for_agent(self.user)
        self.assertEqual(formatted, "No stored memories about this user.")

    def test_format_memories_with_records(self):
        UserMemoryModel.objects.create(
            user=self.user, memory="Visual learner", category="preference"
        )
        UserMemoryModel.objects.create(
            user=self.user, memory="Mastering RAG", category="learning_goal"
        )

        formatted = format_memories_for_agent(self.user)
        self.assertIn("[preference] Visual learner", formatted)
        self.assertIn("[learning_goal] Mastering RAG", formatted)


class LongTermMemoryLifecycleAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="mem_user", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_long_term_memory_creation_via_api(self):
        payload = {
            "memory": "Prefers step-by-step math derivations",
            "category": "preference",
        }
        response = self.client.post("/api/memories/", data=payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["memory"], "Prefers step-by-step math derivations")
        self.assertEqual(response.data["category"], "preference")
        self.assertTrue(UserMemoryModel.objects.filter(user=self.user, memory=payload["memory"]).exists())

    def test_long_term_memory_update_via_decision(self):
        mem = UserMemoryModel.objects.create(
            user=self.user, memory="Uses Python 3.11", category="personal_context"
        )
        decision = MemoryDecision(
            action="UPDATE",
            memory_id=mem.id,
            reason="User upgraded Python"
        )
        new_schema = UserMemorySchema(memory="Uses Python 3.13", category="personal_context")

        updated = execute_memory_decision(self.user, new_schema, decision)
        mem.refresh_from_db()
        self.assertEqual(mem.memory, "Uses Python 3.13")

    def test_long_term_memory_deletion_via_api(self):
        mem = UserMemoryModel.objects.create(
            user=self.user, memory="Temporary note to delete", category="other"
        )
        response = self.client.delete(f"/api/memories/{mem.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(UserMemoryModel.objects.filter(id=mem.id).exists())


class MessageTrimmingTests(TestCase):
    @patch("ai_engine.agents.trim_messages.model")
    def test_trim_conversation_reduces_long_history(self, mock_model):
        # Mock token counter to treat each message as 10 tokens
        mock_model.get_num_tokens_from_messages.side_effect = lambda msgs: len(msgs) * 10

        messages = [
            SystemMessage(content="You are DocuMind."),
            HumanMessage(content="Message 1"),
            AIMessage(content="Reply 1"),
            HumanMessage(content="Message 2"),
            AIMessage(content="Reply 2"),
            HumanMessage(content="Message 3"),
            AIMessage(content="Reply 3"),
            HumanMessage(content="Message 4"),
            AIMessage(content="Reply 4"),
        ]

        # Max tokens 40: keeps system message + last human/AI messages within token limit
        trimmed = trim_conversation(messages, max_tokens=40)

        self.assertLess(len(trimmed), len(messages))
        # Ensure system message is preserved
        self.assertIsInstance(trimmed[0], SystemMessage)
        self.assertEqual(trimmed[0].content, "You are DocuMind.")
        # Ensure it starts on human message after system
        self.assertIsInstance(trimmed[1], HumanMessage)


class ConversationPersistenceAndIsolationTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="user_a", password="password_a")
        self.user_b = User.objects.create_user(username="user_b", password="password_b")

        self.doc_a = Document.objects.create(user=self.user_a, title="Doc A", file="a.pdf", file_size=100)
        self.doc_b = Document.objects.create(user=self.user_b, title="Doc B", file="b.pdf", file_size=100)

        self.conv_a1 = Conversation.objects.create(user=self.user_a, document=self.doc_a)
        self.conv_a2 = Conversation.objects.create(user=self.user_a, document=self.doc_a)
        self.conv_b = Conversation.objects.create(user=self.user_b, document=self.doc_b)

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

    @patch("core.services.document_service.get_agent")
    def test_conversation_history_persists_across_agent_reinitialization(self, mock_get_agent):
        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.values = {
            "messages": [
                HumanMessage(content="Question from earlier session"),
                AIMessage(content="Answer from earlier session"),
            ]
        }
        mock_agent.get_state.return_value = mock_state
        mock_get_agent.return_value = mock_agent

        # Simulate agent reinitialization / fresh state retrieval
        messages = get_conversation_messages(self.conv_a1)

        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].content, "Question from earlier session")
        self.assertEqual(messages[1].content, "Answer from earlier session")
        mock_agent.get_state.assert_called_once_with({"configurable": {"thread_id": str(self.conv_a1.id)}})

    @patch("core.services.document_service.get_agent")
    def test_different_conversations_do_not_share_messages(self, mock_get_agent):
        mock_agent = MagicMock()

        def side_effect(config):
            t_id = config["configurable"]["thread_id"]
            state = MagicMock()
            if t_id == str(self.conv_a1.id):
                state.values = {"messages": [HumanMessage(content="Thread 1 content")]}
            elif t_id == str(self.conv_a2.id):
                state.values = {"messages": [HumanMessage(content="Thread 2 content")]}
            else:
                state.values = {"messages": []}
            return state

        mock_agent.get_state.side_effect = side_effect
        mock_get_agent.return_value = mock_agent

        msgs_1 = get_conversation_messages(self.conv_a1)
        msgs_2 = get_conversation_messages(self.conv_a2)

        self.assertEqual(len(msgs_1), 1)
        self.assertEqual(msgs_1[0].content, "Thread 1 content")

        self.assertEqual(len(msgs_2), 1)
        self.assertEqual(msgs_2[0].content, "Thread 2 content")

        # Confirm they do not share messages
        self.assertNotEqual(msgs_1[0].content, msgs_2[0].content)

    def test_different_users_cannot_access_each_others_conversations(self):
        # User A requests User B's conversation messages
        response = self.client_a.get(f"/api/conversations/{self.conv_b.id}/messages/")
        self.assertEqual(response.status_code, 404)

        # User A requests User B's conversation detail
        response_detail = self.client_a.get(f"/api/conversations/{self.conv_b.id}/")
        self.assertEqual(response_detail.status_code, 404)

        # User A lists conversations: must not include User B's conversation
        response_list = self.client_a.get("/api/conversations/")
        self.assertEqual(response_list.status_code, 200)
        returned_ids = [c["id"] for c in response_list.data]
        self.assertIn(str(self.conv_a1.id), returned_ids)
        self.assertIn(str(self.conv_a2.id), returned_ids)
        self.assertNotIn(str(self.conv_b.id), returned_ids)


class ConversationDeletionCleansCheckpointsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="del_user", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.doc = Document.objects.create(user=self.user, title="Doc", file="d.pdf", file_size=100)
        self.conv = Conversation.objects.create(user=self.user, document=self.doc)

    @patch("core.views.get_checkpointer")
    def test_deleting_conversation_also_deletes_its_checkpoints(self, mock_get_checkpointer):
        mock_checkpointer = MagicMock()
        mock_get_checkpointer.return_value = mock_checkpointer

        conv_id = str(self.conv.id)
        response = self.client.delete(f"/api/conversations/{conv_id}/")

        # 1. Verifies 204 No Content
        self.assertEqual(response.status_code, 204)

        # 2. Verifies checkpointer thread deletion called with conversation UUID
        mock_checkpointer.delete_thread.assert_called_once_with(conv_id)

        # 3. Verifies conversation removed from PostgreSQL
        self.assertFalse(Conversation.objects.filter(id=conv_id).exists())


class MemoryExtractionEndToEndTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="extract_user", password="password123")
        self.doc = Document.objects.create(
            user=self.user,
            title="AI Architecture Doc",
            file="ai.pdf",
            file_size=1024,
            status=Document.DocumentStatus.READY
        )
        self.conv = Conversation.objects.create(user=self.user, document=self.doc)

    def test_format_conversation_for_memory_handles_dicts_and_objects(self):
        conversation_mixed = [
            HumanMessage(content="I am developing with Python and Django."),
            AIMessage(content="Django is a great choice."),
            {"role": "user", "content": "I prefer async tasks with Celery."},
            {"role": "assistant", "content": "Celery pairs nicely with Redis."},
        ]
        formatted = format_conversation_for_memory(conversation_mixed)

        self.assertIn("User: I am developing with Python and Django.", formatted)
        self.assertIn("Assistant: Django is a great choice.", formatted)
        self.assertIn("User: I prefer async tasks with Celery.", formatted)
        self.assertIn("Assistant: Celery pairs nicely with Redis.", formatted)

    @patch("core.services.memory_service.memory_extraction_chain")
    def test_extract_and_save_memories_persists_to_user_memory(self, mock_chain):
        mock_chain.invoke.return_value = MemoryExtractionResult(
            memories=[
                UserMemorySchema(
                    memory="Prefers PostgreSQL for database backend",
                    category="preference"
                ),
                UserMemorySchema(
                    memory="Learning LangGraph multi-agent workflows",
                    category="learning_goal"
                )
            ]
        )

        messages = [
            HumanMessage(content="I always use PostgreSQL for my database backend."),
            AIMessage(content="Noted."),
            HumanMessage(content="Currently I'm learning LangGraph multi-agent workflows."),
            AIMessage(content="Exciting topic!"),
        ]

        results = extract_and_save_memories(self.user, messages)

        self.assertEqual(len(results), 2)
        self.assertTrue(all(r["success"] for r in results))

        # Verify records exist in database
        db_memories = UserMemoryModel.objects.filter(user=self.user)
        self.assertEqual(db_memories.count(), 2)

        mem_texts = [m.memory for m in db_memories]
        self.assertIn("Prefers PostgreSQL for database backend", mem_texts)
        self.assertIn("Learning LangGraph multi-agent workflows", mem_texts)

    def test_extract_and_save_memories_empty_conversation_returns_empty_list(self):
        results = extract_and_save_memories(self.user, [])
        self.assertEqual(results, [])
        self.assertEqual(UserMemoryModel.objects.filter(user=self.user).count(), 0)

    @patch("core.services.memory_service.memory_extraction_chain")
    @patch("core.services.document_service.get_agent")
    def test_extract_conversation_memories_task_end_to_end(self, mock_get_agent, mock_chain):
        # Mock agent state for checkpoint retrieval
        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.values = {
            "messages": [
                HumanMessage(content="My primary language is Go."),
                AIMessage(content="Go is very performant."),
            ]
        }
        mock_agent.get_state.return_value = mock_state
        mock_get_agent.return_value = mock_agent

        mock_chain.invoke.return_value = MemoryExtractionResult(
            memories=[
                UserMemorySchema(
                    memory="Primary programming language is Go",
                    category="personal_context"
                )
            ]
        )

        task_results = extract_conversation_memories(self.user.id, self.conv.id)

        self.assertEqual(len(task_results), 1)
        self.assertTrue(task_results[0]["success"])

        # Verify persisted record
        saved_record = UserMemoryModel.objects.filter(
            user=self.user,
            memory="Primary programming language is Go"
        ).first()
        self.assertIsNotNone(saved_record)
        self.assertEqual(saved_record.category, "personal_context")

