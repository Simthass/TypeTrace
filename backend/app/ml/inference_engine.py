"""Production inference engine for TypeTrace.

The Isolation Forest evaluates only the cross-domain timing feature family that
is present in both the public liveness dataset and live TypeTrace telemetry.
Writing-process features such as WPM, paste activity, deletion behavior, active
duration, and idle breaks remain in the independent behavioral rule layer.

The API exposes one Human Writing Evidence Score from 0 to 100:

    score >= 80  -> HUMAN       / LOW risk
    score >= 50  -> SUSPICIOUS  / MEDIUM risk
    score <  50  -> SYNTHETIC   / HIGH risk

The percentage is an evidence score, not a calibrated probability and not proof
of misconduct or authorship.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

import joblib

from app.ml.behavioral_analysis import (
    build_feature_explanations,
    compute_behavioral_summary,
)
from app.ml.feature_extraction import (
    extract_typetrace_event_features,
    feature_vector_to_matrix,
    select_feature_vector,
)
from app.ml.feature_schema import (
    FEATURE_SCHEMA_VERSION,
    MODEL_FEATURE_COLUMNS,
    MODEL_FEATURE_FAMILY,
    MODEL_NAME,
    MODEL_VERSION,
    validate_model_feature_columns,
)

log = logging.getLogger("TypeTrace-InferenceEngine")

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "isolation_forest.joblib"
SCALER_PATH = ARTIFACT_DIR / "scaler.joblib"
FEATURE_SCHEMA_PATH = ARTIFACT_DIR / "feature_schema.json"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
MODEL_CARD_PATH = ARTIFACT_DIR / "model_card.json"
ARTIFACT_MANIFEST_PATH = ARTIFACT_DIR / "artifact_manifest.json"

PRIMARY_ARTIFACT_PATHS = {
    "isolation_forest.joblib": MODEL_PATH,
    "scaler.joblib": SCALER_PATH,
    "feature_schema.json": FEATURE_SCHEMA_PATH,
    "metrics.json": METRICS_PATH,
    "model_card.json": MODEL_CARD_PATH,
}

HUMAN_SCORE_THRESHOLD = 80.0
SUSPICIOUS_SCORE_THRESHOLD = 50.0
SCORING_ENGINE_VERSION = "scoring-v1.3-day3"
MODEL_SCORE_WEIGHT = 0.65
BEHAVIORAL_SCORE_WEIGHT = 0.35
HIGH_RISK_MODEL_MAX = SUSPICIOUS_SCORE_THRESHOLD - 0.01
HIGH_RISK_RULES_MAX = 69.99
HIGH_RISK_MAX_SCORE = SUSPICIOUS_SCORE_THRESHOLD - 0.01
NEEDS_REVIEW_FLOOR = SUSPICIOUS_SCORE_THRESHOLD
NEEDS_REVIEW_MAX_SCORE = HUMAN_SCORE_THRESHOLD - 0.01

PRIMARY_CORROBORATION_KEYS = (
    "mechanically_uniform_rhythm",
    "extreme_typing_speed",
)
SUPPORTING_CORROBORATION_KEYS = (
    "minimal_revision",
    "minimal_thinking_pauses",
)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _clamp(
    value: Any,
    minimum: float = 0.0,
    maximum: float = 100.0,
) -> float:
    safe = _safe_float(value, minimum)
    return round(max(minimum, min(maximum, safe)), 2)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _linear_map(
    value: float,
    source_minimum: float,
    source_maximum: float,
    target_minimum: float,
    target_maximum: float,
) -> float:
    """Map a value between two bounded intervals without discontinuities."""

    if source_maximum <= source_minimum:
        return target_maximum if value >= source_maximum else target_minimum

    ratio = (value - source_minimum) / (
        source_maximum - source_minimum
    )
    bounded_ratio = max(0.0, min(1.0, ratio))
    return target_minimum + bounded_ratio * (
        target_maximum - target_minimum
    )


def classify_from_human_score(human_score: float) -> Dict[str, str]:
    """Derive classification and risk from the unified evidence score."""

    score = _clamp(human_score)
    if score >= HUMAN_SCORE_THRESHOLD:
        return {"classification": "HUMAN", "risk_level": "LOW"}
    if score >= SUSPICIOUS_SCORE_THRESHOLD:
        return {"classification": "SUSPICIOUS", "risk_level": "MEDIUM"}
    return {"classification": "SYNTHETIC", "risk_level": "HIGH"}


def _active_behavioral_corroboration(
    behavioral_summary: Dict[str, Any],
) -> Dict[str, Any]:
    """Return independent process-risk signals used for high-risk corroboration.

    Paste evidence is intentionally excluded here because the route-level paste
    policy applies separate character-contribution thresholds. Missing dwell
    evidence is also excluded because capture availability is not misconduct
    evidence.
    """

    contributions_value = behavioral_summary.get("risk_contributions")
    contributions = (
        dict(contributions_value)
        if isinstance(contributions_value, dict)
        else {}
    )

    active_signals: List[str] = []
    primary_signals: List[str] = []
    supporting_signals: List[str] = []

    mechanically_uniform = bool(
        behavioral_summary.get("mechanically_uniform_rhythm")
    ) and _safe_float(
        contributions.get("mechanically_uniform_rhythm")
    ) > 0
    if mechanically_uniform:
        active_signals.append("mechanically_uniform_rhythm")
        primary_signals.append("mechanically_uniform_rhythm")

    extreme_speed_contribution = _safe_float(
        contributions.get("extreme_typing_speed")
    )
    if extreme_speed_contribution >= 12.0:
        active_signals.append("extreme_typing_speed")
        primary_signals.append("extreme_typing_speed")

    for key in SUPPORTING_CORROBORATION_KEYS:
        if _safe_float(contributions.get(key)) > 0:
            active_signals.append(key)
            supporting_signals.append(key)

    return {
        "active_signals": active_signals,
        "primary_signals": primary_signals,
        "supporting_signals": supporting_signals,
        "active_signal_count": len(active_signals),
        "primary_signal_count": len(primary_signals),
        "supporting_signal_count": len(supporting_signals),
    }


def fuse_evidence_scores(
    *,
    model_human_score: float,
    rules_human_score: float,
    behavioral_summary: Dict[str, Any],
) -> Dict[str, Any]:
    """Fuse timing-model and writing-process evidence without one-score vetoes.

    The weighted score prevents a single weak model result from erasing strong
    human process evidence. Category guards then enforce two safety properties:

    1. HUMAN requires both evidence layers to reach the human band.
    2. HIGH RISK requires a strong model anomaly plus corroborating independent
       process evidence. An uncorroborated low weighted score is limited to
       NEEDS REVIEW rather than becoming an automatic high-risk result.
    """

    model_score = _clamp(model_human_score)
    rules_score = _clamp(rules_human_score)
    weighted_score = _clamp(
        model_score * MODEL_SCORE_WEIGHT
        + rules_score * BEHAVIORAL_SCORE_WEIGHT
    )

    corroboration = _active_behavioral_corroboration(behavioral_summary)
    has_primary_signal = corroboration["primary_signal_count"] >= 1
    has_supporting_signal = corroboration["supporting_signal_count"] >= 1

    high_risk_corroborated = (
        model_score <= HIGH_RISK_MODEL_MAX
        and rules_score <= HIGH_RISK_RULES_MAX
        and has_primary_signal
        and has_supporting_signal
    )

    final_score = weighted_score
    high_risk_cap_applied = False
    needs_review_floor_applied = False
    human_band_guard_applied = False

    if high_risk_corroborated:
        capped_score = min(final_score, HIGH_RISK_MAX_SCORE)
        high_risk_cap_applied = capped_score != final_score
        final_score = capped_score
    elif final_score < NEEDS_REVIEW_FLOOR:
        final_score = NEEDS_REVIEW_FLOOR
        needs_review_floor_applied = True

    # A weighted average must not hide disagreement between the layers. Human
    # classification is available only when both layers individually support it.
    if (
        final_score >= HUMAN_SCORE_THRESHOLD
        and (
            model_score < HUMAN_SCORE_THRESHOLD
            or rules_score < HUMAN_SCORE_THRESHOLD
        )
    ):
        final_score = NEEDS_REVIEW_MAX_SCORE
        human_band_guard_applied = True

    final_score = _clamp(final_score)
    labels = classify_from_human_score(final_score)

    return {
        "policy": "weighted_fusion_with_corroboration_guards",
        "model_weight": MODEL_SCORE_WEIGHT,
        "behavioral_weight": BEHAVIORAL_SCORE_WEIGHT,
        "model_human_score": model_score,
        "rules_human_score": rules_score,
        "weighted_human_score": weighted_score,
        "final_human_score": final_score,
        "final_risk_score": _clamp(100.0 - final_score),
        "classification": labels["classification"],
        "risk_level": labels["risk_level"],
        "high_risk_corroborated": high_risk_corroborated,
        "high_risk_cap_applied": high_risk_cap_applied,
        "needs_review_floor_applied": needs_review_floor_applied,
        "human_band_guard_applied": human_band_guard_applied,
        "corroboration": corroboration,
        "thresholds": {
            "human_min": HUMAN_SCORE_THRESHOLD,
            "needs_review_min": SUSPICIOUS_SCORE_THRESHOLD,
            "strong_model_anomaly_max": HIGH_RISK_MODEL_MAX,
            "high_risk_rules_max": HIGH_RISK_RULES_MAX,
        },
    }


def _build_score_diagnostics(
    *,
    decision_source: str,
    model_decision_score: Optional[float],
    model_decision_threshold: Optional[float],
    model_human_score: Optional[float],
    rules_risk_score: float,
    rules_human_score: float,
    final_human_score: float,
    final_risk_score: float,
    classification: str,
    risk_level: str,
    model_feature_count: int,
    fusion_diagnostics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    fusion = (
        dict(fusion_diagnostics)
        if isinstance(fusion_diagnostics, dict)
        else {}
    )
    return {
        "scoring_engine_version": SCORING_ENGINE_VERSION,
        "decision_source": decision_source,
        "combination_policy": fusion.get(
            "policy",
            "behavioral_rules_only",
        ),
        "model_weight": fusion.get("model_weight"),
        "behavioral_weight": fusion.get("behavioral_weight"),
        "model_feature_family": MODEL_FEATURE_FAMILY,
        "model_feature_count": model_feature_count,
        "model_decision_score": (
            None
            if model_decision_score is None
            else round(_safe_float(model_decision_score), 6)
        ),
        "model_decision_threshold": (
            None
            if model_decision_threshold is None
            else round(_safe_float(model_decision_threshold), 6)
        ),
        "model_inside_baseline": (
            None
            if model_decision_score is None
            or model_decision_threshold is None
            else model_decision_score >= model_decision_threshold
        ),
        "model_human_score": (
            None if model_human_score is None else _clamp(model_human_score)
        ),
        "rules_risk_score": _clamp(rules_risk_score),
        "rules_human_score": _clamp(rules_human_score),
        "weighted_human_score": fusion.get("weighted_human_score"),
        "high_risk_corroborated": fusion.get(
            "high_risk_corroborated",
            False,
        ),
        "corroboration": fusion.get(
            "corroboration",
            {
                "active_signals": [],
                "primary_signals": [],
                "supporting_signals": [],
                "active_signal_count": 0,
                "primary_signal_count": 0,
                "supporting_signal_count": 0,
            },
        ),
        "guards": {
            "high_risk_cap_applied": fusion.get(
                "high_risk_cap_applied",
                False,
            ),
            "needs_review_floor_applied": fusion.get(
                "needs_review_floor_applied",
                False,
            ),
            "human_band_guard_applied": fusion.get(
                "human_band_guard_applied",
                False,
            ),
        },
        "pre_override_human_score": _clamp(final_human_score),
        "pre_override_risk_score": _clamp(final_risk_score),
        "pre_override_classification": classification,
        "pre_override_risk_level": risk_level,
        "classification_thresholds": {
            "human_min": HUMAN_SCORE_THRESHOLD,
            "needs_review_min": SUSPICIOUS_SCORE_THRESHOLD,
        },
    }


class InferenceFailure(RuntimeError):
    """Base class for controlled analysis failures."""


class InferenceInputError(InferenceFailure):
    """The submitted feature stream cannot be evaluated safely."""


class InferenceInternalError(InferenceFailure):
    """Unexpected inference implementation or numerical failure."""


@dataclass
class InferenceResult:
    classification: str
    confidence_score: float
    kill_switch_triggered: bool
    kill_switch_reason: Optional[str]
    features: Dict[str, Any]
    behavioral_summary: Dict[str, Any]
    advanced_stats: Dict[str, Any]
    decision_source: str
    risk_level: str
    risk_score: float
    human_score: float


def _fallback_result(
    *,
    text_content: str,
    keystroke_array: List[Dict[str, Any]],
    stats: Any,
    reason: str,
) -> InferenceResult:
    features = extract_typetrace_event_features(
        events=keystroke_array,
        stats=stats,
        text_content=text_content,
    )
    behavioral_summary = compute_behavioral_summary(
        events=keystroke_array,
        stats=stats,
        text_content=text_content,
        model_features=features,
    )
    rules_risk_score = _clamp(
        behavioral_summary.get("risk_score", 50),
        0,
        100,
    )
    rules_human_score = _clamp(100.0 - rules_risk_score, 0, 100)
    fallback_review_floor_applied = (
        rules_human_score < SUSPICIOUS_SCORE_THRESHOLD
    )
    human_score = (
        SUSPICIOUS_SCORE_THRESHOLD
        if fallback_review_floor_applied
        else rules_human_score
    )
    human_score = _clamp(human_score)
    final_risk_score = _clamp(100.0 - human_score)
    labels = classify_from_human_score(human_score)
    model_feature_vector = select_feature_vector(
        features,
        MODEL_FEATURE_COLUMNS,
    )
    score_diagnostics = _build_score_diagnostics(
        decision_source="FALLBACK_RULES",
        model_decision_score=None,
        model_decision_threshold=None,
        model_human_score=None,
        rules_risk_score=rules_risk_score,
        rules_human_score=rules_human_score,
        final_human_score=human_score,
        final_risk_score=final_risk_score,
        classification=labels["classification"],
        risk_level=labels["risk_level"],
        model_feature_count=len(MODEL_FEATURE_COLUMNS),
        fusion_diagnostics={
            "policy": "behavioral_rules_only_with_review_floor",
            "weighted_human_score": rules_human_score,
            "needs_review_floor_applied": fallback_review_floor_applied,
            "human_band_guard_applied": False,
            "high_risk_corroborated": False,
            "high_risk_cap_applied": False,
        },
    )

    return InferenceResult(
        classification=labels["classification"],
        confidence_score=human_score,
        kill_switch_triggered=True,
        kill_switch_reason=reason,
        features=features,
        behavioral_summary=behavioral_summary,
        advanced_stats={
            **behavioral_summary,
            "decision_source": "FALLBACK_RULES",
            "model_available": False,
            "model_name": MODEL_NAME,
            "model_version": "fallback-rules",
            "degraded_analysis": True,
            "model_error": reason,
            "model_feature_family": MODEL_FEATURE_FAMILY,
            "model_feature_columns": MODEL_FEATURE_COLUMNS,
            "model_feature_vector": model_feature_vector,
            "scoring_engine_version": SCORING_ENGINE_VERSION,
            "model_human_score": None,
            "rules_risk_score": rules_risk_score,
            "rules_human_score": rules_human_score,
            "weighted_human_score": rules_human_score,
            "fusion_policy": "behavioral_rules_only_with_review_floor",
            "fallback_review_floor_applied": (
                fallback_review_floor_applied
            ),
            "decision_notes": (
                [
                    "High Risk was withheld because the trained timing model "
                    "was unavailable; the behavioral-only result was limited "
                    "to Needs Review."
                ]
                if fallback_review_floor_applied
                else []
            ),
            "human_score": human_score,
            "confidence_score": human_score,
            "risk_score": final_risk_score,
            "risk_level": labels["risk_level"],
            "classification": labels["classification"],
            "score_diagnostics": score_diagnostics,
            "feature_vector": features,
            "feature_explanations": build_feature_explanations(features),
            "academic_interpretation": (
                "The trained timing model was unavailable, so this result uses "
                "behavioral rules only. It is supporting evidence, not absolute "
                "proof of authorship or misconduct."
            ),
        },
        decision_source="FALLBACK_RULES",
        risk_level=labels["risk_level"],
        risk_score=final_risk_score,
        human_score=human_score,
    )


class ModelArtifacts:
    def __init__(self) -> None:
        self.model = None
        self.scaler = None
        self.feature_columns: List[str] = list(MODEL_FEATURE_COLUMNS)
        self.feature_schema: Dict[str, Any] = {}
        self.metrics: Dict[str, Any] = {}
        self.model_card: Dict[str, Any] = {}
        self.manifest: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.load_error: Optional[str] = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.scaler is not None

    @staticmethod
    def _load_json(path: Path) -> Dict[str, Any]:
        if not path.exists():
            raise FileNotFoundError(f"Missing required artifact: {path}")

        with path.open("r", encoding="utf-8") as file:
            value = json.load(file)

        if not isinstance(value, dict):
            raise ValueError(f"Artifact JSON must contain an object: {path}")
        return value

    @staticmethod
    def _validate_score_profile(metrics: Dict[str, Any]) -> None:
        required_fields = (
            "decision_threshold",
            "train_score_min",
            "train_score_p01",
            "train_score_p05",
            "train_score_p95",
        )
        missing = [field for field in required_fields if field not in metrics]
        if missing:
            raise ValueError(
                f"Model metrics are missing score-profile fields: {missing}."
            )

        train_minimum = _safe_float(
            metrics.get("train_score_min"),
            float("nan"),
        )
        percentile_01 = _safe_float(
            metrics.get("train_score_p01"),
            float("nan"),
        )
        percentile_05 = _safe_float(
            metrics.get("train_score_p05"),
            float("nan"),
        )
        percentile_95 = _safe_float(
            metrics.get("train_score_p95"),
            float("nan"),
        )
        threshold = _safe_float(
            metrics.get("decision_threshold"),
            float("nan"),
        )

        values = (
            train_minimum,
            percentile_01,
            percentile_05,
            percentile_95,
            threshold,
        )
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Model score profile contains non-finite values.")

        if not train_minimum <= percentile_01 <= percentile_05 <= percentile_95:
            raise ValueError(
                "Model score-profile quantiles are not monotonically ordered."
            )

        if abs(threshold - percentile_05) > 1e-5:
            raise ValueError(
                "Decision threshold does not match the recorded training p05 "
                "threshold policy."
            )

    @staticmethod
    def _validate_manifest(manifest: Dict[str, Any]) -> None:
        if int(manifest.get("manifest_version", 0)) != 1:
            raise ValueError("Unsupported or missing artifact manifest version.")
        if manifest.get("model_version") != MODEL_VERSION:
            raise ValueError(
                "Artifact manifest model version is incompatible. Expected "
                f"{MODEL_VERSION}, got {manifest.get('model_version')}."
            )
        if manifest.get("feature_family") != MODEL_FEATURE_FAMILY:
            raise ValueError(
                "Artifact manifest feature family is incompatible. Expected "
                f"{MODEL_FEATURE_FAMILY}, got {manifest.get('feature_family')}."
            )

        file_records = manifest.get("files")
        if not isinstance(file_records, dict):
            raise ValueError("Artifact manifest does not contain file records.")

        for filename, path in PRIMARY_ARTIFACT_PATHS.items():
            record = file_records.get(filename)
            if not isinstance(record, dict):
                raise ValueError(
                    f"Artifact manifest is missing a record for {filename}."
                )
            if not path.exists():
                raise FileNotFoundError(f"Missing required artifact: {path}")

            expected_hash = str(record.get("sha256") or "").lower()
            if len(expected_hash) != 64:
                raise ValueError(
                    f"Artifact manifest has an invalid SHA-256 for {filename}."
                )

            actual_hash = _sha256_file(path)
            if actual_hash != expected_hash:
                raise ValueError(
                    f"Artifact integrity check failed for {filename}."
                )

    def _reset(self) -> None:
        self.model = None
        self.scaler = None
        self.feature_columns = list(MODEL_FEATURE_COLUMNS)
        self.feature_schema = {}
        self.metrics = {}
        self.model_card = {}
        self.manifest = {}
        self.metadata = {}

    def load(self) -> None:
        self._reset()

        try:
            if not ARTIFACT_MANIFEST_PATH.exists():
                raise FileNotFoundError(
                    f"Missing {ARTIFACT_MANIFEST_PATH}. Retrain the timing-only "
                    "model with: python -m app.ml.train_isolation_forest "
                    "--dataset-dir D:\\DATASET"
                )

            self.manifest = self._load_json(ARTIFACT_MANIFEST_PATH)
            self._validate_manifest(self.manifest)

            self.feature_schema = self._load_json(FEATURE_SCHEMA_PATH)
            self.metrics = self._load_json(METRICS_PATH)
            self.model_card = self._load_json(MODEL_CARD_PATH)

            schema_version = int(
                self.feature_schema.get("schema_version", 0)
            )
            if schema_version != FEATURE_SCHEMA_VERSION:
                raise ValueError(
                    "Artifact feature schema version is incompatible. Expected "
                    f"{FEATURE_SCHEMA_VERSION}, got {schema_version}."
                )

            if self.feature_schema.get("model_version") != MODEL_VERSION:
                raise ValueError(
                    "Artifact feature schema was created for a different model "
                    f"version: {self.feature_schema.get('model_version')}."
                )

            if (
                self.feature_schema.get("feature_family")
                != MODEL_FEATURE_FAMILY
            ):
                raise ValueError(
                    "Artifact feature schema does not use the timing-only "
                    f"family {MODEL_FEATURE_FAMILY}."
                )

            self.feature_columns = validate_model_feature_columns(
                self.feature_schema.get("feature_columns") or []
            )

            if self.metrics.get("model_version") != MODEL_VERSION:
                raise ValueError("Metrics belong to an incompatible model version.")
            if self.model_card.get("model_version") != MODEL_VERSION:
                raise ValueError(
                    "Model card belongs to an incompatible model version."
                )

            self._validate_score_profile(self.metrics)

            self.model = joblib.load(MODEL_PATH)
            self.scaler = joblib.load(SCALER_PATH)

            expected_feature_count = len(self.feature_columns)
            scaler_feature_count = int(
                getattr(self.scaler, "n_features_in_", -1)
            )
            model_feature_count = int(
                getattr(self.model, "n_features_in_", -1)
            )

            if scaler_feature_count != expected_feature_count:
                raise ValueError(
                    "Scaler feature count does not match feature schema: "
                    f"{scaler_feature_count} != {expected_feature_count}."
                )
            if model_feature_count != expected_feature_count:
                raise ValueError(
                    "Model feature count does not match feature schema: "
                    f"{model_feature_count} != {expected_feature_count}."
                )

            scaler_names = list(
                getattr(self.scaler, "feature_names_in_", [])
            )
            if scaler_names and scaler_names != self.feature_columns:
                raise ValueError(
                    "Scaler feature order does not match feature schema."
                )

            self.metadata = {
                "model_name": self.model_card.get("model_name", MODEL_NAME),
                "model_version": self.model_card.get(
                    "model_version",
                    MODEL_VERSION,
                ),
                "trained_at": self.model_card.get("trained_at")
                or self.metrics.get("trained_at"),
                "algorithm": self.model_card.get(
                    "algorithm",
                    "IsolationForest",
                ),
                "feature_family": MODEL_FEATURE_FAMILY,
                "roc_auc": self.metrics.get("roc_auc"),
                "balanced_accuracy": self.metrics.get(
                    "balanced_accuracy"
                ),
                "false_positive_rate": self.metrics.get(
                    "false_positive_rate_human_flagged"
                ),
                "false_negative_rate": self.metrics.get(
                    "false_negative_rate_synthetic_accepted"
                ),
                "accuracy": self.metrics.get("accuracy"),
                "feature_count": expected_feature_count,
            }
            self.load_error = None
            log.info(
                "TypeTrace timing-only Isolation Forest artifacts loaded: %s "
                "features, version %s.",
                expected_feature_count,
                MODEL_VERSION,
            )
        except Exception as exc:
            self._reset()
            self.metadata = {
                "model_name": MODEL_NAME,
                "model_version": "fallback-rules",
                "degraded_analysis": True,
                "algorithm": "fallback_rules",
                "feature_family": MODEL_FEATURE_FAMILY,
            }
            self.load_error = str(exc)
            log.warning(
                "ML artifacts unavailable or incompatible; fallback rules remain "
                "active: %s",
                exc,
            )

    def status(self) -> Dict[str, Any]:
        return {
            "model_available": self.is_loaded,
            "loaded": self.is_loaded,
            "load_error": self.load_error,
            "model_name": self.metadata.get("model_name", MODEL_NAME),
            "model_version": self.metadata.get(
                "model_version",
                MODEL_VERSION if self.is_loaded else "fallback-rules",
            ),
            "algorithm": self.metadata.get(
                "algorithm",
                "IsolationForest" if self.is_loaded else "fallback_rules",
            ),
            "trained_at": self.metadata.get("trained_at"),
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "feature_family": MODEL_FEATURE_FAMILY,
            "feature_count": len(self.feature_columns),
            "feature_columns": self.feature_columns,
            "metrics": self.metrics,
            "model_card": self.model_card,
            "artifact_manifest": self.manifest,
            "artifact_paths": {
                "model": str(MODEL_PATH),
                "scaler": str(SCALER_PATH),
                "feature_schema": str(FEATURE_SCHEMA_PATH),
                "metrics": str(METRICS_PATH),
                "model_card": str(MODEL_CARD_PATH),
                "manifest": str(ARTIFACT_MANIFEST_PATH),
            },
            "fallback_available": True,
            "decision_modes": {
                "timing_isolation_forest": self.is_loaded,
                "behavioral_rules": True,
                "paste_override": True,
            },
            "scoring_model": {
                "engine_version": SCORING_ENGINE_VERSION,
                "type": "weighted_evidence_fusion",
                "score_name": "human_score",
                "range": [0, 100],
                "weights": {
                    "timing_model": MODEL_SCORE_WEIGHT,
                    "behavioral_rules": BEHAVIORAL_SCORE_WEIGHT,
                },
                "thresholds": {
                    "human_min": HUMAN_SCORE_THRESHOLD,
                    "suspicious_min": SUSPICIOUS_SCORE_THRESHOLD,
                },
                "category_guards": {
                    "human_requires_both_layers": True,
                    "high_risk_requires_corroboration": True,
                    "uncorroborated_low_score_floor": NEEDS_REVIEW_FLOOR,
                    "human_disagreement_cap": NEEDS_REVIEW_MAX_SCORE,
                },
                "model_score_mapping": {
                    "train_min": 0,
                    "below_train_p01_max": 49.99,
                    "train_p01": 50,
                    "below_train_p05_max": 79.99,
                    "train_p05_threshold": 80,
                    "train_p95": 100,
                },
            },
        }


class TypeTraceInferenceEngine:
    def __init__(self) -> None:
        self.artifacts = ModelArtifacts()
        self.artifacts.load()

    def reload(self) -> Dict[str, Any]:
        self.artifacts.load()
        return {
            "status": "ready" if self.artifacts.is_loaded else "degraded",
            "message": (
                "Timing-only Isolation Forest artifacts reloaded successfully."
                if self.artifacts.is_loaded
                else "Isolation Forest artifacts are unavailable or incompatible. "
                "Fallback rules remain active."
            ),
            "model_status": self.get_status(),
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": "ready" if self.artifacts.is_loaded else "degraded",
            **self.artifacts.status(),
        }

    def _decision_threshold(self) -> float:
        return _safe_float(
            self.artifacts.metrics.get("decision_threshold"),
            0.0,
        )

    def _model_human_score(self, decision_score: float) -> float:
        """Continuously map a timing anomaly score to the 0-100 evidence scale.

        Anchors:
        - training minimum -> 0
        - immediately below training p01 -> 49.99
        - training p01 -> 50
        - immediately below training p05 -> 79.99
        - training p05 -> 80
        - training p95 -> 100

        The one-hundredth boundary guards prevent two-decimal database storage
        from displaying a score in a different classification band.
        """

        metrics = self.artifacts.metrics
        train_minimum = _safe_float(metrics.get("train_score_min"))
        percentile_01 = _safe_float(metrics.get("train_score_p01"))
        threshold = self._decision_threshold()
        percentile_95 = _safe_float(metrics.get("train_score_p95"))

        if decision_score >= threshold:
            return _clamp(
                _linear_map(
                    decision_score,
                    threshold,
                    percentile_95,
                    HUMAN_SCORE_THRESHOLD,
                    100.0,
                )
            )

        if decision_score >= percentile_01:
            return _clamp(
                _linear_map(
                    decision_score,
                    percentile_01,
                    threshold,
                    SUSPICIOUS_SCORE_THRESHOLD,
                    HUMAN_SCORE_THRESHOLD - 0.01,
                )
            )

        return _clamp(
            _linear_map(
                decision_score,
                train_minimum,
                percentile_01,
                0.0,
                SUSPICIOUS_SCORE_THRESHOLD - 0.01,
            )
        )

    def analyze(
        self,
        *,
        events: List[Dict[str, Any]],
        stats: Any,
        text_content: str,
    ) -> InferenceResult:
        clean_events = [
            event for event in (events or []) if isinstance(event, dict)
        ]

        try:
            features = extract_typetrace_event_features(
                events=clean_events,
                stats=stats,
                text_content=text_content or "",
            )
            behavioral_summary = compute_behavioral_summary(
                events=clean_events,
                stats=stats,
                text_content=text_content or "",
                model_features=features,
            )

            if not self.artifacts.is_loaded:
                return _fallback_result(
                    text_content=text_content or "",
                    keystroke_array=clean_events,
                    stats=stats,
                    reason=self.artifacts.load_error
                    or "Isolation Forest artifacts are not loaded.",
                )

            model_feature_vector = select_feature_vector(
                features,
                self.artifacts.feature_columns,
            )
            matrix = feature_vector_to_matrix(
                features,
                self.artifacts.feature_columns,
            )

            matrix_frame = pd.DataFrame(
                matrix,
                columns=self.artifacts.feature_columns,
            )

            scaled_matrix = self.artifacts.scaler.transform(matrix_frame)
            decision_score = float(
                self.artifacts.model.decision_function(scaled_matrix)[0]
            )
            raw_score = float(
                self.artifacts.model.score_samples(scaled_matrix)[0]
            )
            threshold = self._decision_threshold()

            model_human_score = self._model_human_score(decision_score)
            rules_risk_score = _clamp(
                behavioral_summary.get("risk_score", 0),
                0,
                100,
            )
            rules_human_score = _clamp(
                100.0 - rules_risk_score,
                0,
                100,
            )

            fusion = fuse_evidence_scores(
                model_human_score=model_human_score,
                rules_human_score=rules_human_score,
                behavioral_summary=behavioral_summary,
            )
            human_score = _clamp(fusion["final_human_score"])
            risk_score = _clamp(fusion["final_risk_score"])
            classification = str(fusion["classification"])
            risk_level = str(fusion["risk_level"])
            confidence = human_score

            decision_source = "MODEL_FUSION"
            risk_signals = list(
                behavioral_summary.get("risk_signals") or []
            )
            human_signals = list(
                behavioral_summary.get("human_signals") or []
            )

            if model_human_score < SUSPICIOUS_SCORE_THRESHOLD:
                model_signal = (
                    "Isolation Forest marked the timing profile as strongly "
                    "outside the learned human timing baseline."
                )
                if model_signal not in risk_signals:
                    risk_signals.append(model_signal)
            elif model_human_score < HUMAN_SCORE_THRESHOLD:
                model_signal = (
                    "Isolation Forest marked the timing profile as borderline "
                    "outside the learned human timing baseline."
                )
                if model_signal not in risk_signals:
                    risk_signals.append(model_signal)
            else:
                model_signal = (
                    "Isolation Forest placed the timing profile inside the "
                    "learned human timing baseline."
                )
                if model_signal not in human_signals:
                    human_signals.append(model_signal)

            decision_notes: List[str] = []
            if fusion["needs_review_floor_applied"]:
                decision_notes.append(
                    "A low weighted score was limited to Needs Review because "
                    "the timing anomaly lacked sufficient independent process "
                    "corroboration for a High Risk decision."
                )
            if fusion["human_band_guard_applied"]:
                decision_notes.append(
                    "Human classification was withheld because both the timing "
                    "model and behavioral layer must independently reach the "
                    "human evidence band."
                )
            if fusion["high_risk_corroborated"]:
                decision_notes.append(
                    "High Risk was permitted because a strong timing anomaly "
                    "was corroborated by independent mechanical and writing-"
                    "process risk signals."
                )

            score_diagnostics = _build_score_diagnostics(
                decision_source=decision_source,
                model_decision_score=decision_score,
                model_decision_threshold=threshold,
                model_human_score=model_human_score,
                rules_risk_score=rules_risk_score,
                rules_human_score=rules_human_score,
                final_human_score=human_score,
                final_risk_score=risk_score,
                classification=classification,
                risk_level=risk_level,
                model_feature_count=len(self.artifacts.feature_columns),
                fusion_diagnostics=fusion,
            )

            advanced_stats = {
                **behavioral_summary,
                "decision_source": decision_source,
                "model_available": True,
                "degraded_analysis": False,
                "model_name": self.artifacts.metadata.get(
                    "model_name",
                    MODEL_NAME,
                ),
                "model_version": self.artifacts.metadata.get(
                    "model_version",
                    MODEL_VERSION,
                ),
                "model_algorithm": "IsolationForest",
                "model_feature_family": MODEL_FEATURE_FAMILY,
                "model_feature_columns": self.artifacts.feature_columns,
                "model_feature_vector": model_feature_vector,
                "scoring_engine_version": SCORING_ENGINE_VERSION,
                "model_score": _safe_float(decision_score),
                "model_raw_score": _safe_float(raw_score),
                "model_decision_threshold": _safe_float(threshold),
                "model_human_score": model_human_score,
                "rules_risk_score": rules_risk_score,
                "rules_human_score": rules_human_score,
                "weighted_human_score": fusion["weighted_human_score"],
                "fusion_policy": fusion["policy"],
                "model_weight": fusion["model_weight"],
                "behavioral_weight": fusion["behavioral_weight"],
                "high_risk_corroborated": fusion[
                    "high_risk_corroborated"
                ],
                "corroborating_risk_signals": fusion[
                    "corroboration"
                ]["active_signals"],
                "fusion_guards": {
                    "high_risk_cap_applied": fusion[
                        "high_risk_cap_applied"
                    ],
                    "needs_review_floor_applied": fusion[
                        "needs_review_floor_applied"
                    ],
                    "human_band_guard_applied": fusion[
                        "human_band_guard_applied"
                    ],
                },
                "decision_notes": decision_notes,
                "human_score": human_score,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "classification": classification,
                "confidence_score": confidence,
                "score_diagnostics": score_diagnostics,
                "risk_signals": risk_signals,
                "human_signals": human_signals,
                "feature_vector": features,
                "feature_explanations": build_feature_explanations(features),
                "model_metrics": {
                    "accuracy": self.artifacts.metrics.get("accuracy"),
                    "balanced_accuracy": self.artifacts.metrics.get(
                        "balanced_accuracy"
                    ),
                    "roc_auc": self.artifacts.metrics.get("roc_auc"),
                    "false_positive_rate": self.artifacts.metrics.get(
                        "false_positive_rate_human_flagged"
                    ),
                    "false_negative_rate": self.artifacts.metrics.get(
                        "false_negative_rate_synthetic_accepted"
                    ),
                    "synthetic_detection_rate": self.artifacts.metrics.get(
                        "synthetic_detection_rate"
                    ),
                },
                "academic_interpretation": (
                    "The Isolation Forest evaluates timing-liveness features "
                    "only. TypeTrace writing-process signals are evaluated by a "
                    "separate behavioral layer and combined using a weighted "
                    "policy with corroboration safeguards. The result supports, "
                    "but does not replace, human academic review."
                ),
            }

            return InferenceResult(
                classification=classification,
                confidence_score=confidence,
                kill_switch_triggered=False,
                kill_switch_reason=None,
                features=features,
                behavioral_summary=behavioral_summary,
                advanced_stats=advanced_stats,
                decision_source=decision_source,
                risk_level=risk_level,
                risk_score=risk_score,
                human_score=human_score,
            )
        except (FloatingPointError, OverflowError) as exc:
            log.warning("Inference numerical validation failed: %s", exc)
            raise InferenceInputError(
                "Submitted evidence produced invalid numerical features."
            ) from exc
        except InferenceFailure:
            raise
        except Exception as exc:
            log.exception("Unexpected ML inference failure: %s", exc)
            raise InferenceInternalError(
                "The analysis engine encountered an unexpected internal failure."
            ) from exc


inference_engine = TypeTraceInferenceEngine()
