"""High-yield coverage for model loading, scoring, fallback, and live inference."""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np

from app.ml import inference_engine as inference
from app.ml.feature_schema import (
    FEATURE_SCHEMA_VERSION,
    MODEL_FEATURE_COLUMNS,
    MODEL_FEATURE_FAMILY,
    MODEL_NAME,
    MODEL_VERSION,
)


def score_profile() -> dict[str, float | str]:
    return {
        "model_version": MODEL_VERSION,
        "decision_threshold": 0.20,
        "train_score_min": -0.50,
        "train_score_p01": -0.10,
        "train_score_p05": 0.20,
        "train_score_p95": 0.80,
        "accuracy": 0.91,
        "balanced_accuracy": 0.89,
        "roc_auc": 0.94,
        "false_positive_rate_human_flagged": 0.05,
        "false_negative_rate_synthetic_accepted": 0.08,
        "synthetic_detection_rate": 0.92,
    }


def behavioral_summary(*, risk_score: float = 20.0) -> dict[str, object]:
    return {
        "risk_score": risk_score,
        "risk_signals": ["existing risk"],
        "human_signals": ["existing human"],
        "mechanically_uniform_rhythm": False,
        "risk_contributions": {
            "mechanically_uniform_rhythm": 0,
            "extreme_typing_speed": 0,
            "minimal_revision": 0,
            "minimal_thinking_pauses": 0,
        },
    }


def engine_with_loaded_artifacts(
    *, decision_score: float = 0.50, raw_score: float = -0.25
) -> inference.TypeTraceInferenceEngine:
    scaler = MagicMock()
    scaler.transform.side_effect = lambda frame: frame.to_numpy(dtype=float)
    scaler.n_features_in_ = len(MODEL_FEATURE_COLUMNS)
    scaler.feature_names_in_ = np.asarray(MODEL_FEATURE_COLUMNS)

    model = MagicMock()
    model.decision_function.return_value = np.asarray([decision_score])
    model.score_samples.return_value = np.asarray([raw_score])
    model.n_features_in_ = len(MODEL_FEATURE_COLUMNS)

    artifacts = inference.ModelArtifacts()
    artifacts.model = model
    artifacts.scaler = scaler
    artifacts.feature_columns = list(MODEL_FEATURE_COLUMNS)
    artifacts.metrics = score_profile()
    artifacts.model_card = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
    }
    artifacts.metadata = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
    }
    artifacts.load_error = None

    engine = inference.TypeTraceInferenceEngine.__new__(inference.TypeTraceInferenceEngine)
    engine.artifacts = artifacts
    return engine


class InferenceUtilityCoverageTests(unittest.TestCase):
    def test_safe_float_clamp_and_degenerate_linear_map(self) -> None:
        self.assertEqual(inference._safe_float(float("nan"), 7.0), 7.0)
        self.assertEqual(inference._safe_float(float("inf"), 8.0), 8.0)
        self.assertEqual(inference._safe_float("bad", 9.0), 9.0)
        self.assertEqual(inference._clamp(-5), 0.0)
        self.assertEqual(inference._clamp(250), 100.0)
        self.assertEqual(inference._linear_map(5, 2, 2, 10, 20), 20)
        self.assertEqual(inference._linear_map(1, 2, 2, 10, 20), 10)

    def test_sha256_file_hashes_full_file(self) -> None:
        payload = b"TypeTrace artifact coverage" * 100
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "artifact.bin"
            path.write_bytes(payload)
            self.assertEqual(
                inference._sha256_file(path),
                hashlib.sha256(payload).hexdigest(),
            )

    def test_corroboration_accepts_primary_and_supporting_signals(self) -> None:
        result = inference._active_behavioral_corroboration(
            {
                "mechanically_uniform_rhythm": True,
                "risk_contributions": {
                    "mechanically_uniform_rhythm": 24,
                    "extreme_typing_speed": 12,
                    "minimal_revision": 10,
                    "minimal_thinking_pauses": 10,
                },
            }
        )
        self.assertEqual(result["primary_signal_count"], 2)
        self.assertEqual(result["supporting_signal_count"], 2)
        self.assertIn("extreme_typing_speed", result["active_signals"])

    def test_score_diagnostics_handles_absent_and_present_model_values(self) -> None:
        missing = inference._build_score_diagnostics(
            decision_source="FALLBACK_RULES",
            model_decision_score=None,
            model_decision_threshold=None,
            model_human_score=None,
            rules_risk_score=35,
            rules_human_score=65,
            final_human_score=65,
            final_risk_score=35,
            classification="SUSPICIOUS",
            risk_level="MEDIUM",
            model_feature_count=43,
        )
        self.assertIsNone(missing["model_inside_baseline"])
        self.assertEqual(missing["combination_policy"], "behavioral_rules_only")

        present = inference._build_score_diagnostics(
            decision_source="MODEL_FUSION",
            model_decision_score=0.3,
            model_decision_threshold=0.2,
            model_human_score=85,
            rules_risk_score=10,
            rules_human_score=90,
            final_human_score=88,
            final_risk_score=12,
            classification="HUMAN",
            risk_level="LOW",
            model_feature_count=43,
            fusion_diagnostics={"policy": "weighted", "weighted_human_score": 88},
        )
        self.assertTrue(present["model_inside_baseline"])
        self.assertEqual(present["combination_policy"], "weighted")


