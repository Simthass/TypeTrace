"""Regression checks for the Day 3 score-fusion and paste-policy changes.

Run from the backend directory:

    python -m scripts.day3_score_fusion_regression

The script uses deterministic in-memory inputs. It does not access the database,
train the model, modify artifacts, or create project data.
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from typing import Any, Dict, List

from app.ml.paste_policy import apply_paste_policy
from app.ml.behavioral_analysis import compute_behavioral_summary
from app.ml.inference_engine import (
    HUMAN_SCORE_THRESHOLD,
    SUSPICIOUS_SCORE_THRESHOLD,
    fuse_evidence_scores,
)


def behavioral_summary(
    *,
    mechanically_uniform: bool = False,
    extreme_speed: float = 0.0,
    minimal_revision: float = 0.0,
    minimal_pauses: float = 0.0,
) -> Dict[str, Any]:
    return {
        "mechanically_uniform_rhythm": mechanically_uniform,
        "risk_contributions": {
            "mechanically_uniform_rhythm": (
                24.0 if mechanically_uniform else 0.0
            ),
            "extreme_typing_speed": extreme_speed,
            "minimal_revision": minimal_revision,
            "minimal_thinking_pauses": minimal_pauses,
            "paste_events": 0.0,
            "insufficient_dwell_evidence": 0.0,
        },
    }


def inference_result(
    *,
    decision_source: str = "weighted_timing_behavioral_fusion",
) -> SimpleNamespace:
    return SimpleNamespace(
        advanced_stats={
            "decision_source": decision_source,
            "risk_signals": [],
            "human_signals": ["No paste event was detected."],
            "decision_notes": [],
            "score_diagnostics": {
                "combination_policy": (
                    "weighted_fusion_with_corroboration_guards"
                )
            },
        },
        decision_source=decision_source,
        kill_switch_triggered=False,
        kill_switch_reason=None,
    )


def paste_events(pasted_length: int) -> List[Dict[str, Any]]:
    return [
        {
            "type": "paste",
            "key": "__PASTE_EVENT__",
            "pastedLength": pasted_length,
        }
    ]


class Day3ScoreFusionRegressionTests(unittest.TestCase):
    def test_single_low_model_score_cannot_force_high_risk(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=2.0,
            rules_human_score=94.0,
            behavioral_summary=behavioral_summary(),
        )

        self.assertFalse(result["high_risk_corroborated"])
        self.assertTrue(result["needs_review_floor_applied"])
        self.assertEqual(
            result["final_human_score"],
            SUSPICIOUS_SCORE_THRESHOLD,
        )
        self.assertEqual(result["classification"], "SUSPICIOUS")

    def test_human_requires_both_evidence_layers(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=79.0,
            rules_human_score=100.0,
            behavioral_summary=behavioral_summary(),
        )

        self.assertTrue(result["human_band_guard_applied"])
        self.assertEqual(
            result["final_human_score"],
            HUMAN_SCORE_THRESHOLD - 0.01,
        )
        self.assertEqual(result["classification"], "SUSPICIOUS")

    def test_corroborated_mechanical_anomaly_can_be_high_risk(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=20.0,
            rules_human_score=56.0,
            behavioral_summary=behavioral_summary(
                mechanically_uniform=True,
                minimal_revision=10.0,
                minimal_pauses=10.0,
            ),
        )

        self.assertTrue(result["high_risk_corroborated"])
        self.assertLess(
            result["final_human_score"],
            SUSPICIOUS_SCORE_THRESHOLD,
        )
        self.assertEqual(result["classification"], "SYNTHETIC")

    def test_light_paste_does_not_force_review(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 50,
                "keydown_count": 120,
            },
            text_content="x" * 1000,
            classification="HUMAN",
            confidence_score=92.0,
            risk_score=8.0,
            risk_level="LOW",
        )

        self.assertEqual(result["classification"], "HUMAN")
        self.assertEqual(result["confidence_score"], 92.0)
        self.assertEqual(result["advanced_stats"]["paste_tier"], "LIGHT")
        self.assertFalse(
            result["advanced_stats"]["paste_override_applied"]
        )

    def test_limited_typing_with_small_paste_is_review_not_high_risk(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 10,
                "keydown_count": 20,
            },
            text_content="x" * 200,
            classification="HUMAN",
            confidence_score=91.0,
            risk_score=9.0,
            risk_level="LOW",
        )

        self.assertEqual(result["classification"], "SUSPICIOUS")
        self.assertEqual(
            result["advanced_stats"]["paste_tier"],
            "LIMITED_TYPED_EVIDENCE",
        )
        self.assertFalse(result["kill_switch_triggered"])

    def test_moderate_paste_caps_human_to_needs_review(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 300,
                "keydown_count": 150,
            },
            text_content="x" * 1000,
            classification="HUMAN",
            confidence_score=94.0,
            risk_score=6.0,
            risk_level="LOW",
        )

        self.assertEqual(result["classification"], "SUSPICIOUS")
        self.assertEqual(
            result["confidence_score"],
            HUMAN_SCORE_THRESHOLD - 0.01,
        )
        self.assertEqual(result["advanced_stats"]["paste_tier"], "MODERATE")
        self.assertTrue(result["advanced_stats"]["paste_override_applied"])

    def test_moderate_paste_does_not_hide_existing_high_risk(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 300,
                "keydown_count": 150,
            },
            text_content="x" * 1000,
            classification="SYNTHETIC",
            confidence_score=35.0,
            risk_score=65.0,
            risk_level="HIGH",
        )

        self.assertEqual(result["classification"], "SYNTHETIC")
        self.assertEqual(result["confidence_score"], 35.0)
        self.assertEqual(result["risk_score"], 65.0)

    def test_dominant_paste_is_high_risk(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 800,
                "keydown_count": 90,
            },
            text_content="x" * 1000,
            classification="HUMAN",
            confidence_score=96.0,
            risk_score=4.0,
            risk_level="LOW",
        )

        self.assertEqual(result["classification"], "SYNTHETIC")
        self.assertLess(
            result["confidence_score"],
            SUSPICIOUS_SCORE_THRESHOLD,
        )
        self.assertEqual(result["advanced_stats"]["paste_tier"], "DOMINANT")
        self.assertTrue(result["kill_switch_triggered"])

    def test_paste_ratio_uses_characters_not_event_count(self) -> None:
        events: List[Dict[str, Any]] = []
        for index in range(100):
            events.append(
                {
                    "type": "keydown",
                    "key": "a",
                    "timestamp": float(index * 200),
                    "flight_time": 180.0 + float(index % 7) * 12.0,
                    "dwell_time": 75.0 + float(index % 5) * 4.0,
                }
            )
        events.extend(paste_events(300))

        stats = SimpleNamespace(
            wpm=42.0,
            keystrokes=100,
            deletions=4,
            pauses=2,
            sessionSeconds=300.0,
        )
        summary = compute_behavioral_summary(
            events=events,
            stats=stats,
            text_content="x" * 1000,
        )

        self.assertEqual(summary["paste_count"], 1)
        self.assertEqual(summary["pasted_length"], 300)
        self.assertEqual(summary["pasted_character_ratio"], 0.3)
        self.assertEqual(summary["paste_ratio"], 0.3)
        self.assertEqual(summary["paste_event_ratio"], 0.01)


if __name__ == "__main__":
    unittest.main(verbosity=2)