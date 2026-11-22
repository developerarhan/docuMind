import json
import unittest
from unittest.mock import MagicMock, patch
from ai_engine.rag.pgvector_store import PgVectorStore


class PgVectorStoreTests(unittest.TestCase):
    @patch("ai_engine.rag.pgvector_store.connection.cursor")
    def test_mmr_parameter_order_with_document_and_user_filter(self, mock_cursor_func):
        mock_cursor = MagicMock()
        mock_cursor_func.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [
            ("chunk-1", "content 1", json.dumps({"page": 1}), "[0.1, 0.2]", 0.95),
            ("chunk-2", "content 2", json.dumps({"page": 2}), "[0.3, 0.4]", 0.85),
        ]

        store = PgVectorStore()
        results = store.max_marginal_relevance_search_by_vector(
            embedding=[0.1, 0.2],
            k=2,
            fetch_k=10,
            filter={
                "$and": [
                    {"document_id": 42},
                    {"user_id": 7}
                ]
            }
        )

        self.assertEqual(len(results), 2)
        # The query execution is the last cursor.execute call (after table creation)
        sql, params = mock_cursor.execute.call_args_list[-1][0]

        # 1st placeholder: SELECT similarity vector
        self.assertEqual(params[0], "[0.1,0.2]")
        # 2nd placeholder: WHERE document_id = %s
        self.assertEqual(params[1], 42)
        # 3rd placeholder: AND user_id = %s
        self.assertEqual(params[2], 7)
        # 4th placeholder: ORDER BY distance vector
        self.assertEqual(params[3], "[0.1,0.2]")
        # 5th placeholder: LIMIT fetch_k
        self.assertEqual(params[4], 10)

    @patch("ai_engine.rag.pgvector_store.connection.cursor")
    def test_mmr_parameter_order_without_filter(self, mock_cursor_func):
        mock_cursor = MagicMock()
        mock_cursor_func.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = []

        store = PgVectorStore()
        results = store.max_marginal_relevance_search_by_vector(
            embedding=[0.5, 0.6],
            k=4,
            fetch_k=20,
            filter=None
        )

        self.assertEqual(results, [])
        sql, params = mock_cursor.execute.call_args_list[-1][0]

        # 1st placeholder: SELECT similarity vector
        self.assertEqual(params[0], "[0.5,0.6]")
        # 2nd placeholder: ORDER BY distance vector
        self.assertEqual(params[1], "[0.5,0.6]")
        # 3rd placeholder: LIMIT fetch_k
        self.assertEqual(params[2], 20)