class ModelArtifactValidationCoverageTests(unittest.TestCase):
    def test_load_json_rejects_missing_and_non_object_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing.json"
            with self.assertRaises(FileNotFoundError):
                inference.ModelArtifacts._load_json(missing)

            invalid = Path(directory) / "list.json"
            invalid.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must contain an object"):
                inference.ModelArtifacts._load_json(invalid)

    def test_score_profile_rejects_missing_nonfinite_unordered_and_wrong_threshold(self) -> None:
        with self.assertRaisesRegex(ValueError, "missing score-profile"):
            inference.ModelArtifacts._validate_score_profile({})

        profile = score_profile()
        profile["train_score_p01"] = math.nan
        with self.assertRaisesRegex(ValueError, "non-finite"):
            inference.ModelArtifacts._validate_score_profile(profile)

        profile = score_profile()
        profile["train_score_p01"] = 0.4
        with self.assertRaisesRegex(ValueError, "not monotonically ordered"):
            inference.ModelArtifacts._validate_score_profile(profile)

        profile = score_profile()
        profile["decision_threshold"] = 0.25
        with self.assertRaisesRegex(ValueError, "does not match"):
            inference.ModelArtifacts._validate_score_profile(profile)

    def test_manifest_rejects_version_family_and_file_record_errors(self) -> None:
        with self.assertRaisesRegex(ValueError, "manifest version"):
            inference.ModelArtifacts._validate_manifest({})
        with self.assertRaisesRegex(ValueError, "model version"):
            inference.ModelArtifacts._validate_manifest(
                {"manifest_version": 1, "model_version": "wrong"}
            )
        with self.assertRaisesRegex(ValueError, "feature family"):
            inference.ModelArtifacts._validate_manifest(
                {
                    "manifest_version": 1,
                    "model_version": MODEL_VERSION,
                    "feature_family": "wrong",
                }
            )
        with self.assertRaisesRegex(ValueError, "file records"):
            inference.ModelArtifacts._validate_manifest(
                {
                    "manifest_version": 1,
                    "model_version": MODEL_VERSION,
                    "feature_family": MODEL_FEATURE_FAMILY,
                }
            )

    def test_manifest_validates_missing_path_bad_hash_and_integrity(self) -> None:
        manifest = {
            "manifest_version": 1,
            "model_version": MODEL_VERSION,
            "feature_family": MODEL_FEATURE_FAMILY,
            "files": {},
        }
        first_name, _ = next(iter(inference.PRIMARY_ARTIFACT_PATHS.items()))

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / first_name
            missing_path = Path(directory) / f"missing-{first_name}"

            manifest["files"][first_name] = {"sha256": "a" * 64}
            with patch.dict(
                inference.PRIMARY_ARTIFACT_PATHS,
                {first_name: missing_path},
                clear=True,
            ):
                with self.assertRaises(FileNotFoundError):
                    inference.ModelArtifacts._validate_manifest(manifest)

            path.write_bytes(b"artifact")
            with patch.dict(
                inference.PRIMARY_ARTIFACT_PATHS,
                {first_name: path},
                clear=True,
            ):
                manifest["files"][first_name] = {"sha256": "short"}
                with self.assertRaisesRegex(ValueError, "invalid SHA-256"):
                    inference.ModelArtifacts._validate_manifest(manifest)

                manifest["files"][first_name] = {"sha256": "0" * 64}
                with patch.object(
                    inference,
                    "_sha256_file",
                    return_value="1" * 64,
                ) as hash_file:
                    with self.assertRaisesRegex(ValueError, "integrity check failed"):
                        inference.ModelArtifacts._validate_manifest(manifest)
                    hash_file.assert_called_once_with(path)

                manifest["files"][first_name] = {"sha256": "2" * 64}
                with patch.object(
                    inference,
                    "_sha256_file",
                    return_value="2" * 64,
                ) as hash_file:
                    inference.ModelArtifacts._validate_manifest(manifest)
                    hash_file.assert_called_once_with(path)

    def test_failed_load_enters_explicit_degraded_state(self) -> None:
        artifacts = inference.ModelArtifacts()
        fake_manifest_path = MagicMock()
        fake_manifest_path.exists.return_value = False
        fake_manifest_path.__str__ = MagicMock(return_value="artifact_manifest.json")
        with patch.object(inference, "ARTIFACT_MANIFEST_PATH", fake_manifest_path):
            artifacts.load()
        self.assertFalse(artifacts.is_loaded)
        self.assertIn("Missing", artifacts.load_error or "")
        self.assertEqual(artifacts.metadata["model_version"], "fallback-rules")
        self.assertTrue(artifacts.status()["fallback_available"])

    def test_load_rejects_incompatible_schema_metrics_and_feature_counts(self) -> None:
        artifacts = inference.ModelArtifacts()
        manifest = {
            "manifest_version": 1,
            "model_version": MODEL_VERSION,
            "feature_family": MODEL_FEATURE_FAMILY,
            "files": {},
        }
        schema = {
            "schema_version": FEATURE_SCHEMA_VERSION,
            "model_version": MODEL_VERSION,
            "feature_family": MODEL_FEATURE_FAMILY,
            "feature_columns": MODEL_FEATURE_COLUMNS,
        }
        card = {"model_version": MODEL_VERSION, "model_name": MODEL_NAME}
        profile = score_profile()

        def run_with(*, schema_patch=None, metrics_patch=None, card_patch=None, scaler_count=None, model_count=None, scaler_names=None):
            local_schema = {**schema, **(schema_patch or {})}
            local_metrics = {**profile, **(metrics_patch or {})}
            local_card = {**card, **(card_patch or {})}
            scaler = SimpleNamespace(
                n_features_in_=len(MODEL_FEATURE_COLUMNS) if scaler_count is None else scaler_count,
                feature_names_in_=MODEL_FEATURE_COLUMNS if scaler_names is None else scaler_names,
            )
            model = SimpleNamespace(
                n_features_in_=len(MODEL_FEATURE_COLUMNS) if model_count is None else model_count,
            )
            with (
                patch.object(inference, "ARTIFACT_MANIFEST_PATH", SimpleNamespace(exists=lambda: True)),
                patch.object(inference.ModelArtifacts, "_load_json", side_effect=[manifest, local_schema, local_metrics, local_card]),
                patch.object(inference.ModelArtifacts, "_validate_manifest"),
                patch.object(inference.joblib, "load", side_effect=[model, scaler]),
            ):
                candidate = inference.ModelArtifacts()
                candidate.load()
                return candidate

        self.assertIn("schema version", (run_with(schema_patch={"schema_version": -1}).load_error or ""))
        self.assertIn("different model version", (run_with(schema_patch={"model_version": "wrong"}).load_error or ""))
        self.assertIn("timing-only family", (run_with(schema_patch={"feature_family": "wrong"}).load_error or ""))
        self.assertIn("Metrics belong", (run_with(metrics_patch={"model_version": "wrong"}).load_error or ""))
        self.assertIn("Model card", (run_with(card_patch={"model_version": "wrong"}).load_error or ""))
        self.assertIn("Scaler feature count", (run_with(scaler_count=1).load_error or ""))
        self.assertIn("Model feature count", (run_with(model_count=1).load_error or ""))
        self.assertIn("feature order", (run_with(scaler_names=list(reversed(MODEL_FEATURE_COLUMNS))).load_error or ""))
        loaded = run_with()
        self.assertTrue(loaded.is_loaded)
        self.assertIsNone(loaded.load_error)
        self.assertEqual(loaded.metadata["feature_count"], len(MODEL_FEATURE_COLUMNS))


