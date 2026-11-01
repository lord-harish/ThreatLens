import json
import os
import re
from datetime import datetime, timezone


ENGINE_VERSION = "1.0"
FACTOR_NAMES = (
    "severity",
    "business_impact",
    "asset_criticality",
    "exposure",
    "recurrence",
)
DEFAULT_WEIGHTS = {
    "severity": 0.30,
    "business_impact": 0.20,
    "asset_criticality": 0.15,
    "exposure": 0.15,
    "recurrence": 0.20,
}
SEVERITY_SCORES = {
    "critical": 100.0,
    "high": 80.0,
    "medium": 60.0,
    "low": 30.0,
    "informational": 10.0,
}
RISK_THRESHOLDS = {
    "Critical": 80.0,
    "High": 60.0,
    "Medium": 40.0,
    "Low": 0.0,
}
OVERRIDABLE_FACTORS = (
    "business_impact",
    "asset_criticality",
    "exposure",
    "recurrence",
)


class RiskEngineError(ValueError):
    pass


def _utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def configured_weights(environ=None):
    environ = os.environ if environ is None else environ
    weights = {}
    for factor, default in DEFAULT_WEIGHTS.items():
        name = f"THREATLENS_RISK_WEIGHT_{factor.upper()}"
        try:
            value = float(environ.get(name, default))
        except (TypeError, ValueError) as error:
            raise RiskEngineError(f"{name} must be a number.") from error
        if not 0 <= value <= 1:
            raise RiskEngineError(f"{name} must be between 0 and 1.")
        weights[factor] = value
    if not abs(sum(weights.values()) - 1.0) <= 1e-6:
        raise RiskEngineError("Risk factor weights must sum to 1.0.")
    return weights


def risk_classification(score):
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def normalize_finding_title(title):
    return re.sub(r"\W+", " ", (title or "").casefold()).strip()


def recurrence_report_count(finding, findings):
    title = normalize_finding_title(finding.get("title"))
    category = normalize_finding_title(finding.get("category"))
    if not title:
        return 1
    return max(
        1,
        len({
            item.get("document_id")
            for item in findings
            if item.get("review_status") != "rejected"
            and normalize_finding_title(item.get("title")) == title
            and normalize_finding_title(item.get("category")) == category
            and item.get("document_id")
        }),
    )


def _provenance(finding):
    value = finding.get("field_provenance", {})
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def _explicit_or_reviewed(finding, field):
    return _provenance(finding).get(field) in {"explicit", "human_reviewed"}


def _contains_asserted_phrase(text, phrase):
    for match in re.finditer(re.escape(phrase), text):
        prefix = text[max(0, match.start() - 60):match.start()]
        if re.search(
            r"\b(?:no|not|never|without|does not|did not|cannot)\b(?:[\W_]+\w+){0,3}[\W_]*$",
            prefix,
        ):
            continue
        return True
    return False


def _business_impact_factor(finding):
    value = finding.get("business_impact")
    if not isinstance(value, str) or not value.strip():
        return None, "No business impact is recorded."
    if not _explicit_or_reviewed(finding, "business_impact"):
        return None, "The recorded business impact is inferred, not explicitly documented or human-reviewed."

    text = value.casefold()
    rules = (
        (100, ("catastrophic", "complete business outage", "total business outage")),
        (90, ("regulated data exposure", "sensitive customer data exposure", "material financial loss")),
        (80, ("data breach", "data exfiltration", "production outage", "significant financial loss")),
        (60, ("unauthorized access", "unauthorised access", "service disruption", "denial of service", "compliance breach")),
        (30, ("limited business impact", "minor business impact", "non-production impact")),
    )
    for score, phrases in rules:
        matched = next(
            (phrase for phrase in phrases if _contains_asserted_phrase(text, phrase)),
            None,
        )
        if matched:
            return score, f"Human-reviewed or explicitly documented impact matched the '{matched}' rubric."
    return None, "Documented impact does not match a defined scoring phrase; provide a reviewed factor value."


def _exposure_factor(finding):
    evidence = finding.get("evidence_excerpt") or ""
    exploitation = finding.get("exploitation_evidence")
    if isinstance(exploitation, str) and exploitation.strip() and _explicit_or_reviewed(
        finding, "exploitation_evidence"
    ):
        evidence = f"{evidence}\n{exploitation}"
    text = evidence.casefold()
    negated_exposure = (
        "not internet-facing",
        "not internet facing",
        "not publicly accessible",
        "not internet-exposed",
        "not internet exposed",
    )
    private = any(
        _contains_asserted_phrase(text, phrase) for phrase in negated_exposure
    ) or any(
        _contains_asserted_phrase(text, phrase)
        for phrase in (
            "internal-only",
            "internal only",
            "private network",
            "behind a vpn",
            "isolated network",
        )
    )
    public = any(
        _contains_asserted_phrase(text, phrase)
        for phrase in (
            "publicly accessible",
            "public internet",
            "internet-facing",
            "internet facing",
            "internet-exposed",
            "internet exposed",
            "reachable from the internet",
            "external-facing",
            "external facing",
        )
    )
    if public and private:
        return None, "Evidence contains conflicting public and restricted exposure statements."
    if public:
        return 100.0, "Source evidence explicitly identifies public or internet exposure."
    if private:
        return 25.0, "Source evidence explicitly identifies restricted or internal-only exposure."
    return None, "Source evidence does not establish an exposure level."


