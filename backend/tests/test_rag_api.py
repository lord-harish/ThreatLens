import io
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import main


class RagApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(self.temporary_directory.name)
        self.upload_directory = root / "uploads"
        self.database_path = root / "documents.sqlite3"
        self.path_patches = (
            patch.object(main, "UPLOAD_DIR", self.upload_directory),
            patch.object(main, "DATABASE_PATH", self.database_path),
        )
        for path_patch in self.path_patches:
            path_patch.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        for path_patch in reversed(self.path_patches):
            path_patch.stop()
        self.temporary_directory.cleanup()

    def create_extracted_document(self, filename, content):
        uploaded = self.client.post(
            "/api/documents/upload",
            files={"file": (filename, content, "text/plain")},
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        document = uploaded.json()
        extracted = self.client.post(f"/api/documents/{document['id']}/extract")
        self.assertEqual(extracted.status_code, 200, extracted.text)
        return document

    def fake_index_result(self, document_id, filename, segments, **kwargs):
        model_name, chunk_size, chunk_overlap = main.index_configuration()
        return {
            "document_id": document_id,
            "filename": filename,
            "status": "indexed",
            "chunk_count": 2,
            "content_hash": main.document_fingerprint(
                segments, model_name, chunk_size, chunk_overlap
            ),
            "model_name": model_name,
        }

    def test_single_index_status_and_duplicate_prevention(self):
        document = self.create_extracted_document(
            "first-audit.txt",
            b"SQL injection affects the account search endpoint.",
        )
        with patch(
            "backend.main.index_document_data",
            side_effect=self.fake_index_result,
        ) as indexer, patch(
            "backend.main._get_indexed_chunk_count",
            return_value=2,
        ):
            first = self.client.post(f"/api/rag/index/{document['id']}")
            second = self.client.post(f"/api/rag/index/{document['id']}")
            status = self.client.get(f"/api/rag/index-status/{document['id']}")

        self.assertEqual(first.status_code, 200, first.text)
        self.assertFalse(first.json()["already_indexed"])
        self.assertTrue(second.json()["already_indexed"])
        self.assertEqual(indexer.call_count, 1)
        self.assertEqual(status.json()["status"], "indexed")
        self.assertEqual(status.json()["chunk_count"], 2)

    def test_indexing_modified_text_reindexes_document(self):
        document = self.create_extracted_document("mutable.txt", b"Original audit evidence.")
        with patch("backend.main.index_document_data", side_effect=self.fake_index_result) as indexer:
            self.assertEqual(
                self.client.post(f"/api/rag/index/{document['id']}").status_code,
                200,
            )
            with closing(sqlite3.connect(self.database_path)) as connection:
                connection.execute(
                    """
                    UPDATE document_extraction_segments
                    SET extracted_text = 'Updated audit evidence.'
                    WHERE document_id = ?
                    """,
                    (document["id"],),
                )
                connection.commit()
            updated = self.client.post(f"/api/rag/index/{document['id']}")

        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertFalse(updated.json()["already_indexed"])
        self.assertEqual(indexer.call_count, 2)

    def test_index_all_processes_multiple_extracted_reports(self):
        first = self.create_extracted_document("first.txt", b"First audit evidence.")
        second = self.create_extracted_document("second.txt", b"Second audit evidence.")
        with patch("backend.main.index_document_data", side_effect=self.fake_index_result) as indexer:
            response = self.client.post("/api/rag/index-all")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["indexed_count"], 2)
        self.assertEqual(response.json()["failed_count"], 0)
        self.assertEqual(indexer.call_count, 2)
        self.assertEqual(
            {item["document_id"] for item in response.json()["documents"]},
            {first["id"], second["id"]},
        )

    def test_chat_persists_context_and_citations_and_can_be_deleted(self):
        document = self.create_extracted_document(
            "chat-audit.txt",
            b"TCP port 23 is exposed to the public internet.",
        )
        with patch("backend.main.index_document_data", side_effect=self.fake_index_result):
            indexed = self.client.post(f"/api/rag/index/{document['id']}")
        self.assertEqual(indexed.status_code, 200)

        retrieved = [{
            "chunk_id": "valid-chunk",
            "document_id": document["id"],
            "source": "chat-audit.txt",
            "page_number": None,
            "section_reference": "lines-1-1",
            "source_reference": "lines-1-1",
            "content_hash": "evidence-hash",
            "evidence_excerpt": "TCP port 23 is exposed to the public internet.",
            "similarity": 0.9,
        }]
        retrieval_calls = []

        def fake_retrieve(question, document_ids=None, top_k=None):
            retrieval_calls.append((question, document_ids))
            return retrieved

        def fake_answer(question, history, evidence):
            return {
                "answer": "The report says TCP port 23 is exposed.",
                "insufficient_evidence": False,
                "citations": evidence,
            }

        with patch("backend.main.retrieve_chunks", side_effect=fake_retrieve), patch(
            "backend.main.answer_question", side_effect=fake_answer
        ):
            first = self.client.post(
                "/api/chat/ask",
                json={
                    "question": "What ports are exposed?",
                    "document_ids": [document["id"]],
                },
            )
            conversation_id = first.json()["conversation_id"]
            second = self.client.post(
                "/api/chat/ask",
                json={
                    "question": "What remediation is recommended?",
                    "conversation_id": conversation_id,
                    "document_ids": [document["id"]],
                },
            )

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["citations"][0]["chunk_id"], "valid-chunk")
        self.assertIn("What ports are exposed?", retrieval_calls[1][0])
        self.assertEqual(retrieval_calls[1][1], [document["id"]])

        history = self.client.get(f"/api/chat/history/{conversation_id}")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(
            [message["role"] for message in history.json()["messages"]],
            ["user", "assistant", "user", "assistant"],
        )
        self.assertEqual(
            history.json()["messages"][1]["citations"][0]["chunk_id"],
            "valid-chunk",
        )
        deleted = self.client.delete(f"/api/chat/history/{conversation_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            self.client.get(f"/api/chat/history/{conversation_id}").status_code,
            404,
        )

    def test_chat_rejects_selected_document_that_is_not_indexed(self):
        document = self.create_extracted_document("not-indexed.txt", b"Unindexed evidence.")
        response = self.client.post(
            "/api/chat/ask",
            json={
                "question": "What is in this report?",
                "document_ids": [document["id"]],
            },
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("Index selected documents", response.json()["detail"])

    def test_deleting_document_removes_vectors_and_sqlite_records(self):
        document = self.create_extracted_document("delete-me.txt", b"Evidence to delete.")
        stored_file = next(self.upload_directory.glob("*.txt"))
        with patch("backend.main.delete_document_vectors") as delete_vectors:
            response = self.client.delete(f"/api/documents/{document['id']}")

        self.assertEqual(response.status_code, 200, response.text)
        delete_vectors.assert_called_once_with(document["id"])
        self.assertFalse(stored_file.exists())
        self.assertIsNone(main.get_document(document["id"]))

    def test_deleting_indexed_document_removes_vectors(self):
        document = self.create_extracted_document("delete-indexed.txt", b"Indexed evidence.")
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                "UPDATE documents SET rag_status = 'indexed' WHERE id = ?",
                (document["id"],),
            )
            connection.commit()
        with patch("backend.main.delete_document_vectors", return_value=1) as delete_vectors:
            response = self.client.delete(f"/api/documents/{document['id']}")

        self.assertEqual(response.status_code, 200, response.text)
        delete_vectors.assert_called_once_with(document["id"])

    def test_reextracting_indexed_document_discards_stale_vectors(self):
        document = self.create_extracted_document(
            "reextract.txt",
            b"Re-extracted text remains source-grounded.",
        )
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                """
                UPDATE documents
                SET rag_status = 'indexed', rag_content_hash = 'old-hash'
                WHERE id = ?
                """,
                (document["id"],),
            )
            connection.commit()
        with patch("backend.main.delete_document_vectors") as delete_vectors:
            response = self.client.post(f"/api/documents/{document['id']}/extract")

        self.assertEqual(response.status_code, 200, response.text)
        delete_vectors.assert_called_once_with(document["id"])
        self.assertEqual(main.get_document(document["id"])["rag_status"], "not_indexed")


if __name__ == "__main__":
    unittest.main()
