import os
from contextlib import closing
import io
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pymupdf as fitz
from docx import Document
from fastapi.testclient import TestClient

from backend import main


class DocumentUploadTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        temporary_path = Path(self.temporary_directory.name)
        self.upload_directory = temporary_path / "uploads"
        self.database_path = temporary_path / "documents.sqlite3"
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

    def upload(self, filename, content, mime_type):
        return self.client.post(
            "/api/documents/upload",
            files={"file": (filename, content, mime_type)},
        )

    def make_pdf(self, pages):
        document = fitz.open()
        for text in pages:
            page = document.new_page()
            if text:
                page.insert_text((72, 72), text)
        content = document.tobytes()
        document.close()
        return content

    def make_docx(self):
        document = Document()
        document.add_heading("Executive Summary", level=1)
        document.add_paragraph("CVE-2025-1234 affects the gateway.")
        table = document.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Asset"
        table.cell(0, 1).text = "gateway-prod-01"
        output = io.BytesIO()
        document.save(output)
        return output.getvalue()

    def extract(self, filename, content, mime_type):
        uploaded = self.upload(filename, content, mime_type)
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        document = uploaded.json()
        response = self.client.post(f"/api/documents/{document['id']}/extract")
        self.assertEqual(response.status_code, 200, response.text)
        return document, response.json()

    def test_accepts_pdf_docx_and_txt_and_lists_metadata(self):
        files = (
            ("report.pdf", b"%PDF-1.7 sample", "application/pdf"),
            (
                "report.docx",
                b"docx sample",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
            ("report.txt", b"Plain text report", "text/plain"),
        )

        responses = [self.upload(*upload) for upload in files]

        self.assertEqual([response.status_code for response in responses], [201, 201, 201])
        documents = [response.json() for response in responses]
        for document, (filename, content, mime_type) in zip(documents, files):
            self.assertEqual(document["original_filename"], filename)
            self.assertEqual(document["mime_type"], mime_type)
            self.assertEqual(document["size_bytes"], len(content))
            self.assertEqual(document["status"], "uploaded")
            self.assertNotEqual(document["id"], filename)

        listed_documents = self.client.get("/api/documents")
        self.assertEqual(listed_documents.status_code, 200)
        self.assertEqual(len(listed_documents.json()), 3)

    def test_sanitizes_user_filename_and_uses_unique_storage_name(self):
        first = self.upload("../../sensitive.pdf", b"%PDF sample", "application/pdf")
        second = self.upload("../../sensitive.pdf", b"%PDF sample", "application/pdf")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.json()["original_filename"], "sensitive.pdf")
        self.assertNotEqual(first.json()["id"], second.json()["id"])
        stored_files = list(self.upload_directory.iterdir())
        self.assertEqual(len(stored_files), 2)
        self.assertTrue(all(path.name.endswith(".pdf") for path in stored_files))
        self.assertTrue(all(path.name != "sensitive.pdf" for path in stored_files))

    def test_rejects_unsupported_extension(self):
        response = self.upload("report.exe", b"executable", "application/octet-stream")

        self.assertEqual(response.status_code, 415)
        self.assertIn("Unsupported file type", response.json()["detail"])

    def test_rejects_mismatched_mime_type(self):
        response = self.upload("report.pdf", b"%PDF sample", "text/plain")

        self.assertEqual(response.status_code, 415)
        self.assertIn("requires MIME type", response.json()["detail"])

    def test_rejects_empty_file(self):
        response = self.upload("empty.txt", b"", "text/plain")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Empty files cannot be uploaded.")
        self.assertEqual(self.client.get("/api/documents").json(), [])

    def test_rejects_files_over_twenty_megabytes(self):
        response = self.upload(
            "oversized.txt",
            b"x" * (main.MAX_FILE_SIZE + 1),
            "text/plain",
        )

        self.assertEqual(response.status_code, 413)
        self.assertIn("20 MB", response.json()["detail"])
        self.assertEqual(self.client.get("/api/documents").json(), [])

    def test_extracts_pdf_text_and_preserves_page_references(self):
        pdf_bytes = self.make_pdf(["CVE-2025-1234 on page one.", "Gateway key rotation on page two."])
        document, result = self.extract("security.pdf", pdf_bytes, "application/pdf")

        self.assertEqual(result["status"], "extracted")
        response = self.client.get(f"/api/documents/{document['id']}/extracted-text")
        self.assertEqual(response.status_code, 200)
        extracted = response.json()
        self.assertEqual(extracted["page_count"], 2)
        self.assertEqual(
            [segment["page_number"] for segment in extracted["segments"]],
            [1, 2],
        )
        self.assertEqual(
            [segment["source_reference"] for segment in extracted["segments"]],
            ["page-1", "page-2"],
        )
        self.assertIn("CVE-2025-1234", extracted["segments"][0]["extracted_text"])
        self.assertIn("key rotation", extracted["segments"][1]["extracted_text"])
        stored_path = self.upload_directory / self._stored_filename(document["id"])
        self.assertEqual(stored_path.read_bytes(), pdf_bytes)

    def test_extracts_docx_paragraphs_and_tables_in_document_order(self):
        docx_bytes = self.make_docx()
        document, result = self.extract(
            "security.docx",
            docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        self.assertEqual(result["status"], "extracted")
        segments = self.client.get(
            f"/api/documents/{document['id']}/extracted-text"
        ).json()["segments"]
        self.assertEqual(
            [segment["source_reference"] for segment in segments],
            [
                "paragraph-1",
                "paragraph-2",
                "table-1-row-1-cell-1",
                "table-1-row-1-cell-2",
            ],
        )
        self.assertEqual(segments[1]["section_reference"], "Executive Summary")
        self.assertEqual(segments[2]["extracted_text"], "Asset")
        self.assertEqual(segments[3]["extracted_text"], "gateway-prod-01")
        self.assertTrue(all(segment["page_number"] is None for segment in segments))

    def test_extracts_txt_with_legacy_encoding_and_line_reference(self):
        content = "Café — firewall rule 443\r\nSecond evidence line".encode("cp1252")
        document, result = self.extract("notes.txt", content, "text/plain")

        self.assertEqual(result["status"], "extracted")
        extracted = self.client.get(
            f"/api/documents/{document['id']}/extracted-text"
        ).json()
        self.assertEqual(extracted["segments"][0]["source_reference"], "lines-1-2")
        self.assertEqual(
            extracted["segments"][0]["extracted_text"],
            "Café — firewall rule 443\nSecond evidence line",
        )

    def test_marks_scanned_pdf_as_requiring_ocr(self):
        document_pdf = fitz.open()
        page = document_pdf.new_page()
        pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 16, 16))
        pixmap.clear_with(255)
        page.insert_image(page.rect, pixmap=pixmap)
        content = document_pdf.tobytes()
        document_pdf.close()

        document, result = self.extract("scan.pdf", content, "application/pdf")

        self.assertEqual(result["status"], "requires_ocr")
        self.assertIn("requires OCR", result["error"])
        self.assertEqual(
            self.client.get(f"/api/documents/{document['id']}/status").json()["status"],
            "requires_ocr",
        )
        self.assertEqual(
            self.client.get(f"/api/documents/{document['id']}/extracted-text").status_code,
            409,
        )

    def test_marks_empty_pdf_as_failed(self):
        content = self.make_pdf([""])
        _, result = self.extract("empty.pdf", content, "application/pdf")

        self.assertEqual(result["status"], "failed")
        self.assertIn("no extractable text", result["error"])

    def test_marks_empty_docx_as_failed(self):
        empty_document = Document()
        output = io.BytesIO()
        empty_document.save(output)
        document, result = self.extract(
            "empty.docx",
            output.getvalue(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        self.assertEqual(result["status"], "failed")
        self.assertIn("no extractable text", result["error"])
        self.assertEqual(
            self.client.get(f"/api/documents/{document['id']}/status").json()["status"],
            "failed",
        )

    def test_marks_malformed_pdf_and_docx_as_failed(self):
        cases = (
            ("broken.pdf", b"%PDF-1.7 invalid payload", "application/pdf"),
            (
                "broken.docx",
                b"PK\x03\x04invalid archive",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        )
        for filename, content, mime_type in cases:
            with self.subTest(filename=filename):
                _, result = self.extract(filename, content, mime_type)
                self.assertEqual(result["status"], "failed")
                self.assertTrue(result["error"])

    def test_detects_actual_format_mismatch(self):
        document, result = self.extract(
            "word-document.pdf",
            self.make_docx(),
            "application/pdf",
        )

        self.assertEqual(result["status"], "failed")
        self.assertIn("not a valid PDF", result["error"])
        self.assertEqual(
            self.client.get(f"/api/documents/{document['id']}/status").json()["status"],
            "failed",
        )

    def test_rejects_encrypted_pdf_with_explicit_failed_status(self):
        document_pdf = fitz.open()
        page = document_pdf.new_page()
        page.insert_text((72, 72), "Confidential evidence")
        content = document_pdf.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner",
            user_pw="secret",
        )
        document_pdf.close()

        _, result = self.extract("encrypted.pdf", content, "application/pdf")

        self.assertEqual(result["status"], "failed")
        self.assertIn("encrypted", result["error"])

    def test_reports_missing_document_status(self):
        missing_id = "00000000-0000-0000-0000-000000000000"

        self.assertEqual(
            self.client.get(f"/api/documents/{missing_id}/status").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/api/documents/{missing_id}/extract").status_code,
            404,
        )

    def test_migrates_existing_upload_database(self):
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                """
                CREATE TABLE documents (
                    id TEXT PRIMARY KEY,
                    original_filename TEXT NOT NULL,
                    server_filename TEXT NOT NULL UNIQUE,
                    extension TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL
                )
                """
            )
        self.client.get("/api/documents")

        with closing(sqlite3.connect(self.database_path)) as connection:
            columns = {
                row[1] for row in connection.execute("PRAGMA table_info(documents)")
            }
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
            }
        self.assertTrue(
            {"extraction_error", "extracted_at", "extraction_page_count"}.issubset(columns)
        )
        self.assertIn("document_extraction_segments", tables)

    def test_analyze_endpoint_stores_mocked_findings_and_supports_human_review(self):
        source_text = (
            "SQL injection was confirmed in the account search endpoint; "
            "the report recommends parameterized queries."
        )
        document, extraction = self.extract(
            "synthetic-audit.txt",
            source_text.encode(),
            "text/plain",
        )
        self.assertEqual(extraction["status"], "extracted")
        mock_result = {
            "provider": "gemini",
            "model_name": "test-model",
            "processed_at": "2026-11-01T10:00:00+00:00",
            "chunks_processed": 1,
            "findings": [
                {
                    "title": "SQL injection in account search",
                    "description": "The endpoint is vulnerable to SQL injection.",
                    "category": "Injection",
                    "severity": "High",
                    "affected_asset": "account search endpoint",
                    "business_impact": None,
                    "technical_impact": "Unauthorized database access may be possible.",
                    "exploitation_evidence": None,
                    "remediation": "Use parameterized queries.",
                    "cve_ids": [],
                    "cwe_ids": ["CWE-89"],
                    "cvss_score": None,
                    "cvss_vector": None,
                    "compliance_references": [],
                    "source_reference": "lines-1-1",
                    "page_number": None,
                    "evidence_excerpt": source_text,
                    "confidence": 0.9,
                    "uncertainty_notes": ["No CVE identifier is stated."],
                    "field_provenance": {
                        "title": "inferred",
                        "severity": "explicit",
                        "remediation": "explicit",
                    },
                }
            ],
        }
        with patch("backend.main.analyze_segments", return_value=mock_result) as mocked_analysis:
            response = self.client.post(f"/api/documents/{document['id']}/analyze")
        self.assertEqual(response.status_code, 200, response.text)
        mocked_analysis.assert_called_once()
        self.assertEqual(response.json()["finding_count"], 1)
        self.assertEqual(response.json()["risk_scores_updated"], 1)

        per_document = self.client.get(f"/api/documents/{document['id']}/findings")
        self.assertEqual(per_document.status_code, 200)
        finding = per_document.json()[0]
        self.assertEqual(finding["original_filename"], "synthetic-audit.txt")
        self.assertEqual(finding["evidence_excerpt"], source_text)
        self.assertEqual(finding["source_reference"], "lines-1-1")
        self.assertEqual(finding["review_status"], "needs_review")
        self.assertEqual(finding["model_name"], "test-model")
        self.assertEqual(finding["provider_name"], "gemini")
        self.assertEqual(finding["processed_at"], mock_result["processed_at"])
        risk = self.client.get(f"/api/risk/findings/{finding['id']}")
        self.assertEqual(risk.status_code, 200, risk.text)
        self.assertEqual(risk.json()["score_completeness"], 50.0)
        self.assertTrue(risk.json()["is_provisional"])

        filtered = self.client.get(
            "/api/findings",
            params={"severity": "High", "category": "Injection", "document_id": document["id"]},
        )
        self.assertEqual(len(filtered.json()), 1)
        self.assertEqual(self.client.get(f"/api/findings/{finding['id']}").status_code, 200)

        reviewed = self.client.patch(
            f"/api/findings/{finding['id']}",
            json={
                "title": "Reviewed SQL injection",
                "review_status": "confirmed",
                "reviewer_notes": "Verified against the cited report text.",
            },
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(reviewed.json()["title"], "Reviewed SQL injection")
        self.assertEqual(reviewed.json()["review_status"], "confirmed")
        self.assertEqual(reviewed.json()["field_provenance"]["title"], "human_reviewed")

        second_analyze = self.client.post(f"/api/documents/{document['id']}/analyze")
        self.assertEqual(second_analyze.status_code, 200)
        self.assertTrue(second_analyze.json()["already_analyzed"])
        self.assertEqual(len(self.client.get("/api/findings").json()), 1)

    def test_analyze_endpoint_requires_extracted_text_and_gemini_key(self):
        uploaded = self.upload("not-extracted.txt", b"Potential open port.", "text/plain")
        document_id = uploaded.json()["id"]
        response = self.client.post(f"/api/documents/{document_id}/analyze")
        self.assertEqual(response.status_code, 409)

        self.client.post(f"/api/documents/{document_id}/extract")
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            response = self.client.post(f"/api/documents/{document_id}/analyze")
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["detail"])
        status = self.client.get(f"/api/documents/{document_id}/status").json()
        self.assertEqual(status["analysis_status"], "failed")
        self.assertIn("GEMINI_API_KEY", status["analysis_error"])

    def test_finding_patch_rejects_empty_title_and_unknown_fields(self):
        response = self.client.patch(
            "/api/findings/not-a-real-finding",
            json={"unknown_field": "not allowed"},
        )
        self.assertEqual(response.status_code, 422)

    def _stored_filename(self, document_id):
        with closing(sqlite3.connect(self.database_path)) as connection:
            row = connection.execute(
                "SELECT server_filename FROM documents WHERE id = ?",
                (document_id,),
            ).fetchone()
        return row[0]


if __name__ == "__main__":
    unittest.main()
