"""Deterministic coverage for timing feature extraction and behavioral rules."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

import numpy as np
import pandas as pd

from app.ml import behavioral_analysis as behavior
from app.ml import feature_extraction as features
from app.ml.feature_schema import ALL_FEATURE_COLUMNS, MODEL_FEATURE_COLUMNS


def stats(**overrides):
    values = {
        "wpm": 45,
        "keystrokes": 60,
        "deletions": 0,
        "pauses": 0,
        "sessionSeconds": 120,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def keydown(index: int, *, flight: float | None = None, dwell: float | None = None):
    return {
        "type": "keydown",
        "key": chr(97 + index % 26),
        "keyCode": 65 + index % 26,
        "timestamp": 1_700_000_000_000 + index * 120,
        "dwell_time": 70 + index % 11 if dwell is None else dwell,
        "flight_time": 100 + (index % 9) * 17 if flight is None else flight,
    }


class FeatureExtractionPrimitiveCoverageTests(unittest.TestCase):
    def test_numeric_and_timing_helpers_reject_invalid_values(self) -> None:
        self.assertEqual(features._safe_float("bad", 4.5), 4.5)
        self.assertEqual(features._safe_float(float("nan"), 3.5), 3.5)
        self.assertEqual(features._safe_int(-5), 0)
        self.assertEqual(features._safe_int("bad", 7), 7)
        self.assertEqual(features._clean_timing_series([10, -1, -2, 1600, "bad"]), [10.0])
        self.assertEqual(features._missing_ratio([]), 0.0)
        self.assertGreater(features._missing_ratio([10, -1, 2000, "bad"]), 0.7)

    def test_entropy_and_series_stats_cover_empty_constant_and_variable_series(self) -> None:
        self.assertEqual(features._entropy([]), 0.0)
        self.assertEqual(features._entropy([20, 20, 20]), 0.0)
        self.assertEqual(features._series_stats("x", [])["x_count"], 0.0)
        result = features._series_stats("x", [10, 20, 30, 40])
        self.assertEqual(result["x_count"], 4.0)
        self.assertGreater(result["x_std"], 0)
        self.assertIn("x_kurtosis", result)

    def test_virtual_key_ratios_cover_empty_alphanumeric_space_and_special(self) -> None:
        self.assertEqual(features._vk_ratios([])["alnum_ratio"], 0.0)
        result = features._vk_ratios([65, 49, 32, 8])
        self.assertEqual(result["alnum_ratio"], 0.5)
        self.assertEqual(result["space_ratio"], 0.25)
        self.assertEqual(result["special_key_ratio"], 0.25)

    def test_flight_sequence_and_correlation_cover_short_constant_and_variable_inputs(self) -> None:
        target = {}
        features._add_flight_sequence_features(target, [10, 20])
        self.assertEqual(target["ft_autocorr"], 0.0)

        target = {}
        features._add_flight_sequence_features(target, [10, 20, 45, 15, 80])
        self.assertGreater(target["ft_diff_mean"], 0)
        self.assertIn("burst_ratio", target)

        corr = {}
        features._add_hold_flight_correlation(corr, [10, 10, 10], [20, 30, 40])
        self.assertEqual(corr["ht_ft_correlation"], 0.0)
        features._add_hold_flight_correlation(corr, [10, 20, 30, 40], [15, 25, 35, 45])
        self.assertGreater(corr["ht_ft_correlation"], 0.9)

    def test_public_csv_feature_extraction_rejects_bad_samples_and_accepts_valid_sample(self) -> None:
        self.assertIsNone(features.extract_public_csv_features(None))
        self.assertIsNone(features.extract_public_csv_features(pd.DataFrame({"VK": [65]})))
        small = pd.DataFrame({"VK": [65] * 5, "HT": [70] * 5, "FT": [100] * 5})
        self.assertIsNone(features.extract_public_csv_features(small))
        missing_flights = pd.DataFrame({"VK": [65] * 20, "HT": [70] * 20, "FT": [-1] * 20})
        self.assertIsNone(features.extract_public_csv_features(missing_flights))

        frame = pd.DataFrame(
            {
                "VK": [65 + (i % 20) for i in range(25)],
                "HT": [60 + i % 8 for i in range(25)],
                "FT": [90 + (i % 7) * 13 for i in range(25)],
            }
        )
        result = features.extract_public_csv_features(frame)
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(set(result), set(ALL_FEATURE_COLUMNS))
        self.assertGreater(result["total_keys_log"], 0)

    def test_event_helpers_cover_browser_code_character_and_invalid_timing(self) -> None:
        self.assertEqual(features._event_vk_code({"keyCode": 65, "key": "z"}), 65)
        self.assertEqual(features._event_vk_code({"keyCode": 0, "key": "z"}), ord("Z"))
        self.assertEqual(features._event_vk_code({"keyCode": 0, "key": "Shift"}), 0)
        self.assertEqual(features._event_timing_or_missing({"flight_time": None}, "flight_time"), -1.0)
        self.assertEqual(features._event_timing_or_missing({"flight_time": 2000}, "flight_time"), -1.0)
        self.assertEqual(features._event_timing_or_missing({"flight_time": 120}, "flight_time"), 120.0)

    def test_live_feature_extraction_covers_sparse_fallback_and_process_signals(self) -> None:
        events = [
            keydown(0, flight=None),
            {"type": "keyup", "key": "a", "chars_deleted": 10},
            {"type": "paste", "key": "__PASTE_EVENT__", "pastedLength": 30},
            {"type": "cut", "key": "__CUT_EVENT__", "chars_deleted": 4, "isBulkDeletion": True},
            {"type": "input", "key": "__TEXT_REVISION__", "deletedCharacters": 3},
            {"type": "input", "key": "__IDLE_BREAK__", "inputType": "historyIdleBreak"},
            "ignored",
        ]
        result = features.extract_typetrace_event_features(
            events=events,
            stats=stats(wpm=80, pauses=2, sessionSeconds=30),
            text_content="one two three four",
        )
        self.assertGreater(result["paste_count_log"], 0)
        self.assertGreater(result["cut_count_log"], 0)
        self.assertGreater(result["delete_actions_log"], 0)
        self.assertGreater(result["idle_break_count_log"], 0)
        self.assertGreater(result["revision_pressure"], 0)

    def test_sanitize_select_and_matrix_enforce_finite_bounded_unique_schema(self) -> None:
        clean = features.sanitize_feature_vector(
            {"a": float("nan"), "b": 999999, "c": -999999},
            ["a", "b", "c"],
        )
        self.assertEqual(clean, {"a": 0.0, "b": 10000.0, "c": -10000.0})
        selected = features.select_feature_vector({"ft_mean": 123}, ["ft_mean"])
        self.assertEqual(selected, {"ft_mean": 123.0})
        with self.assertRaisesRegex(ValueError, "empty schema"):
            features.feature_vector_to_matrix({}, [])
        with self.assertRaisesRegex(ValueError, "duplicate columns"):
            features.feature_vector_to_matrix({"a": 1}, ["a", "a"])
        matrix = features.feature_vector_to_matrix({"a": 1, "b": 2}, ["b", "a"])
        np.testing.assert_allclose(matrix, [[2.0, 1.0]])


class BehavioralRuleCoverageTests(unittest.TestCase):
    def test_entropy_and_paste_length_helpers_cover_invalid_and_text_fallbacks(self) -> None:
        self.assertEqual(behavior._entropy([], bins=0), 0.0)
        self.assertEqual(behavior._entropy([5000], maximum=1500), 0.0)
        self.assertEqual(behavior._event_pasted_length({"pastedLength": 12}), 12)
        self.assertEqual(behavior._event_pasted_length({"insertedCharacters": 7}), 7)
        self.assertEqual(behavior._event_pasted_length({"deltaLength": 4}), 4)
        self.assertEqual(behavior._event_pasted_length({"insertedText": "paste"}), 5)
        self.assertEqual(behavior._event_pasted_length({}), 0)

    def test_revision_metrics_deduplicate_correlated_events_and_detect_methods(self) -> None:
        events = [
            {"type": "keydown", "key": "Backspace", "revision_id": "r1", "chars_deleted": 1, "deletion_method": "unknown"},
            {"type": "input", "key": "__TEXT_REVISION__", "revision_id": "r1", "deletedCharacters": 3, "deletion_method": "word", "selection_length_before": 2},
            {"type": "cut", "key": "__CUT_EVENT__", "revision_id": "r2", "chars_deleted": 5, "deletion_method": "cut", "bulk_deletion": True},
            {"type": "keyup", "key": "Backspace", "chars_deleted": 99},
            "ignored",
        ]
        result = behavior._compute_revision_metrics(events, stats(deletions=10))
        self.assertEqual(result["delete_actions"], 2)
        self.assertEqual(result["deleted_characters"], 8)
        self.assertEqual(result["largest_deletion_chars"], 5)
        self.assertEqual(result["word_deletion_events"], 1)
        self.assertEqual(result["cut_events"], 1)
        self.assertEqual(result["selection_deletion_events"], 1)

    def test_revision_metrics_fall_back_to_legacy_stats_when_no_events_exist(self) -> None:
        result = behavior._compute_revision_metrics([], stats(deletions=3))
        self.assertEqual(result["delete_actions"], 3)
        self.assertEqual(result["deleted_characters"], 3)

    def test_signal_builder_covers_each_risk_and_human_evidence_family(self) -> None:
        signals = behavior._build_signal_list(
            wpm=220,
            paste_count=5,
            pasted_character_ratio=0.7,
            rhythm_flight_std=5,
            rhythm_flight_entropy=0.1,
            deletion_ratio=0,
            deleted_character_ratio=0,
            revision_intensity=0,
            pause_ratio=0,
            dwell_count=5,
            rhythm_flight_count=60,
            thinking_pause_count=0,
        )
        self.assertTrue(any("realistic human range" in value for value in signals["risk_signals"]))
        self.assertTrue(any("most of the final document" in value for value in signals["risk_signals"]))
        self.assertTrue(any("unusually uniform" in value for value in signals["risk_signals"]))
        self.assertTrue(any("little revision" in value for value in signals["risk_signals"]))
        self.assertTrue(any("few thinking pauses" in value for value in signals["risk_signals"]))

        human = behavior._build_signal_list(
            wpm=50,
            paste_count=0,
            pasted_character_ratio=0,
            rhythm_flight_std=60,
            rhythm_flight_entropy=2,
            deletion_ratio=0.05,
            deleted_character_ratio=0.04,
            revision_intensity=0.04,
            pause_ratio=0.04,
            dwell_count=30,
            rhythm_flight_count=40,
            thinking_pause_count=2,
        )
        self.assertGreaterEqual(len(human["human_signals"]), 5)

    def test_signal_builder_covers_substantial_and_multiple_limited_paste_messages(self) -> None:
        substantial = behavior._build_signal_list(
            wpm=50, paste_count=1, pasted_character_ratio=0.3,
            rhythm_flight_std=50, rhythm_flight_entropy=1.5,
            deletion_ratio=.02, deleted_character_ratio=.02, revision_intensity=.02,
            pause_ratio=.03, dwell_count=20, rhythm_flight_count=40, thinking_pause_count=1,
        )
        self.assertTrue(any("substantial portion" in value for value in substantial["risk_signals"]))
        multiple = behavior._build_signal_list(
            wpm=50, paste_count=4, pasted_character_ratio=0.1,
            rhythm_flight_std=50, rhythm_flight_entropy=1.5,
            deletion_ratio=.02, deleted_character_ratio=.02, revision_intensity=.02,
            pause_ratio=.03, dwell_count=20, rhythm_flight_count=40, thinking_pause_count=1,
        )
        self.assertTrue(any("Multiple limited paste" in value for value in multiple["risk_signals"]))

    def test_behavioral_summary_covers_dominant_paste_speed_uniformity_and_missing_dwell(self) -> None:
        events = [keydown(i, flight=100, dwell=0) for i in range(60)]
        events.append({"type": "paste", "key": "__PASTE_EVENT__", "insertedText": "x" * 100})
        summary = behavior.compute_behavioral_summary(
            events=events,
            stats=stats(wpm=200, keystrokes=60, deletions=0, pauses=0, sessionSeconds=20),
            text_content="x" * 120,
            model_features={"ft_mean": 100, "ft_std": 0},
        )
        self.assertEqual(summary["risk_contributions"]["paste_events"], 28.0)
        self.assertGreater(summary["risk_contributions"]["extreme_typing_speed"], 0)
        self.assertEqual(summary["risk_contributions"]["mechanically_uniform_rhythm"], 24.0)
        self.assertEqual(summary["risk_contributions"]["minimal_revision"], 10.0)
        self.assertEqual(summary["risk_contributions"]["minimal_thinking_pauses"], 10.0)
        self.assertEqual(summary["risk_contributions"]["insufficient_dwell_evidence"], 4.0)
        self.assertEqual(summary["risk_level"], "HIGH")

    def test_behavioral_summary_covers_light_and_small_paste_contributions(self) -> None:
        base = [keydown(i) for i in range(40)]
        medium = behavior.compute_behavioral_summary(
            events=base + [{"type": "paste", "insertedText": "x" * 30}],
            stats=stats(keystrokes=40), text_content="x" * 100,
        )
        self.assertEqual(medium["risk_contributions"]["paste_events"], 16.0)
        small = behavior.compute_behavioral_summary(
            events=base + [{"type": "paste", "insertedText": "x" * 5}],
            stats=stats(keystrokes=40), text_content="x" * 100,
        )
        self.assertEqual(small["risk_contributions"]["paste_events"], 2.0)
        limited_many = behavior.compute_behavioral_summary(
            events=base + [
                {"type": "paste", "insertedText": "x" * 10},
                {"type": "paste", "insertedText": "y" * 10},
            ],
            stats=stats(keystrokes=40), text_content="x" * 300,
        )
        self.assertEqual(limited_many["risk_contributions"]["paste_events"], 5.0)

    def test_feature_explanations_are_stable_for_thesis_interpretation(self) -> None:
        explanations = behavior.build_feature_explanations({})
        self.assertEqual(set(explanations), {
            "ht_mean", "ht_std", "ft_mean", "ft_std", "ft_entropy",
            "ft_autocorr", "burst_ratio", "pause_ratio", "net_wpm",
        })
        self.assertIn("thinking pauses", explanations["ft_mean"].lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
