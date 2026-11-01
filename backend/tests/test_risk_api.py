import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import main


class RiskApiTests(unittest.TestCase):
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

    def create_document(self, filename="audit.txt", text=b"Source evidence."):
        uploaded = self.client.post(
            "/api/documents/upload",
            files={"file": (filename, text, "text/plain")},
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        document = uploaded.json()
        extracted = self.client.post(f"/api/documents/{document['id']}/extract")
        self.assertEqual(extracted.status_code, 200, extracted.text)
        return document

    def create_finding(self, document, **updates):
        finding = {
            "id": updates.pop("id", f"finding-{document['id'][:8]}"),
            "document_id": document["id"],
            "title": updates.pop("title", "Public API SQL injection"),
            "description": "A SQL injection weakness was documented.",
            "category": updates.pop("category", "Injection"),
            "severity": updates.pop("severity", "High"),
            "affected_asset": "payments.example.test",
            "business_impact": updates.pop("business_impact", "Data breach and service disruption."),
            "technical_impact": "Query manipulation.",
            "exploitation_evidence": None,
            "remediation": "Use parameterized queries.",
            "cve_ids_json": "[]",
            "cwe_ids_json": "[]",
            "cvss_score": updates.pop("cvss_score", "9.1"),
            "cvss_vector": None,
            "compliance_references_json": "[]",
            "source_reference": "lines-1-1",
            "page_number": None,
            "evidence_excerpt": updates.pop(
                "evidence_excerpt",
                "The payment endpoint is publicly accessible from the internet.",
            ),
            "confidence": 0.9,
            "uncertainty_notes_json": "[]",
            "field_provenance_json": json.dumps(
                updates.pop(
                    "field_provenance",
                    {"business_impact": "explicit"},
                )
            ),
            "model_name": "mock-model",
            "provider_name": "mock",
            "processed_at": "2026-01-01T00:00:00+00:00",
            "review_status": updates.pop("review_status", "needs_review"),
            "reviewer_notes": None,
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        }
        self.assertFalse(updates, f"Unexpected finding fields: {updates}")
        columns = ", ".join(finding)
        placeholders = ", ".join("?" for _ in finding)
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                f"INSERT INTO findings ({columns}) VALUES ({placeholders})",
                tuple(finding.values()),
            )
            connection.commit()
        return finding["id"]

    def test_database_migration_adds_risk_tables_and_current_trigger_column(self):
        with closing(sqlite3.connect(self.database_path)) as connection:
            connection.execute(
                """
                CREATE TABLE risk_scores (
                    finding_id TEXT PRIMARY KEY,
                    score REAL NOT NULL,
                    classification TEXT NOT NULL,
                    score_completeness REAL NOT NULL,
                    is_provisional INTEGER NOT NULL,
                    factor_breakdown_json TEXT NOT NULL,
                    weights_json TEXT NOT NULL,
                    engine_version TEXT NOT NULL,
                    calculated_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

        main.initialize_database()

        with closing(sqlite3.connect(self.database_path)) as connection:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
            }
            score_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(risk_scores)")
            }
        self.assertTrue({
            "risk_factor_overrides",
            "risk_score_history",
        }.issubset(tables))
        self.assertIn("calculation_trigger", score_columns)

    def test_calculate_and_overview_report_provisional_factors(self):
        document = self.create_document()
        finding_id = self.create_finding(document)

        calculated = self.client.post(f"/api/risk/calculate/{finding_id}")
        overview = self.client.get("/api/risk/overview")
        detail = self.client.get(f"/api/risk/findings/{finding_id}")

        self.assertEqual(calculated.status_code, 200, calculated.text)
        score = calculated.json()
        self.assertEqual(score["risk_score"], 64.71)
        self.assertEqual(score["risk_classification"], "High")
        self.assertEqual(score["score_completeness"], 85.0)
        self.assertTrue(score["is_provisional"])
        self.assertIn("asset_criticality", score["missing_factors"])
        self.assertEqual(score["cvss_score"], "9.1")
        self.assertEqual(overview.json()["scored_count"], 1)
        self.assertEqual(overview.json()["severity_counts"]["High"], 1)
        self.assertEqual(detail.json()["id"], finding_id)
        self.assertEqual(
            self.client.get(f"/api/risk/history/{finding_id}").json()[0]["calculation_trigger"],
            "manual_calculation",
        )

    def test_recurrence_counts_distinct_reports_and_not_duplicate_mentions(self):
        first_document = self.create_document("report-one.txt")
        second_document = self.create_document("report-two.txt")
        first_id = self.create_finding(first_document, id="first")
        self.create_finding(first_document, id="duplicate-in-one-report")
        second_id = self.create_finding(second_document, id="second", title="Public API SQL-injection!")

        result = self.client.post("/api/risk/calculate-all")
        scores = {item["id"]: item for item in result.json()["findings"]}

        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["calculated_count"], 3)
        self.assertAlmostEqual(scores[first_id]["factor_breakdown"]["recurrence"]["value"], 100 / 3, places=4)
        self.assertAlmostEqual(scores[second_id]["factor_breakdown"]["recurrence"]["value"], 100 / 3, places=4)
        self.assertEqual(
            len(self.client.get(f"/api/risk/history/{first_id}").json()),
            1,
        )

    def test_manual_factor_patch_recalculates_and_persists_history(self):
        document = self.create_document()
        finding_id = self.create_finding(document)
        self.client.post(f"/api/risk/calculate/{finding_id}")

        updated = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={
                "asset_criticality": 100,
                "rationale": "Service owner confirmed this is a tier-zero payment asset.",
            },
        )
        history = self.client.get(f"/api/risk/history/{finding_id}")

        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["factor_breakdown"]["asset_criticality"]["value"], 100)
        self.assertEqual(
            updated.json()["factor_breakdown"]["asset_criticality"]["source"],
            "manual override",
        )
        self.assertEqual(updated.json()["score_completeness"], 100)
        self.assertEqual(len(history.json()), 2)
        self.assertEqual(history.json()[0]["calculation_trigger"], "manual_factor_review")

    def test_clearing_override_reverts_factor_to_unknown(self):
        document = self.create_document()
        finding_id = self.create_finding(document)
        self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": 90, "rationale": "Reviewed by asset owner."},
        )

        response = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": None},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["factor_breakdown"]["asset_criticality"]["value"])
        self.assertNotIn("asset_criticality", response.json()["manual_factor_overrides"])

    def test_finding_review_recalculates_score_and_keeps_cvss_separate(self):
        document = self.create_document()
        finding_id = self.create_finding(document, severity="Low")
        initial = self.client.post(f"/api/risk/calculate/{finding_id}").json()

        updated = self.client.patch(
            f"/api/findings/{finding_id}",
            json={"severity": "Critical"},
        )
        history = self.client.get(f"/api/risk/history/{finding_id}").json()

        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(len(history), 2)
        self.assertGreater(history[0]["score"], initial["risk_score"])
        self.assertEqual(updated.json()["cvss_score"], "9.1")
        current = self.client.get(f"/api/risk/findings/{finding_id}").json()
        self.assertEqual(current["factor_breakdown"]["severity"]["value"], 100)

    def test_filters_rank_and_top_priorities_return_scored_findings(self):
        first_document = self.create_document("one.txt")
        second_document = self.create_document("two.txt")
        high_id = self.create_finding(first_document, id="high-risk", severity="Critical")
        low_id = self.create_finding(second_document, id="low-risk", severity="Low")
        self.client.post("/api/risk/calculate-all")

        ranked = self.client.get("/api/risk/findings").json()
        filtered = self.client.get("/api/risk/findings?severity=Critical").json()
        top = self.client.get("/api/risk/top-priorities?limit=1").json()

        self.assertEqual(ranked[0]["id"], high_id)
        self.assertEqual(filtered[0]["id"], high_id)
        self.assertEqual(top[0]["id"], high_id)
        self.assertIn(low_id, {item["id"] for item in ranked})
        self.assertEqual(
            self.client.get("/api/risk/findings?risk_classification=bogus").status_code,
            422,
        )

    def test_rejected_findings_are_excluded_and_unknown_scores_are_explicit(self):
        document = self.create_document()
        rejected_id = self.create_finding(document, id="rejected", review_status="rejected")
        unknown_id = self.create_finding(
            document,
            id="unknown-business",
            field_provenance={"business_impact": "inferred"},
            evidence_excerpt="A vulnerability was identified.",
        )

        result = self.client.post("/api/risk/calculate-all")
        risk_findings = self.client.get("/api/risk/findings").json()

        self.assertEqual(result.json()["calculated_count"], 1)
        self.assertEqual(risk_findings[0]["id"], unknown_id)
        self.assertEqual(risk_findings[0]["factor_breakdown"]["business_impact"]["value"], None)
        self.assertEqual(
            self.client.post(f"/api/risk/calculate/{rejected_id}").status_code,
            409,
        )

    def test_manual_factor_validation_and_weight_configuration_errors(self):
        document = self.create_document()
        finding_id = self.create_finding(document)
        missing_rationale = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": 50},
        )
        out_of_range = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": 101, "rationale": "outside range"},
        )
        boolean_value = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": True, "rationale": "not a numeric score"},
        )
        blank_rationale = self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": 50, "rationale": "   "},
        )

        self.assertEqual(missing_rationale.status_code, 422)
        self.assertEqual(out_of_range.status_code, 422)
        self.assertEqual(boolean_value.status_code, 422)
        self.assertEqual(blank_rationale.status_code, 422)
        with patch.dict("os.environ", {"THREATLENS_RISK_WEIGHT_SEVERITY": "0.5"}):
            invalid_configuration = self.client.post(f"/api/risk/calculate/{finding_id}")
        self.assertEqual(invalid_configuration.status_code, 500)
        self.assertIn("sum to 1.0", invalid_configuration.json()["detail"])

    def test_document_deletion_removes_scores_overrides_and_history(self):
        document = self.create_document()
        finding_id = self.create_finding(document)
        self.client.patch(
            f"/api/risk/findings/{finding_id}/factors",
            json={"asset_criticality": 80, "rationale": "Reviewed."},
        )
        with patch("backend.main.delete_document_vectors"):
            deleted = self.client.delete(f"/api/documents/{document['id']}")

        self.assertEqual(deleted.status_code, 200, deleted.text)
        with closing(sqlite3.connect(self.database_path)) as connection:
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM risk_scores WHERE finding_id = ?",
                    (finding_id,),
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM risk_score_history WHERE finding_id = ?",
                    (finding_id,),
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM risk_factor_overrides WHERE finding_id = ?",
                    (finding_id,),
                ).fetchone()[0],
                0,
            )


if __name__ == "__main__":
    unittest.main()
