"""Regression checks for the Day 2 timing-only model architecture.

Run from the backend directory:

    python -m scripts.day2_model_architecture_regression

The script does not train a model and does not modify project data.
"""

from __future__ import annotations

import unittest
from copy import deepcopy
from types import SimpleNamespace
from typing import Dict, List

import numpy as np

from app.ml.feature_extraction import (
    extract_typetrace_event_features,
    feature_vector_to_matrix,
)
from app.ml.feature_schema import (
    ALL_FEATURE_COLUMNS,
    MODEL_FEATURE_COLUMNS,
    TYPETRACE_LIVE_FEATURE_COLUMNS,
    validate_model_feature_columns,
)
from app.ml.inference_engine import (
    HUMAN_SCORE_THRESHOLD,
    SUSPICIOUS_SCORE_THRESHOLD,
    TypeTraceInferenceEngine,
    classify_from_human_score,
)


def build_events(count: int = 60) -> List[Dict[str, object]]:
    events: List[Dict[str, object]] = []
    timestamp = 0.0

    for index in range(count):
        flight = 90.0 + float((index * 37) % 420)
        timestamp += flight
        event: Dict[str, object] = {
            "type": "keydown",
            "key": chr(97 + index % 26),
            "keyCode": 65 + index % 26,
            "timestamp": timestamp,
            "flight_time": flight,
        }
        if index % 7 != 0:
            event["dwell_time"] = 55.0 + float((index * 11) % 95)
        events.append(event)

    return events


class Day2ModelArchitectureRegressionTests(unittest.TestCase):
    def test_model_schema_contains_only_public_timing_features(self) -> None:
        self.assertTrue(MODEL_FEATURE_COLUMNS)
        self.assertFalse(
            set(MODEL_FEATURE_COLUMNS).intersection(
                TYPETRACE_LIVE_FEATURE_COLUMNS
            )
        )
        self.assertEqual(
            validate_model_feature_columns(MODEL_FEATURE_COLUMNS),
            MODEL_FEATURE_COLUMNS,
        )

    def test_incompatible_v1_schema_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_model_feature_columns(ALL_FEATURE_COLUMNS)

    def test_live_process_features_cannot_change_model_matrix(self) -> None:
        baseline = {
            column: float(index + 1)
            for index, column in enumerate(MODEL_FEATURE_COLUMNS)
        }
        changed = deepcopy(baseline)
        for index, column in enumerate(TYPETRACE_LIVE_FEATURE_COLUMNS):
            changed[column] = 9000.0 + index

        baseline_matrix = feature_vector_to_matrix(
            baseline,
            MODEL_FEATURE_COLUMNS,
        )
        changed_matrix = feature_vector_to_matrix(
            changed,
            MODEL_FEATURE_COLUMNS,
        )

        self.assertEqual(
            baseline_matrix.shape,
            (1, len(MODEL_FEATURE_COLUMNS)),
        )
        np.testing.assert_array_equal(baseline_matrix, changed_matrix)

    def test_typetrace_timing_rows_remain_aligned_when_dwell_is_missing(self) -> None:
        events = build_events(60)
        stats = SimpleNamespace(
            wpm=38.0,
            sessionSeconds=240.0,
            pauses=3,
            deletions=2,
        )
        features = extract_typetrace_event_features(
            events=events,
            stats=stats,
            text_content="human writing sample " * 25,
        )

        self.assertEqual(features["ft_count"], 60.0)
        self.assertGreater(features["missing_ht_ratio"], 0.0)
        self.assertLess(features["missing_ht_ratio"], 1.0)
        self.assertEqual(
            feature_vector_to_matrix(features).shape,
            (1, len(MODEL_FEATURE_COLUMNS)),
        )

    def test_score_mapping_has_no_high_risk_cliff_below_p05(self) -> None:
        engine = object.__new__(TypeTraceInferenceEngine)
        engine.artifacts = SimpleNamespace(
            metrics={
                "train_score_min": -0.20,
                "train_score_p01": -0.10,
                "train_score_p05": 0.00,
                "train_score_p95": 0.20,
                "decision_threshold": 0.00,
            }
        )

        self.assertEqual(engine._model_human_score(-0.20), 0.0)
        self.assertEqual(
            engine._model_human_score(-0.10),
            SUSPICIOUS_SCORE_THRESHOLD,
        )
        self.assertEqual(
            engine._model_human_score(0.00),
            HUMAN_SCORE_THRESHOLD,
        )
        self.assertEqual(engine._model_human_score(0.20), 100.0)

        just_below_threshold = engine._model_human_score(-0.000001)
        self.assertGreaterEqual(just_below_threshold, 79.98)
        self.assertLess(just_below_threshold, HUMAN_SCORE_THRESHOLD)
        self.assertEqual(
            classify_from_human_score(just_below_threshold),
            {"classification": "SUSPICIOUS", "risk_level": "MEDIUM"},
        )

        just_below_p01 = engine._model_human_score(-0.100001)
        self.assertLess(just_below_p01, SUSPICIOUS_SCORE_THRESHOLD)
        self.assertEqual(
            classify_from_human_score(just_below_p01),
            {"classification": "SYNTHETIC", "risk_level": "HIGH"},
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)