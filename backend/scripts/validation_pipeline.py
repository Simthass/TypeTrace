"""Frozen controlled-scenario validation pipeline for TypeTrace.

This script re-scores the labelled TypeTrace sessions with one frozen model and
one frozen scoring policy, then writes privacy-safe validation artefacts.

It is intentionally read-only:
- it never updates typing_sessions;
- it never replaces stored scores;
- it never regenerates certificates;
- it never writes raw text or raw keystroke events to the output directory.

Run from the backend directory:

    python -m scripts.validation_pipeline \
        --output-dir validation_runs/frozen-v1

Default expected scenario counts:
- TT-HUMAN: 56
- TT-AI-PASTE: 35
- TT-SYNTHETIC-EDITED: 42

The resulting analysis is controlled single-participant scenario validation. It is
not population-level biometric validation and must not be described as proof
that the system generalises across participants, keyboards, devices, or languages.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import shutil
import statistics
import sys
import traceback
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, RowMapping

from app.core.config import settings
from app.core.crypto import decrypt_json, decrypt_text
from app.ml.feature_schema import MODEL_FEATURE_FAMILY
from app.ml.inference_engine import (
    HUMAN_SCORE_THRESHOLD,
    MODEL_SCORE_WEIGHT,
    BEHAVIORAL_SCORE_WEIGHT,
    SCORING_ENGINE_VERSION,
    SUSPICIOUS_SCORE_THRESHOLD,
    inference_engine,
)
from app.ml.paste_policy import (
    DOMINANT_PASTE_RATIO_THRESHOLD,
    LIGHT_PASTE_RATIO_THRESHOLD,
    MINIMUM_KEYSTROKES,
    PASTE_POLICY_VERSION,
    apply_paste_policy,
)
from app.services.canonical_evidence import (
    clean_events,
    event_counts as compute_event_counts,
)


CLASS_HUMAN = "HUMAN"
CLASS_REVIEW = "SUSPICIOUS"
CLASS_HIGH_RISK = "SYNTHETIC"
VALID_CLASSIFICATIONS = (
    CLASS_HUMAN,
    CLASS_REVIEW,
    CLASS_HIGH_RISK,
)


@dataclass(frozen=True)
class ScenarioDefinition:
    key: str
    title_prefix: str
    expected_count: int
    interpretation: str


@dataclass(frozen=True)
class ValidationConfig:
    run_label: str
    output_dir: Path
    expected_human: int
    expected_ai_paste: int
    expected_synthetic_edited: int
    user_id: Optional[str]
    allow_count_mismatch: bool
    allow_multiple_accounts: bool
    overwrite: bool


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return (
            value.astimezone(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        )
    return str(value)


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(numeric):
        return default
    return numeric


def safe_int(value: Any, default: int = 0) -> int:
    return max(0, int(round(safe_float(value, float(default)))))


def json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return dict(parsed) if isinstance(parsed, dict) else {}
    return {}


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def sha256_json(value: Any) -> str:
    return hashlib.sha256(
        canonical_json(value).encode("utf-8"),
    ).hexdigest()


def pseudonymous_account_id(value: Any) -> str:
    clean = str(value or "").strip()
    if not clean:
        raise ValueError("An account identifier is required.")
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]


def normalize_classification(value: Any) -> str:
    normalized = str(value or "UNKNOWN").strip().upper()
    if normalized == CLASS_HUMAN:
        return CLASS_HUMAN
    if normalized == CLASS_REVIEW:
        return CLASS_REVIEW
    if normalized in {
        CLASS_HIGH_RISK,
        "AI",
        "AI-GENERATED",
        "AI_GENERATED",
        "HIGH_RISK",
    }:
        return CLASS_HIGH_RISK
    return "UNKNOWN"


def scenario_definitions(
    *,
    expected_human: int,
    expected_ai_paste: int,
    expected_synthetic_edited: int,
) -> Sequence[ScenarioDefinition]:
    return (
        ScenarioDefinition(
            key="TT-HUMAN",
            title_prefix="TT-HUMAN",
            expected_count=expected_human,
            interpretation=(
                "Manually written sessions. The principal safety measure is "
                "protection from an incorrect High Risk result."
            ),
        ),
        ScenarioDefinition(
            key="TT-AI-PASTE",
            title_prefix="TT-AI-PASTE",
            expected_count=expected_ai_paste,
            interpretation=(
                "Direct AI-text paste scenarios. The principal measure is "
                "intervention: Needs Review or High Risk rather than Human."
            ),
        ),
        ScenarioDefinition(
            key="TT-SYNTHETIC-EDITED",
            title_prefix="TT-SYNTHETIC-EDITED",
            expected_count=expected_synthetic_edited,
            interpretation=(
                "Synthetic text followed by editing. The principal measure is "
                "intervention, while the High Risk rate is reported separately."
            ),
        ),
    )


def scenario_for_title(
    title: Any,
    scenarios: Sequence[ScenarioDefinition],
) -> ScenarioDefinition:
    normalized = str(title or "").strip().upper()
    for scenario in scenarios:
        if normalized.startswith(scenario.title_prefix):
            return scenario
    raise ValueError(
        f"Session title does not match a configured validation prefix: {title!r}"
    )


def require_loaded_model() -> Dict[str, Any]:
    artifacts = getattr(inference_engine, "artifacts", None)
    if artifacts is None or not bool(getattr(artifacts, "is_loaded", False)):
        load_error = (
            getattr(artifacts, "load_error", None)
            if artifacts is not None
            else "No artifact container is available."
        )
        raise RuntimeError(
            "Frozen validation requires the real timing-only model artefacts. "
            "The backend is currently using fallback rules. "
            f"Load error: {load_error}"
        )

    manifest = getattr(artifacts, "manifest", None)
    metadata = getattr(artifacts, "metadata", None)
    feature_columns = getattr(artifacts, "feature_columns", None)

    if not isinstance(manifest, dict) or not manifest:
        raise RuntimeError(
            "The loaded model does not expose a non-empty artifact manifest."
        )
    if not isinstance(metadata, dict):
        raise RuntimeError("The loaded model metadata is invalid.")
    if not isinstance(feature_columns, list) or not feature_columns:
        raise RuntimeError("The loaded model feature schema is empty.")

    if manifest.get("feature_family") != MODEL_FEATURE_FAMILY:
        raise RuntimeError(
            "Loaded model feature family does not match the production "
            f"timing-only family {MODEL_FEATURE_FAMILY!r}."
        )

    return {
        "model_name": metadata.get("model_name"),
        "model_version": metadata.get("model_version"),
        "feature_family": manifest.get("feature_family"),
        "feature_count": len(feature_columns),
        "feature_columns": list(feature_columns),
        "artifact_manifest": manifest,
        "load_error": getattr(artifacts, "load_error", None),
    }


def build_stats(row: Mapping[str, Any]) -> SimpleNamespace:
    canonical_stats = json_object(row.get("canonical_stats_json"))
    stats_value = canonical_stats.get("stats")
    stats_map = dict(stats_value) if isinstance(stats_value, dict) else {}

    return SimpleNamespace(
        wpm=safe_float(stats_map.get("wpm", row.get("wpm"))),
        keystrokes=safe_int(
            stats_map.get("keystrokes", row.get("total_keystrokes")),
        ),
        deletions=safe_int(
            stats_map.get("deletions", row.get("deletions")),
        ),
        deletedCharacters=safe_int(
            stats_map.get("deletedCharacters", 0),
        ),
        pauses=safe_int(stats_map.get("pauses", row.get("pauses"))),
        avgIki=safe_float(
            stats_map.get("avgIki", row.get("avg_iki")),
        ),
        sessionSeconds=safe_float(
            stats_map.get(
                "sessionSeconds",
                row.get("duration_seconds"),
            ),
        ),
    )


def decrypt_session_text(row: Mapping[str, Any]) -> str:
    decrypted = decrypt_text(row.get("text_content"))
    if decrypted is None:
        return ""
    if not isinstance(decrypted, str):
        raise ValueError(
            f"Session {row.get('id')} text did not decrypt to a string."
        )
    return decrypted


def decrypt_session_events(
    row: Mapping[str, Any],
) -> List[Dict[str, Any]]:
    decrypted = decrypt_json(row.get("raw_keystroke_data"))
    if not isinstance(decrypted, list):
        raise ValueError(
            f"Session {row.get('id')} events did not decrypt to a list."
        )

    events = clean_events(decrypted)
    if not events:
        raise ValueError(
            f"Session {row.get('id')} contains no usable writing events."
        )
    return events


def extract_score_diagnostics(
    advanced_stats: Mapping[str, Any],
) -> Dict[str, Any]:
    value = advanced_stats.get("score_diagnostics")
    return dict(value) if isinstance(value, dict) else {}


def extract_nested_float(
    mapping: Mapping[str, Any],
    key: str,
) -> Optional[float]:
    value = mapping.get(key)
    if value is None:
        return None
    numeric = safe_float(value, float("nan"))
    return numeric if math.isfinite(numeric) else None


def rescore_session(
    row: Mapping[str, Any],
    scenario: ScenarioDefinition,
) -> Dict[str, Any]:
    text_content = decrypt_session_text(row)
    events = decrypt_session_events(row)
    counts = compute_event_counts(events)
    stats = build_stats(row)

    if not text_content.strip():
        raise ValueError(
            f"Session {row.get('id')} contains no document text."
        )
    if counts["keydown_count"] <= 0 and counts["paste_count"] <= 0:
        raise ValueError(
            f"Session {row.get('id')} has neither typing nor paste evidence."
        )

    inference = inference_engine.analyze(
        events=events,
        stats=stats,
        text_content=text_content,
    )
    advanced_stats_value = getattr(inference, "advanced_stats", None)
    pre_policy_stats = (
        dict(advanced_stats_value)
        if isinstance(advanced_stats_value, dict)
        else {}
    )

    if pre_policy_stats.get("model_available") is not True:
        raise RuntimeError(
            f"Session {row.get('id')} was not scored with the loaded model. "
            "Validation cannot continue with fallback rules."
        )

    pre_classification = normalize_classification(
        getattr(inference, "classification", "UNKNOWN"),
    )
    pre_human_score = round(
        safe_float(getattr(inference, "confidence_score", 0.0)),
        2,
    )
    pre_risk_score = round(
        safe_float(getattr(inference, "risk_score", 100.0)),
        2,
    )
    pre_risk_level = str(
        getattr(inference, "risk_level", "HIGH"),
    ).upper()

    final = apply_paste_policy(
        result=inference,
        event_counts=counts,
        text_content=text_content,
        classification=pre_classification,
        confidence_score=pre_human_score,
        risk_score=pre_risk_score,
        risk_level=pre_risk_level,
    )

    final_stats_value = final.get("advanced_stats")
    final_stats = (
        dict(final_stats_value)
        if isinstance(final_stats_value, dict)
        else {}
    )
    diagnostics = extract_score_diagnostics(final_stats)
    paste_evidence_value = diagnostics.get("paste_evidence")
    paste_evidence = (
        dict(paste_evidence_value)
        if isinstance(paste_evidence_value, dict)
        else {}
    )
    guards_value = diagnostics.get("guards")
    guards = (
        dict(guards_value)
        if isinstance(guards_value, dict)
        else {}
    )

    frozen_classification = normalize_classification(
        final.get("classification"),
    )
    if frozen_classification not in VALID_CLASSIFICATIONS:
        raise RuntimeError(
            f"Session {row.get('id')} produced an invalid classification: "
            f"{final.get('classification')!r}"
        )

    frozen_human_score = round(
        safe_float(final.get("confidence_score")),
        2,
    )
    frozen_risk_score = round(
        safe_float(final.get("risk_score")),
        2,
    )
    if round(frozen_human_score + frozen_risk_score, 2) != 100.0:
        raise RuntimeError(
            f"Session {row.get('id')} produced unsynchronised scores: "
            f"{frozen_human_score} + {frozen_risk_score}."
        )

    stored_classification = normalize_classification(
        row.get("classification_result"),
    )
    stored_human_score = round(
        safe_float(row.get("ml_confidence_score")),
        2,
    )
    stored_risk_level = str(row.get("risk_level") or "UNKNOWN").upper()

    return {
        "scenario": scenario.key,
        "session_id": safe_int(row.get("id")),
        "account_hash": pseudonymous_account_id(row.get("user_id")),
        "title": str(row.get("title") or ""),
        "created_at": iso_datetime(row.get("created_at")),
        "certificate_id": row.get("certificate_id"),
        "document_hash": row.get("document_hash"),
        "evidence_hash": row.get("evidence_hash"),
        "stored_classification": stored_classification,
        "stored_human_score": stored_human_score,
        "stored_risk_level": stored_risk_level,
        "stored_model_version": row.get("model_version"),
        "stored_model_score": (
            None
            if row.get("model_score") is None
            else round(safe_float(row.get("model_score")), 6)
        ),
        "frozen_classification": frozen_classification,
        "frozen_human_score": frozen_human_score,
        "frozen_risk_score": frozen_risk_score,
        "frozen_risk_level": str(final.get("risk_level") or "").upper(),
        "decision_source": final_stats.get("decision_source"),
        "model_name": final_stats.get("model_name"),
        "model_version": final_stats.get("model_version"),
        "scoring_engine_version": final_stats.get(
            "scoring_engine_version",
            SCORING_ENGINE_VERSION,
        ),
        "paste_policy_version": final_stats.get(
            "paste_policy_version",
            PASTE_POLICY_VERSION,
        ),
        "model_human_score": extract_nested_float(
            diagnostics,
            "model_human_score",
        ),
        "rules_human_score": extract_nested_float(
            diagnostics,
            "rules_human_score",
        ),
        "weighted_human_score": extract_nested_float(
            diagnostics,
            "weighted_human_score",
        ),
        "paste_tier": final_stats.get("paste_tier", "NONE"),
        "paste_count": safe_int(
            paste_evidence.get(
                "paste_count",
                counts["paste_count"],
            ),
        ),
        "pasted_length": safe_int(
            paste_evidence.get(
                "pasted_length",
                counts["pasted_length"],
            ),
        ),
        "pasted_character_ratio": round(
            safe_float(
                paste_evidence.get(
                    "pasted_character_ratio",
                    final_stats.get("pasted_character_ratio"),
                ),
            ),
            4,
        ),
        "keydown_count": counts["keydown_count"],
        "event_count": counts["event_count"],
        "high_risk_corroborated": bool(
            diagnostics.get("high_risk_corroborated", False),
        ),
        "human_band_guard_applied": bool(
            guards.get("human_band_guard_applied", False),
        ),
        "needs_review_floor_applied": bool(
            guards.get("needs_review_floor_applied", False),
        ),
        "paste_override_applied": bool(
            final_stats.get("paste_override_applied", False),
        ),
        "stored_classification_matches": (
            stored_classification == frozen_classification
        ),
        "stored_score_matches": (
            abs(stored_human_score - frozen_human_score) <= 0.01
        ),
    }


def build_query(
    scenarios: Sequence[ScenarioDefinition],
    *,
    user_id: Optional[str],
) -> tuple[str, Dict[str, Any]]:
    title_clauses: List[str] = []
    parameters: Dict[str, Any] = {}

    for index, scenario in enumerate(scenarios):
        key = f"prefix_{index}"
        title_clauses.append(f"UPPER(title) LIKE :{key}")
        parameters[key] = f"{scenario.title_prefix}%"

    where_parts = [f"({' OR '.join(title_clauses)})"]
    if user_id:
        where_parts.append("user_id = :user_id")
        parameters["user_id"] = user_id

    query = f"""
        SELECT
            id,
            user_id,
            title,
            text_content,
            raw_keystroke_data,
            canonical_stats_json,
            evidence_metadata,
            active_duration_ms,
            word_count,
            wpm,
            total_keystrokes,
            deletions,
            pauses,
            avg_iki,
            duration_seconds,
            classification_result,
            ml_confidence_score,
            risk_level,
            model_version,
            model_score,
            certificate_id,
            document_hash,
            evidence_hash,
            created_at
        FROM typing_sessions
        WHERE {' AND '.join(where_parts)}
        ORDER BY id ASC
    """
    return query, parameters


def load_validation_rows(
    engine: Engine,
    scenarios: Sequence[ScenarioDefinition],
    *,
    user_id: Optional[str],
) -> List[RowMapping]:
    query, parameters = build_query(
        scenarios,
        user_id=user_id,
    )

    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            if connection.dialect.name == "postgresql":
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")

            rows = list(
                connection.execute(
                    text(query),
                    parameters,
                ).mappings()
            )
        finally:
            transaction.rollback()

    return rows


def validate_input_set(
    rows: Sequence[Mapping[str, Any]],
    scenarios: Sequence[ScenarioDefinition],
    *,
    allow_count_mismatch: bool,
    allow_multiple_accounts: bool,
) -> Dict[str, Any]:
    if not rows:
        raise RuntimeError(
            "No validation sessions matched the configured TT-* title prefixes."
        )

    counts = {scenario.key: 0 for scenario in scenarios}
    session_ids: List[int] = []
    user_ids: set[str] = set()

    for row in rows:
        scenario = scenario_for_title(row.get("title"), scenarios)
        counts[scenario.key] += 1

        session_id = safe_int(row.get("id"))
        if session_id in session_ids:
            raise RuntimeError(
                f"Duplicate session ID detected in validation input: {session_id}"
            )
        session_ids.append(session_id)

        user_id = str(row.get("user_id") or "")
        if not user_id:
            raise RuntimeError(
                f"Session {session_id} has no user identifier."
            )
        user_ids.add(user_id)

    expected = {
        scenario.key: scenario.expected_count
        for scenario in scenarios
    }
    mismatches = {
        key: {
            "expected": expected[key],
            "actual": counts[key],
        }
        for key in counts
        if counts[key] != expected[key]
    }

    if mismatches and not allow_count_mismatch:
        raise RuntimeError(
            "Validation counts do not match the frozen plan: "
            f"{canonical_json(mismatches)}. "
            "Use --allow-count-mismatch only after deliberately updating the "
            "written validation protocol."
        )

    if len(user_ids) != 1 and not allow_multiple_accounts:
        raise RuntimeError(
            "The controlled validation set contains more than one technical "
            f"account ID ({len(user_ids)} found). Use "
            "--allow-multiple-accounts only after confirming that the accounts "
            "belong to the same declared participant."
        )

    return {
        "counts": counts,
        "expected_counts": expected,
        "count_mismatches": mismatches,
        "session_count": len(rows),
        "participant_count": 1,
        "account_count": len(user_ids),
        "account_hashes": sorted(
            pseudonymous_account_id(user_id)
            for user_id in user_ids
        ),
    }


def wilson_interval(
    numerator: int,
    denominator: int,
    *,
    z: float = 1.959963984540054,
) -> tuple[float, float]:
    if denominator <= 0:
        return 0.0, 0.0

    probability = numerator / denominator
    denominator_term = 1.0 + (z * z / denominator)
    centre = (
        probability + (z * z / (2.0 * denominator))
    ) / denominator_term
    margin = (
        z
        * math.sqrt(
            (
                probability * (1.0 - probability) / denominator
                + z * z / (4.0 * denominator * denominator)
            )
        )
        / denominator_term
    )
    return (
        max(0.0, centre - margin),
        min(1.0, centre + margin),
    )


def rate_metric(
    numerator: int,
    denominator: int,
) -> Dict[str, Any]:
    lower, upper = wilson_interval(numerator, denominator)
    rate = numerator / denominator if denominator else 0.0
    return {
        "numerator": numerator,
        "denominator": denominator,
        "rate": round(rate, 6),
        "percent": round(rate * 100.0, 2),
        "wilson_95_ci": {
            "lower": round(lower, 6),
            "upper": round(upper, 6),
            "lower_percent": round(lower * 100.0, 2),
            "upper_percent": round(upper * 100.0, 2),
        },
    }


def percentile(values: Sequence[float], probability: float) -> float:
    if not values:
        return 0.0

    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]

    position = (len(ordered) - 1) * probability
    lower_index = math.floor(position)
    upper_index = math.ceil(position)
    if lower_index == upper_index:
        return ordered[lower_index]

    fraction = position - lower_index
    return (
        ordered[lower_index]
        + (ordered[upper_index] - ordered[lower_index]) * fraction
    )


def score_distribution(values: Sequence[float]) -> Dict[str, Any]:
    if not values:
        return {
            "count": 0,
            "minimum": None,
            "p25": None,
            "median": None,
            "p75": None,
            "maximum": None,
            "mean": None,
            "standard_deviation": None,
        }

    clean = [float(value) for value in values]
    return {
        "count": len(clean),
        "minimum": round(min(clean), 2),
        "p25": round(percentile(clean, 0.25), 2),
        "median": round(statistics.median(clean), 2),
        "p75": round(percentile(clean, 0.75), 2),
        "maximum": round(max(clean), 2),
        "mean": round(statistics.fmean(clean), 2),
        "standard_deviation": (
            round(statistics.stdev(clean), 2)
            if len(clean) > 1
            else 0.0
        ),
    }


def classification_counts(
    rows: Sequence[Mapping[str, Any]],
) -> Dict[str, int]:
    counts = {
        CLASS_HUMAN: 0,
        CLASS_REVIEW: 0,
        CLASS_HIGH_RISK: 0,
    }
    for row in rows:
        classification = str(row["frozen_classification"])
        counts[classification] += 1
    return counts


def scenario_metrics(
    scenario: ScenarioDefinition,
    rows: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    total = len(rows)
    counts = classification_counts(rows)
    human = counts[CLASS_HUMAN]
    review = counts[CLASS_REVIEW]
    high_risk = counts[CLASS_HIGH_RISK]
    intervention = review + high_risk

    common = {
        "scenario": scenario.key,
        "interpretation": scenario.interpretation,
        "session_count": total,
        "classification_counts": counts,
        "human_score_distribution": score_distribution(
            [safe_float(row["frozen_human_score"]) for row in rows],
        ),
        "paste_ratio_distribution": score_distribution(
            [
                safe_float(row["pasted_character_ratio"]) * 100.0
                for row in rows
            ],
        ),
    }

    if scenario.key == "TT-HUMAN":
        common["measures"] = {
            "human_acceptance_rate": rate_metric(human, total),
            "needs_review_rate": rate_metric(review, total),
            "incorrect_high_risk_rate": rate_metric(high_risk, total),
            "protected_from_high_risk_rate": rate_metric(
                human + review,
                total,
            ),
        }
    elif scenario.key == "TT-AI-PASTE":
        common["measures"] = {
            "intervention_rate": rate_metric(intervention, total),
            "high_risk_detection_rate": rate_metric(high_risk, total),
            "needs_review_rate": rate_metric(review, total),
            "false_human_rate": rate_metric(human, total),
        }
    else:
        common["measures"] = {
            "intervention_rate": rate_metric(intervention, total),
            "high_risk_rate": rate_metric(high_risk, total),
            "needs_review_rate": rate_metric(review, total),
            "false_human_rate": rate_metric(human, total),
        }

    return common


def build_report(
    results: Sequence[Mapping[str, Any]],
    scenarios: Sequence[ScenarioDefinition],
    input_summary: Mapping[str, Any],
    model_lock: Mapping[str, Any],
) -> Dict[str, Any]:
    grouped = {
        scenario.key: [
            row for row in results if row["scenario"] == scenario.key
        ]
        for scenario in scenarios
    }

    matrix = {
        scenario.key: classification_counts(grouped[scenario.key])
        for scenario in scenarios
    }

    classification_drift = [
        int(row["session_id"])
        for row in results
        if not bool(row["stored_classification_matches"])
    ]
    score_drift = [
        int(row["session_id"])
        for row in results
        if not bool(row["stored_score_matches"])
    ]

    account_count = safe_int(input_summary.get("account_count"), 1)
    account_label = "account" if account_count == 1 else "accounts"

    return {
        "study_type": "controlled_single_participant_scenario_validation",
        "scope_statement": (
            "This run evaluates the frozen integrated TypeTrace decision "
            "pipeline across three controlled scenarios produced by one "
            f"participant using {account_count} technical TypeTrace "
            f"{account_label}. It does not establish population-level biometric "
            "performance or generalisation across people, devices, keyboards, "
            "languages, or writing environments."
        ),
        "input_summary": dict(input_summary),
        "model_and_policy_lock": {
            **dict(model_lock),
            "scoring_engine_version": SCORING_ENGINE_VERSION,
            "paste_policy_version": PASTE_POLICY_VERSION,
            "model_score_weight": MODEL_SCORE_WEIGHT,
            "behavioral_score_weight": BEHAVIORAL_SCORE_WEIGHT,
            "human_score_threshold": HUMAN_SCORE_THRESHOLD,
            "needs_review_score_threshold": (
                SUSPICIOUS_SCORE_THRESHOLD
            ),
            "minimum_keydown_requirement": MINIMUM_KEYSTROKES,
            "light_paste_ratio_threshold": (
                LIGHT_PASTE_RATIO_THRESHOLD
            ),
            "dominant_paste_ratio_threshold": (
                DOMINANT_PASTE_RATIO_THRESHOLD
            ),
        },
        "scenario_classification_matrix": matrix,
        "scenario_results": {
            scenario.key: scenario_metrics(
                scenario,
                grouped[scenario.key],
            )
            for scenario in scenarios
        },
        "stored_vs_frozen_rescore": {
            "purpose": (
                "Development drift check only. Stored values may have been "
                "created under earlier scoring versions and are not used as "
                "the frozen validation result."
            ),
            "classification_drift_count": len(classification_drift),
            "classification_drift_session_ids": classification_drift,
            "score_drift_count": len(score_drift),
            "score_drift_session_ids": score_drift,
        },
        "reporting_rules": {
            "tt_human_primary_safety_measure": (
                "incorrect_high_risk_rate"
            ),
            "tt_ai_paste_primary_measure": "intervention_rate",
            "tt_synthetic_edited_primary_measure": "intervention_rate",
            "confidence_interval": "Wilson score interval, 95%",
            "prohibited_claims": (
                "Do not describe these results as population accuracy, "
                "identity verification accuracy, or proof of misconduct."
            ),
        },
    }


def manifest_session_entry(
    result: Mapping[str, Any],
) -> Dict[str, Any]:
    return {
        "scenario": result["scenario"],
        "session_id": result["session_id"],
        "account_hash": result["account_hash"],
        "title": result["title"],
        "created_at": result["created_at"],
        "certificate_id": result["certificate_id"],
        "document_hash": result["document_hash"],
        "evidence_hash": result["evidence_hash"],
    }


def csv_fieldnames() -> Sequence[str]:
    return (
        "scenario",
        "session_id",
        "account_hash",
        "title",
        "created_at",
        "certificate_id",
        "document_hash",
        "evidence_hash",
        "stored_classification",
        "stored_human_score",
        "stored_risk_level",
        "stored_model_version",
        "stored_model_score",
        "frozen_classification",
        "frozen_human_score",
        "frozen_risk_score",
        "frozen_risk_level",
        "decision_source",
        "model_name",
        "model_version",
        "scoring_engine_version",
        "paste_policy_version",
        "model_human_score",
        "rules_human_score",
        "weighted_human_score",
        "paste_tier",
        "paste_count",
        "pasted_length",
        "pasted_character_ratio",
        "keydown_count",
        "event_count",
        "high_risk_corroborated",
        "human_band_guard_applied",
        "needs_review_floor_applied",
        "paste_override_applied",
        "stored_classification_matches",
        "stored_score_matches",
    )


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            default=str,
        )
        + "\n",
        encoding="utf-8",
    )


def write_results_csv(
    path: Path,
    results: Sequence[Mapping[str, Any]],
) -> None:
    fields = list(csv_fieldnames())
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fields,
            extrasaction="ignore",
        )
        writer.writeheader()
        for row in results:
            writer.writerow({field: row.get(field) for field in fields})


def publish_outputs(
    config: ValidationConfig,
    *,
    manifest: Mapping[str, Any],
    report: Mapping[str, Any],
    results: Sequence[Mapping[str, Any]],
) -> Path:
    target = config.output_dir.resolve()
    if target.exists() and not config.overwrite:
        raise FileExistsError(
            f"Output directory already exists: {target}. "
            "Use a new run directory or pass --overwrite deliberately."
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    staging = target.parent / f".{target.name}.tmp-{uuid.uuid4().hex}"
    staging.mkdir(parents=False, exist_ok=False)

    try:
        write_json(staging / "validation_manifest.json", manifest)
        write_json(staging / "validation_report.json", report)
        write_results_csv(staging / "validation_results.csv", results)

        if target.exists():
            shutil.rmtree(target)
        staging.replace(target)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    return target


def run_validation(config: ValidationConfig) -> Path:
    scenarios = scenario_definitions(
        expected_human=config.expected_human,
        expected_ai_paste=config.expected_ai_paste,
        expected_synthetic_edited=config.expected_synthetic_edited,
    )
    model_lock = require_loaded_model()

    if not settings.sync_database_url.strip():
        raise RuntimeError(
            "DATABASE_URL is empty. Configure the TypeTrace database before "
            "running controlled validation."
        )

    engine = create_engine(
        settings.sync_database_url,
        pool_pre_ping=True,
    )
    try:
        rows = load_validation_rows(
            engine,
            scenarios,
            user_id=config.user_id,
        )
    finally:
        engine.dispose()

    input_summary = validate_input_set(
        rows,
        scenarios,
        allow_count_mismatch=config.allow_count_mismatch,
        allow_multiple_accounts=config.allow_multiple_accounts,
    )

    results: List[Dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        scenario = scenario_for_title(row.get("title"), scenarios)
        session_id = row.get("id")
        print(
            f"[{index:03d}/{len(rows):03d}] "
            f"Re-scoring {scenario.key} session {session_id}...",
            flush=True,
        )
        results.append(rescore_session(row, scenario))

    generated_at = iso_datetime(utc_now())
    session_manifest = [
        manifest_session_entry(result)
        for result in results
    ]
    source_fingerprint = sha256_json(session_manifest)

    report = build_report(
        results,
        scenarios,
        input_summary,
        model_lock,
    )
    results_fingerprint = sha256_json(results)

    manifest = {
        "run_label": config.run_label,
        "generated_at": generated_at,
        "study_type": "controlled_single_participant_scenario_validation",
        "configuration": {
            "run_label": config.run_label,
            "output_dir": str(config.output_dir),
            "expected_human": config.expected_human,
            "expected_ai_paste": config.expected_ai_paste,
            "expected_synthetic_edited": (
                config.expected_synthetic_edited
            ),
            "user_id_filter_applied": config.user_id is not None,
            "user_id_filter_hash": (
                pseudonymous_account_id(config.user_id)
                if config.user_id
                else None
            ),
            "allow_count_mismatch": config.allow_count_mismatch,
            "allow_multiple_accounts": config.allow_multiple_accounts,
            "overwrite": config.overwrite,
        },
        "scenario_definitions": [
            asdict(scenario)
            for scenario in scenarios
        ],
        "input_summary": input_summary,
        "model_and_policy_lock": report["model_and_policy_lock"],
        "source_session_fingerprint_sha256": source_fingerprint,
        "result_fingerprint_sha256": results_fingerprint,
        "sessions": session_manifest,
        "privacy_boundary": {
            "contains_raw_document_text": False,
            "contains_raw_keystroke_events": False,
            "contains_private_replay_data": False,
            "contains_raw_account_identifiers": False,
            "account_identifier_representation": (
                "first 16 hexadecimal characters of SHA-256"
            ),
        },
    }

    return publish_outputs(
        config,
        manifest=manifest,
        report=report,
        results=results,
    )


def parse_args(
    argv: Optional[Sequence[str]] = None,
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Re-score the frozen TypeTrace controlled validation sessions and "
            "write privacy-safe manifest, CSV, and JSON reports."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="New directory for the frozen validation artefacts.",
    )
    parser.add_argument(
        "--run-label",
        default="typetrace-controlled-validation-v1",
        help="Human-readable label stored in the validation manifest.",
    )
    parser.add_argument(
        "--expected-human",
        type=int,
        default=56,
        help="Expected number of TT-HUMAN sessions.",
    )
    parser.add_argument(
        "--expected-ai-paste",
        type=int,
        default=35,
        help="Expected number of TT-AI-PASTE sessions.",
    )
    parser.add_argument(
        "--expected-synthetic-edited",
        type=int,
        default=42,
        help="Expected number of TT-SYNTHETIC-EDITED sessions.",
    )
    parser.add_argument(
        "--user-id",
        default=None,
        help=(
            "Optional technical account ID filter. Omit it to load all "
            "matching titles; multiple account IDs require the explicit "
            "--allow-multiple-accounts confirmation."
        ),
    )
    parser.add_argument(
        "--allow-count-mismatch",
        action="store_true",
        help=(
            "Allow actual scenario counts to differ from the frozen expected "
            "counts. Use only after updating the written protocol."
        ),
    )
    parser.add_argument(
        "--allow-multiple-accounts",
        action="store_true",
        help=(
            "Allow more than one technical account ID after confirming that "
            "all selected accounts belong to the declared participant."
        ),
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing output directory deliberately.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print a full traceback when validation fails.",
    )
    return parser.parse_args(argv)


def validate_cli_counts(args: argparse.Namespace) -> None:
    values = {
        "--expected-human": args.expected_human,
        "--expected-ai-paste": args.expected_ai_paste,
        "--expected-synthetic-edited": args.expected_synthetic_edited,
    }
    invalid = {
        name: value
        for name, value in values.items()
        if value < 0
    }
    if invalid:
        raise ValueError(
            f"Expected counts must be non-negative: {invalid}"
        )


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    try:
        validate_cli_counts(args)
        config = ValidationConfig(
            run_label=str(args.run_label).strip()
            or "typetrace-controlled-validation-v1",
            output_dir=args.output_dir,
            expected_human=args.expected_human,
            expected_ai_paste=args.expected_ai_paste,
            expected_synthetic_edited=args.expected_synthetic_edited,
            user_id=(
                str(args.user_id).strip()
                if args.user_id
                else None
            ),
            allow_count_mismatch=bool(args.allow_count_mismatch),
            allow_multiple_accounts=bool(args.allow_multiple_accounts),
            overwrite=bool(args.overwrite),
        )
        output = run_validation(config)
    except Exception as exc:
        print(
            f"Validation failed: {exc}",
            file=sys.stderr,
        )
        if args.debug:
            traceback.print_exc()
        return 1

    print("\nFrozen validation completed.")
    print(f"Output directory: {output}")
    print("Created:")
    print("  - validation_manifest.json")
    print("  - validation_results.csv")
    print("  - validation_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
