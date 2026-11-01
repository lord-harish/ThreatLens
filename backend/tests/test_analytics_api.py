import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import main


class AnalyticsApiTests(unittest.TestCase):
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

    def create_finding(self, title, severity, category, status):
        content = f"Source evidence for {title}."
        uploaded = self.client.post(
            "/api/documents/upload",
            files={"file": (f"{title}.txt", content.encode(), "text/plain")},
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        document = uploaded.json()
        extracted = self.client.post(f"/api/documents/{document['id']}/extract")
        self.assertEqual(extracted.status_code, 200, extracted.text)

        finding = {
            "title": title,
            "description": f"Description for {title}.",
            "category": category,
            "severity": severity,
            "affected_asset": "audit-service",
            "business_impact": None,
            "technical_impact": None,
            "exploitation_evidence": None,
            "remediation": "Apply the documented remediation.",
            "cve_ids": [],
            "cwe_ids": [],
            "cvss_score": None,
            "cvss_vector": None,
            "compliance_references": [],
            "source_reference": "lines-1-1",
            "page_number": None,
            "evidence_excerpt": content,
            "confidence": 0.9,
            "uncertainty_notes": [],
            "field_provenance": {},
            "chunk_id": "1",
            "start_offset": 0,
            "end_offset": len(content),
        }
        with closing(sqlite3.connect(self.database_path)) as connection:
            with connection:
                finding_id = main.store_finding(
                    connection,
                    {"id": document["id"]},
                    finding,
                    "test-model",
                    "test-provider",
                    "2026-01-01T00:00:00+00:00",
                )
                connection.execute(
                    "UPDATE findings SET status = ? WHERE id = ?",
                    (status, finding_id),
                )
        return document, finding_id, content

    def test_analytics_counts_distributions_and_risk_scores_use_database_records(self):
        samples = (
            ("Critical control failure", "Critical", "Access Control", "Open"),
            ("High network exposure", "High", "Network Security", "In Progress"),
            ("Patch backlog", "Medium", "Missing Patches", "Resolved"),
            ("Cloud logging gap", "Low", "Cloud Security", "Risk Accepted"),
        )
        for sample in samples:
            self.create_finding(*sample)
        calculated = self.client.post("/api/risk/calculate-all")
        self.assertEqual(calculated.status_code, 200, calculated.text)

        overview = self.client.get("/api/analytics/overview").json()
        severity = {item["name"]: item["count"] for item in self.client.get(
            "/api/analytics/severity"
        ).json()}
        status = {item["name"]: item["count"] for item in self.client.get(
            "/api/analytics/status"
        ).json()}
        risk = {item["name"]: item["count"] for item in self.client.get(
            "/api/analytics/risk-distribution"
        ).json()}
        categories = {item["name"]: item["count"] for item in self.client.get(
            "/api/analytics/categories"
        ).json()}

        self.assertEqual(overview, {
            "total_reports": 4,
            "total_findings": 4,
            "critical_findings": 1,
            "high_risk_findings": 1,
            "open_findings": 1,
            "resolved_findings": 1,
        })
        self.assertEqual(severity, {
            "Critical": 1, "High": 1, "Medium": 1, "Low": 1, "Informational": 0,
        })
        self.assertEqual(status, {
            "Open": 1, "In Progress": 1, "Resolved": 1, "Accepted Risk": 1,
        })
        self.assertEqual(risk, {
            "Critical Risk": 0,
            "High Risk": 1,
            "Medium Risk": 1,
            "Low Risk": 2,
        })
        self.assertEqual(categories["Access Control"], 1)
        self.assertEqual(categories["Network Security"], 1)
        self.assertEqual(categories["Vulnerability Management"], 1)
        self.assertEqual(categories["Cloud Security"], 1)

    def test_top_priorities_are_sorted_and_click_target_has_real_evidence(self):
        self.create_finding("Low priority", "Low", "Other", "Open")
        high_document, high_id, excerpt = self.create_finding(
            "Critical priority", "Critical", "Access Control", "Open"
        )
        self.client.post("/api/risk/calculate-all")

        priorities = self.client.get("/api/analytics/top-priorities").json()
        self.assertEqual(priorities[0]["id"], high_id)
        self.assertTrue(priorities[0]["evidence_available"])
        self.assertGreaterEqual(priorities[0]["risk_score"], priorities[-1]["risk_score"])

        citations = self.client.get(f"/api/findings/{high_id}/evidence")
        self.assertEqual(citations.status_code, 200, citations.text)
        self.assertEqual(len(citations.json()), 1)
        citation = citations.json()[0]
        self.assertEqual(citation["finding_id"], high_id)
        self.assertEqual(citation["source_document_id"], high_document["id"])
        self.assertEqual(citation["source_document_filename"], high_document["original_filename"])
        self.assertEqual(citation["evidence_excerpt"], excerpt)
        self.assertEqual(citation["chunk_id"], "1")
        self.assertEqual(citation["start_offset"], 0)
        self.assertEqual(citation["end_offset"], len(excerpt))

        source = self.client.get(f"/api/documents/{high_document['id']}/source")
        self.assertEqual(source.status_code, 200, source.text)
        self.assertEqual(source.content, excerpt.encode())
        self.assertIn("Critical%20priority.txt", source.headers["content-disposition"])
        self.assertNotIn(str(self.upload_directory), source.headers["content-disposition"])

    def test_analysis_pipeline_persists_exact_evidence_offsets_and_chunk_id(self):
        source_text = "The API key is exposed in the audit report."
        uploaded = self.client.post(
            "/api/documents/upload",
            files={"file": ("source.txt", source_text.encode(), "text/plain")},
        )
        document = uploaded.json()
        extracted = self.client.post(f"/api/documents/{document['id']}/extract")
        self.assertEqual(extracted.status_code, 200, extracted.text)
        candidate = {
            "title": "Exposed API key",
            "description": "An API key is exposed.",
            "category": "Data Protection",
            "severity": "High",
            "affected_asset": None,
            "business_impact": None,
            "technical_impact": None,
            "exploitation_evidence": None,
            "remediation": "Rotate the exposed key.",
            "cve_ids": [],
            "cwe_ids": [],
            "cvss_score": None,
            "cvss_vector": None,
            "compliance_references": [],
            "source_reference": "lines-1-1",
            "page_number": None,
            "evidence_excerpt": "API key is exposed",
            "confidence": 0.9,
            "uncertainty_notes": [],
            "field_provenance": {},
            "chunk_id": "3",
            "start_offset": source_text.index("API key"),
            "end_offset": source_text.index("API key") + len("API key is exposed"),
        }
        analysis_result = {
            "provider": "mock",
            "model_name": "mock-model",
            "processed_at": "2026-01-01T00:00:00+00:00",
            "chunks_processed": 3,
            "findings": [candidate],
        }
        with patch.object(main, "analyze_segments", return_value=analysis_result):
            analyzed = self.client.post(f"/api/documents/{document['id']}/analyze")

        self.assertEqual(analyzed.status_code, 200, analyzed.text)
        finding = self.client.get(f"/api/documents/{document['id']}/findings").json()[0]
        evidence = self.client.get(f"/api/findings/{finding['id']}/evidence").json()
        self.assertEqual(analyzed.json()["finding_count"], 1)
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0]["evidence_excerpt"], candidate["evidence_excerpt"])
        self.assertEqual(evidence[0]["chunk_id"], "3")
        self.assertEqual(evidence[0]["start_offset"], candidate["start_offset"])
        self.assertEqual(evidence[0]["end_offset"], candidate["end_offset"])

    def test_missing_evidence_and_unknown_ids_have_safe_responses(self):
        _, finding_id, _ = self.create_finding("Finding without citation", "Low", "Other", "Open")
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                "DELETE FROM finding_evidence WHERE finding_id = ?",
                (finding_id,),
            )
            connection.execute(
                "UPDATE findings SET evidence_excerpt = ? WHERE id = ?",
                ("This excerpt is not present in the source.", finding_id),
            )
            connection.commit()

        response = self.client.get("/api/findings/missing-finding/evidence")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/findings/{finding_id}/evidence").json(),
            [],
        )
        source = self.client.get("/api/documents/missing-document/source")
        self.assertEqual(source.status_code, 404)
        self.client.post(f"/api/risk/calculate/{finding_id}")
        priorities = self.client.get("/api/analytics/top-priorities").json()
        self.assertFalse(priorities[0]["evidence_available"])

    def test_document_list_includes_persisted_non_rejected_finding_count(self):
        document, finding_id, _ = self.create_finding(
            "Stored finding", "High", "Vulnerability Management", "Open"
        )

        listed = self.client.get("/api/documents")
        self.assertEqual(listed.status_code, 200, listed.text)
        document_entry = next(item for item in listed.json() if item["id"] == document["id"])
        self.assertEqual(document_entry["finding_count"], 1)

        rejected = self.client.patch(
            f"/api/findings/{finding_id}",
            json={"review_status": "rejected"},
        )
        self.assertEqual(rejected.status_code, 200, rejected.text)
        refreshed = self.client.get("/api/documents").json()
        document_entry = next(item for item in refreshed if item["id"] == document["id"])
        self.assertEqual(document_entry["finding_count"], 0)

    def test_rejected_findings_are_excluded_from_analytics(self):
        _, finding_id, _ = self.create_finding("Rejected item", "High", "Network Security", "Open")
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                "UPDATE findings SET review_status = 'rejected' WHERE id = ?",
                (finding_id,),
            )
            connection.commit()

        overview = self.client.get("/api/analytics/overview").json()
        self.assertEqual(overview["total_findings"], 0)
        self.assertEqual(overview["total_reports"], 1)
        self.assertEqual(self.client.get("/api/analytics/severity").json()[1]["count"], 0)

    def test_remediation_status_is_reviewable_and_updates_status_analytics(self):
        _, finding_id, _ = self.create_finding("Status update", "Medium", "Other", "Open")

        updated = self.client.patch(
            f"/api/findings/{finding_id}",
            json={"status": "Resolved"},
        )

        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["status"], "Resolved")
        overview = self.client.get("/api/analytics/overview").json()
        self.assertEqual(overview["open_findings"], 0)
        self.assertEqual(overview["resolved_findings"], 1)


if __name__ == "__main__":
    unittest.main()