class RuntimeInferenceCoverageTests(unittest.TestCase):
    def test_reload_and_status_cover_ready_and_degraded_states(self) -> None:
        engine = inference.TypeTraceInferenceEngine.__new__(inference.TypeTraceInferenceEngine)
        artifacts = MagicMock()
        artifacts.is_loaded = True
        artifacts.status.return_value = {"model_available": True}
        engine.artifacts = artifacts
        self.assertEqual(engine.reload()["status"], "ready")
        self.assertEqual(engine.get_status()["status"], "ready")

        artifacts.is_loaded = False
        self.assertEqual(engine.reload()["status"], "degraded")
        self.assertEqual(engine.get_status()["status"], "degraded")

    def test_model_human_score_covers_all_mapping_bands(self) -> None:
        engine = engine_with_loaded_artifacts()
        self.assertEqual(engine._decision_threshold(), 0.2)
        self.assertGreaterEqual(engine._model_human_score(0.8), 99.9)
        self.assertGreaterEqual(engine._model_human_score(0.2), 80.0)
        mid = engine._model_human_score(0.05)
        self.assertGreaterEqual(mid, 50.0)
        self.assertLess(mid, 80.0)
        self.assertLess(engine._model_human_score(-0.4), 50.0)

    def _analyze(self, decision_score: float, *, risk_score: float = 20.0):
        engine = engine_with_loaded_artifacts(decision_score=decision_score)
        features = {column: float(index + 1) for index, column in enumerate(MODEL_FEATURE_COLUMNS)}
        with (
            patch.object(inference, "extract_typetrace_event_features", return_value=features),
            patch.object(inference, "compute_behavioral_summary", return_value=behavioral_summary(risk_score=risk_score)),
            patch.object(inference, "build_feature_explanations", return_value={"ft_mean": "explanation"}),
        ):
            result = engine.analyze(events=[{"type": "keydown"}, "ignored"], stats=SimpleNamespace(), text_content="Essay")
        return engine, result

    def test_live_inference_human_path_returns_model_fusion_metadata(self) -> None:
        engine, result = self._analyze(0.50, risk_score=10)
        self.assertEqual(result.decision_source, "MODEL_FUSION")
        self.assertTrue(result.advanced_stats["model_available"])
        self.assertFalse(result.advanced_stats["degraded_analysis"])
        self.assertTrue(
            any(
                "inside the learned human timing baseline" in value
                for value in result.advanced_stats["human_signals"]
            )
        )
        engine.artifacts.scaler.transform.assert_called_once()
        engine.artifacts.model.decision_function.assert_called_once()
        engine.artifacts.model.score_samples.assert_called_once()

    def test_live_inference_borderline_and_strong_anomaly_signals(self) -> None:
        _, borderline = self._analyze(0.05, risk_score=20)
        self.assertTrue(any("borderline" in value for value in borderline.advanced_stats["risk_signals"]))
        _, strong = self._analyze(-0.30, risk_score=20)
        self.assertTrue(any("strongly" in value for value in strong.advanced_stats["risk_signals"]))
        self.assertTrue(strong.advanced_stats["fusion_guards"]["needs_review_floor_applied"])

    def test_live_inference_emits_human_guard_note_on_layer_disagreement(self) -> None:
        _, result = self._analyze(0.50, risk_score=30)
        self.assertEqual(result.classification, "SUSPICIOUS")
        self.assertTrue(result.advanced_stats["fusion_guards"]["human_band_guard_applied"])
        self.assertTrue(any("Human classification was withheld" in note for note in result.advanced_stats["decision_notes"]))

    def test_live_inference_emits_high_risk_note_when_corroborated(self) -> None:
        engine = engine_with_loaded_artifacts(decision_score=-0.35)
        summary = behavioral_summary(risk_score=55)
        summary["mechanically_uniform_rhythm"] = True
        summary["risk_contributions"] = {
            "mechanically_uniform_rhythm": 24,
            "extreme_typing_speed": 0,
            "minimal_revision": 10,
            "minimal_thinking_pauses": 0,
        }
        features = {column: 1.0 for column in MODEL_FEATURE_COLUMNS}
        with (
            patch.object(inference, "extract_typetrace_event_features", return_value=features),
            patch.object(inference, "compute_behavioral_summary", return_value=summary),
            patch.object(inference, "build_feature_explanations", return_value={}),
        ):
            result = engine.analyze(events=[], stats=SimpleNamespace(), text_content="text")
        self.assertEqual(result.risk_level, "HIGH")
        self.assertTrue(result.advanced_stats["high_risk_corroborated"])
        self.assertTrue(any("High Risk was permitted" in note for note in result.advanced_stats["decision_notes"]))

    def test_unloaded_engine_uses_fallback_and_limits_behavioral_high_risk(self) -> None:
        engine = inference.TypeTraceInferenceEngine.__new__(inference.TypeTraceInferenceEngine)
        artifacts = inference.ModelArtifacts()
        artifacts.load_error = "artifact unavailable"
        engine.artifacts = artifacts
        features = {column: 0.0 for column in inference.MODEL_FEATURE_COLUMNS}
        summary = behavioral_summary(risk_score=90)
        with (
            patch.object(inference, "extract_typetrace_event_features", return_value=features),
            patch.object(inference, "compute_behavioral_summary", return_value=summary),
            patch.object(inference, "build_feature_explanations", return_value={}),
        ):
            result = engine.analyze(events=[{"type": "keydown"}], stats=SimpleNamespace(), text_content="fallback")
        self.assertTrue(result.kill_switch_triggered)
        self.assertEqual(result.classification, "SUSPICIOUS")
        self.assertEqual(result.human_score, 50.0)
        self.assertTrue(result.advanced_stats["fallback_review_floor_applied"])

    def test_unloaded_engine_preserves_human_behavioral_band(self) -> None:
        engine = inference.TypeTraceInferenceEngine.__new__(inference.TypeTraceInferenceEngine)
        artifacts = inference.ModelArtifacts()
        artifacts.load_error = None
        engine.artifacts = artifacts
        features = {column: 0.0 for column in inference.MODEL_FEATURE_COLUMNS}
        summary = behavioral_summary(risk_score=10)
        with (
            patch.object(inference, "extract_typetrace_event_features", return_value=features),
            patch.object(inference, "compute_behavioral_summary", return_value=summary),
            patch.object(inference, "build_feature_explanations", return_value={}),
        ):
            result = engine.analyze(events=[], stats=SimpleNamespace(), text_content="fallback human")
        self.assertEqual(result.classification, "HUMAN")
        self.assertFalse(result.advanced_stats["fallback_review_floor_applied"])
        self.assertEqual(result.advanced_stats["decision_notes"], [])

    def test_numerical_errors_are_mapped_to_input_error(self) -> None:
        engine = engine_with_loaded_artifacts()
        with patch.object(inference, "extract_typetrace_event_features", side_effect=FloatingPointError("bad numeric")):
            with self.assertRaises(inference.InferenceInputError):
                engine.analyze(events=[], stats=None, text_content="x")

    def test_controlled_failures_are_preserved(self) -> None:
        engine = engine_with_loaded_artifacts()
        controlled = inference.InferenceInputError("controlled")
        with patch.object(inference, "extract_typetrace_event_features", side_effect=controlled):
            with self.assertRaises(inference.InferenceInputError) as caught:
                engine.analyze(events=[], stats=None, text_content="x")
        self.assertIs(caught.exception, controlled)


if __name__ == "__main__":
    unittest.main(verbosity=2)