# backend/app/ml/inference_engine.py

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

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
        return self.model is not None and self.scaler is not None and self.label_encoder is not None

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
            log.error("Failed to load TypeTrace ML artifacts: %s", exc)

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
        self.artifacts.load()
        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        return self.artifacts.status()

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
    ) -> tuple[bool, Optional[str]]:
        net_wpm = float(features.get("net_wpm", getattr(stats, "wpm", 0)) or 0)
        paste_count = int(behavioral_summary.get("paste_count", 0) or 0)
        ft_std = float(features.get("ft_std", behavioral_summary.get("flight_std", 999)) or 999)
        ft_entropy = float(features.get("ft_entropy", behavioral_summary.get("flight_entropy", 999)) or 999)
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

    def _predict_with_model(self, features: Dict[str, Any]) -> tuple[str, float, Dict[str, float]]:
        if not self.artifacts.is_loaded:
            raise RuntimeError(
                "ML model artifacts are not loaded. Run train_model.py and ensure joblib files exist."
            )

        vector = np.array(
            [[float(features.get(column, 0.0) or 0.0) for column in self.artifacts.feature_columns]]
        )

        scaled_vector = self.artifacts.scaler.transform(vector)
        probabilities = self.artifacts.model.predict_proba(scaled_vector)[0]
        predicted_index = int(np.argmax(probabilities))

        raw_label = self.artifacts.label_encoder.inverse_transform([predicted_index])[0]
        classification = self._normalize_label(raw_label)
        confidence = round(float(probabilities[predicted_index]) * 100, 2)

        class_probability_map: Dict[str, float] = {}
        for index, probability in enumerate(probabilities):
            class_label = self._normalize_label(
                self.artifacts.label_encoder.inverse_transform([index])[0]
            )
            class_probability_map[class_label] = round(float(probability) * 100, 2)

        return classification, confidence, class_probability_map

    def _calibrate_decision(
        self,
        *,
        model_classification: str,
        model_confidence: float,
        behavioral_summary: Dict[str, Any],
        class_probabilities: Dict[str, float],
    ) -> tuple[str, float, str]:
        risk_score = float(behavioral_summary.get("risk_score", 0.0) or 0.0)

        if risk_score >= 75 and model_classification == "HUMAN":
            return "SUSPICIOUS", max(model_confidence, risk_score), "model_plus_behavioral_override"

        if risk_score >= 60 and model_confidence < 70:
            return "SUSPICIOUS", max(model_confidence, risk_score), "behavioral_uncertainty"

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
        else:
            model_classification, model_confidence, class_probabilities = self._predict_with_model(features)

            classification, confidence, decision_source = self._calibrate_decision(
                model_classification=model_classification,
                model_confidence=model_confidence,
                behavioral_summary=behavioral_summary,
                class_probabilities=class_probabilities,
            )

        advanced_stats = {
            "ht_mean": round(float(features.get("ht_mean", 0.0) or 0.0), 2),
            "ht_std": round(float(features.get("ht_std", 0.0) or 0.0), 2),
            "ht_cv": round(float(features.get("ht_cv", 0.0) or 0.0), 4),
            "ft_mean": round(float(features.get("ft_mean", 0.0) or 0.0), 2),
            "ft_std": round(float(features.get("ft_std", 0.0) or 0.0), 2),
            "ft_cv": round(float(features.get("ft_cv", 0.0) or 0.0), 4),
            "ft_entropy": round(float(features.get("ft_entropy", 0.0) or 0.0), 4),
            "ft_autocorr": round(float(features.get("ft_autocorr", 0.0) or 0.0), 4),
            "burst_ratio": round(float(features.get("burst_ratio", 0.0) or 0.0), 4),
            "pause_ratio": round(float(features.get("pause_ratio", 0.0) or 0.0), 4),
            "net_wpm": round(float(features.get("net_wpm", 0.0) or 0.0), 2),
            "key_diversity": round(float(features.get("key_diversity", 0.0) or 0.0), 4),
            "total_keys": round(float(features.get("total_keys", 0.0) or 0.0), 0),
            "paste_count": behavioral_summary.get("paste_count", 0),
            "paste_ratio": behavioral_summary.get("paste_ratio", 0),
            "deletion_ratio": behavioral_summary.get("deletion_ratio", 0),
            "longest_pause_ms": behavioral_summary.get("longest_pause_ms", 0),
            "risk_score": behavioral_summary.get("risk_score", 0),
            "risk_level": behavioral_summary.get("risk_level", "LOW"),
            "risk_signals": behavioral_summary.get("risk_signals", []),
            "human_signals": behavioral_summary.get("human_signals", []),
            "class_probabilities": class_probabilities,
            "decision_source": decision_source,
            "feature_explanations": build_feature_explanations(features),
            "model_version": self.artifacts.metadata.get("version", "unknown"),
            "model_accuracy": self.artifacts.metadata.get("accuracy"),
            "model_cv_accuracy": self.artifacts.metadata.get("cv_accuracy"),
            "minimum_keys_required": MINIMUM_KEYS_PER_SESSION,
        }

        return InferenceResult(
            classification=classification,
            confidence_score=round(float(confidence), 2),
            kill_switch_triggered=kill_triggered,
            kill_switch_reason=kill_reason,
            features=features,
            behavioral_summary=behavioral_summary,
            advanced_stats=advanced_stats,
            decision_source=decision_source,
            risk_level=behavioral_summary.get("risk_level", "LOW"),
            risk_score=float(behavioral_summary.get("risk_score", 0.0) or 0.0),
        )


inference_engine = TypeTraceInferenceEngine()