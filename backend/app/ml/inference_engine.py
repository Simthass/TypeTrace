"""Production inference engine for TypeTrace.

Part 3 integrates the official Isolation Forest model while keeping the project
safe if artifacts are missing: model inference is used when available, and the
existing behavioral fallback/rule layer remains available at all times.

FIX (unified scoring model): Previously `confidence` flipped meaning based on
classification -- for HUMAN it meant "how human-like" (normality_score), but
for SUSPICIOUS/SYNTHETIC it meant "how risky" (risk_score). That produced the
illusion of three separate 100% scales (Human / Suspicious / AI Generated)
instead of one continuous score, which is confusing and not how anomaly-based
SaaS products (Vectra, Darktrace, Sift, etc.) present trust scores.

This version computes ONE number -- `human_score` (0-100) -- that always means
"how strongly this session's writing behavior matches human authorship,"
regardless of classification. Classification and risk_level are both derived
FROM that single score using fixed thresholds:

    human_score >= 80   -> HUMAN            (risk_level LOW)
    human_score 50-79   -> SUSPICIOUS       (risk_level MEDIUM) "Review Required"
    human_score <  50   -> SYNTHETIC        (risk_level HIGH)   "High Risk"

`confidence_score` returned to the API is now always equal to `human_score`,
so a caller never has to know which "direction" a percentage points.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from app.ml.behavioral_analysis import (
    build_feature_explanations,
    compute_behavioral_summary,
)
from app.ml.feature_extraction import extract_typetrace_event_features, feature_vector_to_matrix
from app.ml.feature_schema import FEATURE_COLUMNS, MODEL_NAME, MODEL_VERSION

log = logging.getLogger("TypeTrace-InferenceEngine")

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "isolation_forest.joblib"
SCALER_PATH = ARTIFACT_DIR / "scaler.joblib"
FEATURE_SCHEMA_PATH = ARTIFACT_DIR / "feature_schema.json"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
MODEL_CARD_PATH = ARTIFACT_DIR / "model_card.json"

# Single-score classification thresholds. Keep these as the ONE source of
# truth for turning human_score into a label anywhere in the backend.
HUMAN_SCORE_THRESHOLD = 80.0
SUSPICIOUS_SCORE_THRESHOLD = 50.0


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _clamp(value: Any, minimum: float = 0.0, maximum: float = 100.0) -> float:
    safe = _safe_float(value, minimum)
    return round(max(minimum, min(maximum, safe)), 2)


def classify_from_human_score(human_score: float) -> Dict[str, str]:
    """Single source of truth: derive classification + risk_level from the
    one unified human_score (0-100, higher = more human-like)."""
    if human_score >= HUMAN_SCORE_THRESHOLD:
        return {"classification": "HUMAN", "risk_level": "LOW"}
    if human_score >= SUSPICIOUS_SCORE_THRESHOLD:
        return {"classification": "SUSPICIOUS", "risk_level": "MEDIUM"}
    return {"classification": "SYNTHETIC", "risk_level": "HIGH"}


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
    reason: str,
) -> InferenceResult:
    behavioral_summary = compute_behavioral_summary(
        events=keystroke_array,
        stats=None,
        text_content=text_content,
        model_features={},
    )
    rules_risk_score = _clamp(behavioral_summary.get("risk_score", 50), 0, 100)
    human_score = _clamp(100.0 - rules_risk_score, 0, 100)
    labels = classify_from_human_score(human_score)

    return InferenceResult(
        classification=labels["classification"],
        confidence_score=human_score,
        kill_switch_triggered=True,
        kill_switch_reason=reason,
        features={},
        behavioral_summary=behavioral_summary,
        advanced_stats={
            **behavioral_summary,
            "decision_source": "fallback_rules",
            "model_available": False,
            "model_name": MODEL_NAME,
            "model_version": "fallback-rules",
            "model_error": reason,
            "human_score": human_score,
            "risk_score": rules_risk_score,
            "risk_level": labels["risk_level"],
            "feature_explanations": build_feature_explanations({}),
            "academic_interpretation": (
                "This result provides supporting behavioral evidence and should not be "
                "treated as absolute proof of authorship or misconduct."
            ),
        },
        decision_source="fallback_rules",
        risk_level=labels["risk_level"],
        risk_score=rules_risk_score,
        human_score=human_score,
    )


class ModelArtifacts:
    def __init__(self) -> None:
        self.model = None
        self.scaler = None
        self.feature_columns: List[str] = list(FEATURE_COLUMNS)
        self.feature_schema: Dict[str, Any] = {}
        self.metrics: Dict[str, Any] = {}
        self.model_card: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.load_error: Optional[str] = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.scaler is not None

    def _load_json(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as file:
            value = json.load(file)
        return value if isinstance(value, dict) else {}

    def load(self) -> None:
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Missing {MODEL_PATH}. Train the model with: "
                    "python -m app.ml.train_isolation_forest --dataset-dir D:\\DATASET"
                )
            if not SCALER_PATH.exists():
                raise FileNotFoundError(f"Missing {SCALER_PATH}")

            self.model = joblib.load(MODEL_PATH)
            self.scaler = joblib.load(SCALER_PATH)
            self.feature_schema = self._load_json(FEATURE_SCHEMA_PATH)
            self.metrics = self._load_json(METRICS_PATH)
            self.model_card = self._load_json(MODEL_CARD_PATH)
            self.feature_columns = list(self.feature_schema.get("feature_columns") or FEATURE_COLUMNS)
            self.metadata = {
                "model_name": self.model_card.get("model_name", MODEL_NAME),
                "model_version": self.model_card.get("model_version", MODEL_VERSION),
                "trained_at": self.model_card.get("trained_at") or self.metrics.get("trained_at"),
                "algorithm": self.model_card.get("algorithm", "IsolationForest"),
                "roc_auc": self.metrics.get("roc_auc"),
                "false_positive_rate": self.metrics.get("false_positive_rate_human_flagged"),
                "false_negative_rate": self.metrics.get("false_negative_rate_synthetic_accepted"),
                "accuracy": self.metrics.get("accuracy"),
                "feature_count": len(self.feature_columns),
            }
            self.load_error = None
            log.info("TypeTrace Isolation Forest artifacts loaded successfully.")
        except Exception as exc:
            self.model = None
            self.scaler = None
            self.feature_columns = list(FEATURE_COLUMNS)
            self.feature_schema = {}
            self.metrics = {}
            self.model_card = {}
            self.metadata = {
                "model_name": MODEL_NAME,
                "model_version": "fallback-rules",
                "algorithm": "fallback_rules",
            }
            self.load_error = str(exc)
            log.warning("ML artifacts unavailable; fallback rules remain active: %s", exc)

    def status(self) -> Dict[str, Any]:
        return {
            "model_available": self.is_loaded,
            "loaded": self.is_loaded,
            "load_error": self.load_error,
            "model_name": self.metadata.get("model_name", MODEL_NAME),
            "model_version": self.metadata.get("model_version", MODEL_VERSION if self.is_loaded else "fallback-rules"),
            "algorithm": self.metadata.get("algorithm", "IsolationForest" if self.is_loaded else "fallback_rules"),
            "trained_at": self.metadata.get("trained_at"),
            "feature_count": len(self.feature_columns or []),
            "feature_columns": self.feature_columns,
            "metrics": self.metrics,
            "model_card": self.model_card,
            "artifact_paths": {
                "model": str(MODEL_PATH),
                "scaler": str(SCALER_PATH),
                "feature_schema": str(FEATURE_SCHEMA_PATH),
                "metrics": str(METRICS_PATH),
                "model_card": str(MODEL_CARD_PATH),
            },
            "fallback_available": True,
            "decision_modes": {
                "isolation_forest": self.is_loaded,
                "behavioral_rules": True,
                "paste_override": True,
            },
            "scoring_model": {
                "type": "single_unified_score",
                "score_name": "human_score",
                "range": [0, 100],
                "thresholds": {
                    "human_min": HUMAN_SCORE_THRESHOLD,
                    "suspicious_min": SUSPICIOUS_SCORE_THRESHOLD,
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
                "Isolation Forest artifacts reloaded successfully."
                if self.artifacts.is_loaded
                else "Isolation Forest artifacts are unavailable. Fallback rules remain active."
            ),
            "model_status": self.get_status(),
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": "ready" if self.artifacts.is_loaded else "degraded",
            **self.artifacts.status(),
        }

    def _decision_threshold(self) -> float:
        metrics = self.artifacts.metrics or {}
        return _safe_float(metrics.get("decision_threshold"), 0.0)

    def _model_human_score(self, decision_score: float) -> float:
        """Map an Isolation Forest decision_function score to a 0-100
        human-likeness score, anchored at the model's own pass/fail
        threshold (train_score_p05).

        decision_score >= threshold ("inside the learned human baseline")
        maps onto a HIGH-confidence band [60, 100]. decision_score < threshold
        maps onto a LOW-confidence band [0, 60). This guarantees a session
        the model itself considers "inside the human baseline" can never,
        by itself, drop below the SUSPICIOUS threshold from the model alone.
        """
        metrics = self.artifacts.metrics or {}
        threshold = self._decision_threshold()
        low = _safe_float(metrics.get("train_score_p05"), threshold - 0.05)
        high = _safe_float(metrics.get("train_score_p95"), threshold + 0.20)

        if decision_score >= threshold:
            if high <= threshold:
                return 100.0
            ratio = _clamp(((decision_score - threshold) / (high - threshold)) * 100.0, 0, 100) / 100.0
            return round(60.0 + ratio * 40.0, 2)

        if threshold <= low:
            return 0.0

        ratio = _clamp(((decision_score - low) / (threshold - low)) * 100.0, 0, 100) / 100.0
        score = round(ratio * 60.0, 2)

        # Clearly-outside-baseline sessions should read as decisively
        # non-human, not borderline.
        return min(score, 35.0)

    def analyze(
        self,
        *,
        events: List[Dict[str, Any]],
        stats: Any,
        text_content: str,
    ) -> InferenceResult:
        clean_events = [event for event in (events or []) if isinstance(event, dict)]

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
                    reason=self.artifacts.load_error or "Isolation Forest artifacts are not loaded.",
                )

            X = feature_vector_to_matrix(features)
            X_scaled = self.artifacts.scaler.transform(X)
            decision_score = float(self.artifacts.model.decision_function(X_scaled)[0])
            raw_score = float(self.artifacts.model.score_samples(X_scaled)[0])
            threshold = self._decision_threshold()

            model_human_score = self._model_human_score(decision_score)
            rules_risk_score = _clamp(behavioral_summary.get("risk_score", 0), 0, 100)
            rules_human_score = _clamp(100.0 - rules_risk_score, 0, 100)

            # Take the more cautious (lower) of the two human-likeness
            # estimates -- either signal being strongly non-human should
            # be enough to lower the overall score.
            human_score = _clamp(min(model_human_score, rules_human_score), 0, 100)
            risk_score = _clamp(100.0 - human_score, 0, 100)

            labels = classify_from_human_score(human_score)
            classification = labels["classification"]
            risk_level = labels["risk_level"]

            # confidence_score now ALWAYS means "how human-like," regardless
            # of classification -- no more direction-flipping.
            confidence = human_score

            decision_source = "isolation_forest_plus_behavioral_rules"
            risk_signals = list(behavioral_summary.get("risk_signals") or [])
            human_signals = list(behavioral_summary.get("human_signals") or [])

            if decision_score < threshold:
                risk_signals.append("Isolation Forest marked the timing profile as outside the learned human baseline.")
            else:
                human_signals.append("Isolation Forest placed the timing profile inside the learned human baseline.")

            advanced_stats = {
                **behavioral_summary,
                "decision_source": decision_source,
                "model_available": True,
                "model_name": self.artifacts.metadata.get("model_name", MODEL_NAME),
                "model_version": self.artifacts.metadata.get("model_version", MODEL_VERSION),
                "model_algorithm": "IsolationForest",
                "model_score": _safe_float(decision_score),
                "model_raw_score": _safe_float(raw_score),
                "model_decision_threshold": _safe_float(threshold),
                "model_human_score": model_human_score,
                "rules_human_score": rules_human_score,
                "human_score": human_score,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "classification": classification,
                "confidence_score": confidence,
                "risk_signals": risk_signals,
                "human_signals": human_signals,
                "feature_vector": features,
                "feature_explanations": build_feature_explanations(features),
                "model_metrics": {
                    "accuracy": self.artifacts.metrics.get("accuracy"),
                    "roc_auc": self.artifacts.metrics.get("roc_auc"),
                    "false_positive_rate": self.artifacts.metrics.get("false_positive_rate_human_flagged"),
                    "false_negative_rate": self.artifacts.metrics.get("false_negative_rate_synthetic_accepted"),
                },
                "academic_interpretation": (
                    "Human Writing Evidence Score is a single 0-100 behavioral score, not a "
                    "text-content AI detector. It should support, not replace, human academic review."
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
        except Exception as exc:
            log.exception("ML inference failed completely: %s", exc)
            return _fallback_result(
                text_content=text_content or "",
                keystroke_array=clean_events,
                reason="ML inference failed. Fallback behavioral rules were used.",
            )


inference_engine = TypeTraceInferenceEngine()