def recurrence_factor(report_count):
    if report_count < 1:
        raise RiskEngineError("Recurrence report count must be at least one.")
    return min(100.0, (report_count - 1) * (100.0 / 3.0))


def score_finding(
    finding,
    recurrence_reports,
    manual_overrides=None,
    weights=None,
    calculated_at=None,
):
    weights = configured_weights() if weights is None else dict(weights)
    if set(weights) != set(FACTOR_NAMES):
        raise RiskEngineError("Weights must define exactly the five supported risk factors.")
    if any(not isinstance(value, (int, float)) or not 0 <= value <= 1 for value in weights.values()):
        raise RiskEngineError("Each risk factor weight must be between 0 and 1.")
    if not abs(sum(weights.values()) - 1.0) <= 1e-6:
        raise RiskEngineError("Risk factor weights must sum to 1.0.")

    overrides = manual_overrides or {}
    severity_name = str(finding.get("severity") or "").strip().casefold()
    severity_score = SEVERITY_SCORES.get(severity_name)
    business_value, business_rationale = _business_impact_factor(finding)
    exposure_value, exposure_rationale = _exposure_factor(finding)
    factors = {
        "severity": (
            severity_score,
            "finding severity",
            f"Finding severity '{finding.get('severity') or 'unknown'}' uses the fixed severity mapping.",
            finding.get("severity") if severity_score is not None else None,
        ),
        "business_impact": (
            business_value,
            "business impact",
            business_rationale,
            finding.get("business_impact"),
        ),
        "asset_criticality": (
            None,
            "not provided",
            "Asset criticality requires a user-provided value; no asset inventory context is configured.",
            None,
        ),
        "exposure": (
            exposure_value,
            "source evidence",
            exposure_rationale,
            finding.get("evidence_excerpt"),
        ),
        "recurrence": (
            recurrence_factor(recurrence_reports),
            "distinct reports",
            f"Matched in {recurrence_reports} distinct report(s); duplicate mentions within one report count once.",
            recurrence_reports,
        ),
    }

    for name in OVERRIDABLE_FACTORS:
        override = overrides.get(name)
        if override is not None:
            if (
                not isinstance(override, dict)
                or isinstance(override.get("value"), bool)
                or not isinstance(override.get("value"), (int, float))
            ):
                raise RiskEngineError(f"Stored manual override for {name} is invalid.")
            value = float(override["value"])
            if not 0 <= value <= 100:
                raise RiskEngineError(f"Stored manual override for {name} is outside 0-100.")
            factors[name] = (
                value,
                "manual override",
                override.get("rationale") or "User-provided factor value.",
                None,
            )

    breakdown = {}
    known_weight = sum(
        weights[name] for name, factor in factors.items() if factor[0] is not None
    )
    if known_weight <= 0:
        raise RiskEngineError("At least one risk factor must have a known value.")
    weighted_score = 0.0
    for name in FACTOR_NAMES:
        value, source, rationale, evidence = factors[name]
        if value is not None:
            value = float(value)
            raw_contribution = value * weights[name]
            weighted_score += raw_contribution
            score_contribution = raw_contribution / known_weight
        else:
            raw_contribution = None
            score_contribution = None
        breakdown[name] = {
            "value": round(value, 4) if value is not None else None,
            "weight": weights[name],
            "weighted_contribution": round(raw_contribution, 4) if raw_contribution is not None else None,
            "score_contribution": round(score_contribution, 4) if score_contribution is not None else None,
            "source": source,
            "rationale": rationale,
            "evidence": evidence,
        }

    missing_factors = [name for name in FACTOR_NAMES if breakdown[name]["value"] is None]
    score = weighted_score / known_weight
    score = min(100.0, max(0.0, score))
    rounded_score = round(score, 2)
    return {
        "score": rounded_score,
        "classification": risk_classification(rounded_score),
        "score_completeness": round(known_weight * 100.0, 2),
        "is_provisional": bool(missing_factors),
        "missing_factors": missing_factors,
        "factor_breakdown": breakdown,
        "weights": weights,
        "formula": "weighted average of known factors; provisional when factors are missing",
        "engine_version": ENGINE_VERSION,
        "calculated_at": calculated_at or _utc_now(),
    }


def initialize_risk_schema(connection):
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS risk_factor_overrides (
            finding_id TEXT PRIMARY KEY,
            overrides_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS risk_scores (
            finding_id TEXT PRIMARY KEY,
            score REAL NOT NULL,
            classification TEXT NOT NULL,
            score_completeness REAL NOT NULL,
            is_provisional INTEGER NOT NULL,
            factor_breakdown_json TEXT NOT NULL,
            weights_json TEXT NOT NULL,
            engine_version TEXT NOT NULL,
            calculation_trigger TEXT NOT NULL DEFAULT 'manual_calculation',
            calculated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS risk_score_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            finding_id TEXT NOT NULL,
            score REAL NOT NULL,
            classification TEXT NOT NULL,
            score_completeness REAL NOT NULL,
            is_provisional INTEGER NOT NULL,
            factor_breakdown_json TEXT NOT NULL,
            weights_json TEXT NOT NULL,
            engine_version TEXT NOT NULL,
            calculation_trigger TEXT NOT NULL,
            calculated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_risk_history_finding_time
            ON risk_score_history(finding_id, calculated_at DESC, id DESC);
        """
    )
    score_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(risk_scores)")
    }
    if "calculation_trigger" not in score_columns:
        connection.execute(
            "ALTER TABLE risk_scores ADD COLUMN calculation_trigger TEXT NOT NULL DEFAULT 'manual_calculation'"
        )
