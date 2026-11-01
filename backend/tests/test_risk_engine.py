import unittest

from backend.risk_engine import (
    DEFAULT_WEIGHTS,
    RiskEngineError,
    configured_weights,
    recurrence_factor,
    recurrence_report_count,
    risk_classification,
    score_finding,
)


def finding(**updates):
    value = {
        "id": "finding-1",
        "document_id": "report-1",
        "title": "Public API SQL injection",
        "category": "Injection",
        "severity": "High",
        "business_impact": "Data breach and service disruption.",
        "affected_asset": "payments.example.test",
        "exploitation_evidence": None,
        "evidence_excerpt": "The endpoint is publicly accessible from the internet.",
        "cvss_score": "9.1",
        "field_provenance": {"business_impact": "explicit"},
        "review_status": "needs_review",
    }
    value.update(updates)
    return value


class RiskEngineTests(unittest.TestCase):
    def test_default_weights_and_severity_scores(self):
        expected = {
            "Critical": 100,
            "High": 80,
            "Medium": 60,
            "Low": 30,
            "Informational": 10,
        }
        for severity, score in expected.items():
            with self.subTest(severity=severity):
                result = score_finding(
                    finding(severity=severity),
                    recurrence_reports=1,
                    manual_overrides={"asset_criticality": {"value": 50, "rationale": "reviewed"}},
                )
                self.assertEqual(result["factor_breakdown"]["severity"]["value"], score)
        self.assertEqual(DEFAULT_WEIGHTS, {
            "severity": 0.30,
            "business_impact": 0.20,
            "asset_criticality": 0.15,
            "exposure": 0.15,
            "recurrence": 0.20,
        })

    def test_configurable_weights_require_valid_sum(self):
        weights = configured_weights({
            "THREATLENS_RISK_WEIGHT_SEVERITY": "0.4",
            "THREATLENS_RISK_WEIGHT_BUSINESS_IMPACT": "0.2",
            "THREATLENS_RISK_WEIGHT_ASSET_CRITICALITY": "0.15",
            "THREATLENS_RISK_WEIGHT_EXPOSURE": "0.1",
            "THREATLENS_RISK_WEIGHT_RECURRENCE": "0.15",
        })
        self.assertAlmostEqual(sum(weights.values()), 1)
        with self.assertRaisesRegex(RiskEngineError, "sum to 1.0"):
            configured_weights({"THREATLENS_RISK_WEIGHT_SEVERITY": "0.5"})
        with self.assertRaisesRegex(RiskEngineError, "between 0 and 1"):
            configured_weights({"THREATLENS_RISK_WEIGHT_SEVERITY": "1.5"})

    def test_complete_score_uses_documented_factors_and_fixed_formula(self):
        result = score_finding(
            finding(),
            recurrence_reports=4,
            manual_overrides={
                "asset_criticality": {"value": 80, "rationale": "Tier-1 payments asset"}
            },
        )
        self.assertEqual(result["score"], 87.0)
        self.assertEqual(result["classification"], "Critical")
        self.assertEqual(result["score_completeness"], 100)
        self.assertFalse(result["is_provisional"])
        self.assertEqual(result["factor_breakdown"]["business_impact"]["value"], 80)
        self.assertEqual(result["factor_breakdown"]["exposure"]["value"], 100)
        self.assertEqual(result["factor_breakdown"]["recurrence"]["value"], 100)
        self.assertEqual(result["factor_breakdown"]["asset_criticality"]["source"], "manual override")
        self.assertEqual(finding()["cvss_score"], "9.1")

    def test_inferred_or_unclassified_data_is_missing_and_score_is_provisional(self):
        result = score_finding(
            finding(
                business_impact="Total compromise of every customer account.",
                field_provenance={"business_impact": "inferred"},
                evidence_excerpt="A vulnerability was found.",
            ),
            recurrence_reports=1,
        )
        self.assertEqual(result["factor_breakdown"]["business_impact"]["value"], None)
        self.assertEqual(result["factor_breakdown"]["asset_criticality"]["value"], None)
        self.assertEqual(result["factor_breakdown"]["exposure"]["value"], None)
        self.assertEqual(result["factor_breakdown"]["recurrence"]["value"], 0)
        self.assertEqual(result["score"], 48)
        self.assertEqual(result["score_completeness"], 50)
        self.assertTrue(result["is_provisional"])
        self.assertIn("business_impact", result["missing_factors"])

    def test_manual_factor_value_is_weighted_and_rationale_is_visible(self):
        result = score_finding(
            finding(evidence_excerpt="No exposure evidence."),
            recurrence_reports=1,
            manual_overrides={
                "asset_criticality": {"value": 100, "rationale": "Business owner rated tier 0."},
            },
        )
        self.assertEqual(result["factor_breakdown"]["asset_criticality"]["rationale"], "Business owner rated tier 0.")
        self.assertIsNone(result["factor_breakdown"]["exposure"]["value"])
        self.assertEqual(result["score_completeness"], 85)
        self.assertTrue(result["is_provisional"])

    def test_recurrence_counts_distinct_reports_and_ignores_duplicate_mentions(self):
        target = finding()
        all_findings = [
            target,
            finding(id="finding-duplicate", document_id="report-1"),
            finding(id="finding-two", document_id="report-2", title="Public API SQL-injection!"),
            finding(id="finding-rejected", document_id="report-3", review_status="rejected"),
            finding(id="different-category", document_id="report-4", category="Authentication"),
        ]
        self.assertEqual(recurrence_report_count(target, all_findings), 2)
        self.assertEqual(recurrence_factor(1), 0)
        self.assertAlmostEqual(recurrence_factor(2), 100 / 3)
        self.assertAlmostEqual(recurrence_factor(3), 200 / 3)
        self.assertEqual(recurrence_factor(4), 100)
        self.assertEqual(recurrence_factor(20), 100)

    def test_exposure_conflict_is_unknown_and_negated_public_is_restricted(self):
        conflict = score_finding(
            finding(evidence_excerpt="Publicly accessible; also described as internal-only."),
            recurrence_reports=1,
        )
        self.assertIsNone(conflict["factor_breakdown"]["exposure"]["value"])
        restricted = score_finding(
            finding(evidence_excerpt="The service is not internet-facing."),
            recurrence_reports=1,
        )
        self.assertEqual(restricted["factor_breakdown"]["exposure"]["value"], 25)

    def test_risk_classification_boundaries(self):
        expected = {
            0: "Low",
            39.99: "Low",
            40: "Medium",
            59.99: "Medium",
            60: "High",
            79.99: "High",
            80: "Critical",
            100: "Critical",
        }
        for score, classification in expected.items():
            with self.subTest(score=score):
                self.assertEqual(risk_classification(score), classification)

    def test_out_of_range_manual_values_are_rejected(self):
        with self.assertRaisesRegex(RiskEngineError, "outside 0-100"):
            score_finding(
                finding(),
                recurrence_reports=1,
                manual_overrides={
                    "asset_criticality": {"value": 101, "rationale": "bad value"}
                },
            )


if __name__ == "__main__":
    unittest.main()
