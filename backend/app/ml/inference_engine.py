# backend/app/ml/inference_engine.py

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from app.ml.behavioral_analysis import (
    HIGH_PASTE_COUNT,
    MAX_HUMAN_REASONABLE_WPM,
    VERY_LOW_IKI_ENTROPY,
    VERY_LOW_IKI_STD,
    build_feature_explanations,
    compute_behavioral_summary,
)

from app.ml.train_model import (
    FEATURE_COLUMNS,
    MINIMUM_KEYS_PER_SESSION,
    extract_features_from_keystroke_array,
)

log = logging.getLogger("TypeTrace-InferenceEngine")

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "typetrace_rf_model.joblib"
SCALER_PATH = BASE_DIR / "typetrace_scaler.joblib"
ENCODER_PATH = BASE_DIR / "typetrace_label_encoder.joblib"
FEATURES_PATH = BASE_DIR / "feature_columns.joblib"
META_PATH = BASE_DIR / "model_metadata.json"


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Convert value to float safely, handling NaN and Infinity."""
    try:
        result = float(value)

        if result != result:  # NaN check
            return default

        if result in {float("inf"), float("-inf")}:
            return default

        return result
    except (TypeError, ValueError):
        return default


def _clamp(value: Any, minimum: float = 0.0, maximum: float = 100.0) -> float:
    """Clamp a value between minimum and maximum, handling NaN/Infinity."""
    safe = _safe_float(value, minimum)
    return round(max(minimum, min(maximum, safe)), 2)


def _normalize_classification(value: Any) -> str:
    """Normalize classification labels to consistent values."""
    normalized = str(value or "UNKNOWN").strip().upper()

    if normalized in {"HUMAN", "SUSPICIOUS", "SYNTHETIC"}:
        return normalized

    if normalized in {"AI", "AI-GENERATED", "AI_GENERATED", "MACHINE"}:
        return "SYNTHETIC"

    if normalized in {"REAL", "NORMAL"}:
        return "HUMAN"

    if normalized in {"UNCERTAIN", "AMBIGUOUS"}:
        return "SUSPICIOUS"

    return "UNKNOWN"


def _risk_level_from_score(score: float) -> str:
    """Determine risk level from numeric score."""
    if score >= 70:
        return "HIGH"

    if score >= 40:
        return "MEDIUM"

    return "LOW"


def _fallback_result(
    *,
    text_content: str,
    keystroke_array: List[Dict[str, Any]],
    reason: str,
) -> "InferenceResult":
    """Create a safe fallback result when ML prediction fails."""
    behavioral_summary = compute_behavioral_summary(
        events=keystroke_array,
        stats=None,
        text_content=text_content,
        model_features={},
    )

    risk_score = _clamp(behavioral_summary.get("risk_score", 50), 0, 100)
    risk_level = str(
        behavioral_summary.get("risk_level") or _risk_level_from_score(risk_score)
    ).upper()

    if risk_level not in {"LOW", "MEDIUM", "HIGH"}:
        risk_level = _risk_level_from_score(risk_score)

    return InferenceResult(
        classification="SUSPICIOUS" if risk_score >= 40 else "UNKNOWN",
        confidence_score=0.0,
        kill_switch_triggered=True,
        kill_switch_reason=reason,
        features={},
        behavioral_summary=behavioral_summary,
        advanced_stats={
            **behavioral_summary,
            "decision_source": "fallback_rules",
            "model_available": False,
            "model_error": reason,
            "feature_explanations": build_feature_explanations({}),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "academic_interpretation": (
                "This result provides supporting behavioral evidence and should not be "
                "treated as absolute proof of authorship or misconduct."
            ),
        },
        decision_source="fallback_rules",
        risk_level=risk_level,
        risk_score=risk_score,
    )


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


class ModelArtifacts:
    def __init__(self) -> None:
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.feature_columns = FEATURE_COLUMNS
        self.metadata: Dict[str, Any] = {}
        self.load_error: Optional[str] = None

    @property
    def is_loaded(self) -> bool:
        return (
            self.model is not None
            and self.scaler is not None
            and self.label_encoder is not None
        )

    def load(self) -> None:
        try:
            self.model = joblib.load(MODEL_PATH)
            self.scaler = joblib.load(SCALER_PATH)
            self.label_encoder = joblib.load(ENCODER_PATH)

            if FEATURES_PATH.exists():
                self.feature_columns = joblib.load(FEATURES_PATH)
            else:
                self.feature_columns = FEATURE_COLUMNS

            if META_PATH.exists():
                with open(META_PATH, "r", encoding="utf-8") as file:
                    self.metadata = json.load(file)
            else:
                self.metadata = {}

            self.load_error = None
            log.info("TypeTrace ML artifacts loaded successfully.")

        except Exception as exc:
            self.model = None
            self.scaler = None
            self.label_encoder = None
            self.feature_columns = FEATURE_COLUMNS
            self.metadata = {}
            self.load_error = str(exc)
            log.exception("Failed to load TypeTrace ML artifacts: %s", exc)

    def status(self) -> Dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "load_error": self.load_error,
            "model_path": str(MODEL_PATH),
            "scaler_path": str(SCALER_PATH),
            "encoder_path": str(ENCODER_PATH),
            "features_path": str(FEATURES_PATH),
            "metadata_path": str(META_PATH),
            "feature_count": len(self.feature_columns),
            "feature_columns": self.feature_columns,
            "metadata": self.metadata,
        }


class TypeTraceInferenceEngine:
    def __init__(self) -> None:
        self.artifacts = ModelArtifacts()
        self.artifacts.load()

    def reload(self) -> Dict[str, Any]:
        """Reload ML artifacts and return deterministic status."""
        self.artifacts.load()

        return {
            "status": "ready" if self.artifacts.is_loaded else "degraded",
            "message": (
                "ML artifacts reloaded successfully."
                if self.artifacts.is_loaded
                else "ML artifacts could not be fully loaded. Fallback rules remain available."
            ),
            "model_status": self.get_status(),
        }

    def get_status(self) -> Dict[str, Any]:
        """Return enriched model status for monitoring."""
        return {
            "status": "ready" if self.artifacts.is_loaded else "degraded",
            "model_loaded": self.artifacts.model is not None,
            "scaler_loaded": self.artifacts.scaler is not None,
            "encoder_loaded": self.artifacts.label_encoder is not None,
            "feature_count": len(self.artifacts.feature_columns or []),
            "metadata": self.artifacts.metadata or {},
            "load_error": self.artifacts.load_error,
            "fallback_available": True,
            "decision_modes": {
                "model": self.artifacts.is_loaded,
                "fallback_rules": True,
            },
        }

    def _normalize_label(self, label: Any) -> str:
        normalized = str(label or "UNKNOWN").upper().strip()

        if normalized in {"AI", "AI_GENERATED", "AI-GENERATED", "SYNTHETIC"}:
            return "SYNTHETIC"

        if normalized in {"HUMAN", "REAL"}:
            return "HUMAN"

        if normalized in {"SUSPICIOUS", "UNCERTAIN"}:
            return "SUSPICIOUS"

        return "UNKNOWN"

    def _kill_switch(
        self,
        *,
        features: Dict[str, Any],
        behavioral_summary: Dict[str, Any],
        stats: Any,
    ) -> Tuple[bool, Optional[str]]:
        net_wpm = float(features.get("net_wpm", getattr(stats, "wpm", 0) if stats else 0) or 0)
        paste_count = int(behavioral_summary.get("paste_count", 0) or 0)
        ft_std = float(
            features.get("ft_std", behavioral_summary.get("flight_std", 999)) or 999
        )
        ft_entropy = float(
            features.get("ft_entropy", behavioral_summary.get("flight_entropy", 999)) or 999
        )
        total_keys = int(behavioral_summary.get("total_keys", 0) or 0)

        if net_wpm > MAX_HUMAN_REASONABLE_WPM:
            return True, "Superhuman writing speed detected."

        if paste_count > HIGH_PASTE_COUNT:
            return True, "Bulk paste behavior detected."

        if total_keys >= 30 and ft_std < VERY_LOW_IKI_STD:
            return True, "Mechanically uniform inter-key timing detected."

        if total_keys >= 50 and ft_entropy < VERY_LOW_IKI_ENTROPY:
            return True, "Very low typing-rhythm entropy detected."

        return False, None

    def _predict_with_model(
        self, features: Dict[str, Any]
    ) -> Tuple[str, float, Dict[str, float]]:
        if not self.artifacts.is_loaded:
            raise RuntimeError(
                "ML model artifacts are not loaded. Run train_model.py and ensure joblib files exist."
            )

        vector = np.array(
            [
                [
                    float(features.get(column, 0.0) or 0.0)
                    for column in self.artifacts.feature_columns
                ]
            ]
        )

        scaled_vector = self.artifacts.scaler.transform(vector)
        probabilities = self.artifacts.model.predict_proba(scaled_vector)[0]
        predicted_index = int(np.argmax(probabilities))

        raw_label = self.artifacts.label_encoder.inverse_transform([predicted_index])[0]
        classification = self._normalize_label(raw_label)
        confidence = _clamp(probabilities[predicted_index] * 100, 0, 100)

        class_probability_map: Dict[str, float] = {}
        for index, probability in enumerate(probabilities):
            class_label = self._normalize_label(
                self.artifacts.label_encoder.inverse_transform([index])[0]
            )
            class_probability_map[class_label] = _clamp(
                probability * 100, 0, 100
            )

        return classification, confidence, class_probability_map

    def _calibrate_decision(
        self,
        *,
        model_classification: str,
        model_confidence: float,
        behavioral_summary: Dict[str, Any],
        class_probabilities: Dict[str, float],
    ) -> Tuple[str, float, str]:
        risk_score = _clamp(behavioral_summary.get("risk_score", 0.0), 0, 100)

        if risk_score >= 75 and model_classification == "HUMAN":
            return (
                "SUSPICIOUS",
                max(model_confidence, risk_score),
                "model_plus_behavioral_override",
            )

        if risk_score >= 60 and model_confidence < 70:
            return (
                "SUSPICIOUS",
                max(model_confidence, risk_score),
                "behavioral_uncertainty",
            )

        if model_classification == "SYNTHETIC" and model_confidence < 65 and risk_score < 35:
            return "SUSPICIOUS", model_confidence, "low_confidence_model"

        if model_classification == "HUMAN" and model_confidence < 60:
            return "SUSPICIOUS", model_confidence, "low_confidence_model"

        return model_classification, model_confidence, "model"

    def analyze(
        self,
        *,
        events: List[Dict[str, Any]],
        stats: Any,
        text_content: str,
    ) -> InferenceResult:
        """Analyze writing session with ML prediction and fallback protection."""
        try:
            features = extract_features_from_keystroke_array(
                raw_array=events,
                total_keystrokes=int(getattr(stats, "keystrokes", 0) or 0),
                deletions=int(getattr(stats, "deletions", 0) or 0),
                pauses=int(getattr(stats, "pauses", 0) or 0),
                duration_seconds=float(getattr(stats, "sessionSeconds", 0) or 0),
                text_length=len(text_content or ""),
            )

            behavioral_summary = compute_behavioral_summary(
                events=events,
                stats=stats,
                text_content=text_content,
                model_features=features,
            )

            kill_triggered, kill_reason = self._kill_switch(
                features=features,
                behavioral_summary=behavioral_summary,
                stats=stats,
            )

            class_probabilities: Dict[str, float] = {}

            if kill_triggered:
                classification = "SYNTHETIC"
                confidence = 99.9
                decision_source = "kill_switch"
            elif self.artifacts.is_loaded:
                try:
                    model_classification, model_confidence, class_probabilities = (
                        self._predict_with_model(features)
                    )

                    classification, confidence, decision_source = (
                        self._calibrate_decision(
                            model_classification=model_classification,
                            model_confidence=model_confidence,
                            behavioral_summary=behavioral_summary,
                            class_probabilities=class_probabilities,
                        )
                    )
                except Exception as exc:
                    log.exception("ML model prediction failed: %s", exc)
                    return _fallback_result(
                        text_content=text_content,
                        keystroke_array=events,
                        reason=f"ML prediction failed: {str(exc)}",
                    )
            else:
                return _fallback_result(
                    text_content=text_content,
                    keystroke_array=events,
                    reason="ML model artifacts not loaded.",
                )

            # Normalize and bound all output values
            classification = _normalize_classification(classification)
            confidence = _clamp(confidence, 0, 100)
            risk_score = _clamp(behavioral_summary.get("risk_score", 0), 0, 100)
            risk_level = str(
                behavioral_summary.get("risk_level") or _risk_level_from_score(risk_score)
            ).upper()

            if risk_level not in {"LOW", "MEDIUM", "HIGH"}:
                risk_level = _risk_level_from_score(risk_score)

            advanced_stats = {
                "ht_mean": _clamp(features.get("ht_mean", 0), -1000, 1000),
                "ht_std": _clamp(features.get("ht_std", 0), 0, 10000),
                "ht_cv": _clamp(features.get("ht_cv", 0), 0, 100),
                "ft_mean": _clamp(features.get("ft_mean", 0), -1000, 1000),
                "ft_std": _clamp(features.get("ft_std", 0), 0, 10000),
                "ft_cv": _clamp(features.get("ft_cv", 0), 0, 100),
                "ft_entropy": _clamp(features.get("ft_entropy", 0), 0, 100),
                "ft_autocorr": _clamp(features.get("ft_autocorr", 0), -1, 1),
                "burst_ratio": _clamp(features.get("burst_ratio", 0), 0, 1),
                "pause_ratio": _clamp(features.get("pause_ratio", 0), 0, 1),
                "net_wpm": _clamp(features.get("net_wpm", 0), 0, 300),
                "key_diversity": _clamp(features.get("key_diversity", 0), 0, 1),
                "total_keys": max(0, int(features.get("total_keys", 0) or 0)),
                "paste_count": behavioral_summary.get("paste_count", 0),
                "paste_ratio": _clamp(behavioral_summary.get("paste_ratio", 0), 0, 1),
                "deletion_ratio": _clamp(behavioral_summary.get("deletion_ratio", 0), 0, 1),
                "longest_pause_ms": max(0, behavioral_summary.get("longest_pause_ms", 0) or 0),
                "risk_score": risk_score,
                "risk_level": risk_level,
                "risk_signals": behavioral_summary.get("risk_signals", []),
                "human_signals": behavioral_summary.get("human_signals", []),
                "class_probabilities": class_probabilities,
                "decision_source": decision_source,
                "model_available": self.artifacts.is_loaded,
                "feature_explanations": build_feature_explanations(features),
                "model_version": self.artifacts.metadata.get("version", "unknown"),
                "model_accuracy": self.artifacts.metadata.get("accuracy"),
                "model_cv_accuracy": self.artifacts.metadata.get("cv_accuracy"),
                "minimum_keys_required": MINIMUM_KEYS_PER_SESSION,
                "academic_interpretation": (
                    "This result provides supporting behavioral evidence and should not be "
                    "treated as absolute proof of authorship or misconduct."
                ),
            }

            return InferenceResult(
                classification=classification,
                confidence_score=confidence,
                kill_switch_triggered=kill_triggered,
                kill_switch_reason=kill_reason,
                features=features,
                behavioral_summary=behavioral_summary,
                advanced_stats=advanced_stats,
                decision_source=decision_source,
                risk_level=risk_level,
                risk_score=risk_score,
            )

        except Exception as exc:
            log.exception("ML inference failed completely: %s", exc)

            return _fallback_result(
                text_content=text_content,
                keystroke_array=events,
                reason=f"ML inference failed. Fallback behavioral rules were used.",
            )


inference_engine = TypeTraceInferenceEngine()