"""Contract tests for the frozen TypeTrace scoring pipeline.

These tests protect the externally visible decision contract introduced by the
deterministic scoring, timing-only model, weighted fusion, and character-based
paste-policy work.

Run from the backend directory:

    python -m unittest tests.test_scoring_contract -v

The tests use deterministic in-memory values. They do not access the database,
load validation sessions, train the model, or modify model artefacts.
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from typing import Any, Dict

from app.ml.inference_engine import (
    HUMAN_SCORE_THRESHOLD,
    SUSPICIOUS_SCORE_THRESHOLD,
    classify_from_human_score,
    fuse_evidence_scores,
)
from app.ml.paste_policy import (
    DOMINANT_PASTE_RATIO_THRESHOLD,
    LIGHT_PASTE_RATIO_THRESHOLD,
    MINIMUM_KEYSTROKES,
    apply_paste_policy,
    classify_paste_tier,
)


def behavioral_summary(
    *,
    mechanically_uniform: bool = False,
    extreme_speed: float = 0.0,
    minimal_revision: float = 0.0,
    minimal_pauses: float = 0.0,
) -> Dict[str, Any]:
    """Return the minimum production-compatible behavioral summary."""

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
    """Return a production-compatible pre-paste inference result."""

    return SimpleNamespace(
        advanced_stats={
            "decision_source": decision_source,
            "risk_signals": [],
            "human_signals": ["No paste event was detected."],
            "decision_notes": [],
            "score_diagnostics": {
                "combination_policy": (
                    "weighted_fusion_with_corroboration_guards"
                ),
            },
        },
        decision_source=decision_source,
        kill_switch_triggered=False,
        kill_switch_reason=None,
    )


class ScoringContractTests(unittest.TestCase):
    """Protect score boundaries, fusion guards, and paste-policy invariants."""

    def test_classification_thresholds_are_exact(self) -> None:
        cases = (
            (100.0, "HUMAN", "LOW"),
            (HUMAN_SCORE_THRESHOLD, "HUMAN", "LOW"),
            (HUMAN_SCORE_THRESHOLD - 0.01, "SUSPICIOUS", "MEDIUM"),
            (SUSPICIOUS_SCORE_THRESHOLD, "SUSPICIOUS", "MEDIUM"),
            (SUSPICIOUS_SCORE_THRESHOLD - 0.01, "SYNTHETIC", "HIGH"),
            (0.0, "SYNTHETIC", "HIGH"),
        )

        for score, classification, risk_level in cases:
            with self.subTest(score=score):
                self.assertEqual(
                    classify_from_human_score(score),
                    {
                        "classification": classification,
                        "risk_level": risk_level,
                    },
                )

    def test_fusion_uses_the_frozen_65_35_weights(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=90.0,
            rules_human_score=80.0,
            behavioral_summary=behavioral_summary(),
        )

        self.assertEqual(result["model_weight"], 0.65)
        self.assertEqual(result["behavioral_weight"], 0.35)
        self.assertEqual(result["weighted_human_score"], 86.5)
        self.assertEqual(result["final_human_score"], 86.5)
        self.assertEqual(result["classification"], "HUMAN")
        self.assertEqual(result["risk_level"], "LOW")
        self.assertEqual(
            round(
                result["final_human_score"] + result["final_risk_score"],
                2,
            ),
            100.0,
        )

    def test_human_requires_both_evidence_layers(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=85.0,
            rules_human_score=79.0,
            behavioral_summary=behavioral_summary(),
        )

        self.assertTrue(result["human_band_guard_applied"])
        self.assertEqual(result["final_human_score"], 79.99)
        self.assertEqual(result["classification"], "SUSPICIOUS")
        self.assertEqual(result["risk_level"], "MEDIUM")

    def test_uncorroborated_low_model_score_is_review_not_high_risk(self) -> None:
        result = fuse_evidence_scores(
            model_human_score=5.0,
            rules_human_score=95.0,
            behavioral_summary=behavioral_summary(),
        )

        self.assertFalse(result["high_risk_corroborated"])
        self.assertTrue(result["needs_review_floor_applied"])
        self.assertEqual(
            result["final_human_score"],
            SUSPICIOUS_SCORE_THRESHOLD,
        )
        self.assertEqual(result["classification"], "SUSPICIOUS")

    def test_primary_signal_without_supporting_signal_is_not_high_risk(
        self,
    ) -> None:
        result = fuse_evidence_scores(
            model_human_score=20.0,
            rules_human_score=60.0,
            behavioral_summary=behavioral_summary(
                mechanically_uniform=True,
            ),
        )

        self.assertFalse(result["high_risk_corroborated"])
        self.assertEqual(result["classification"], "SUSPICIOUS")

    def test_supporting_signals_without_primary_signal_are_not_high_risk(
        self,
    ) -> None:
        result = fuse_evidence_scores(
            model_human_score=20.0,
            rules_human_score=60.0,
            behavioral_summary=behavioral_summary(
                minimal_revision=10.0,
                minimal_pauses=10.0,
            ),
        )

        self.assertFalse(result["high_risk_corroborated"])
        self.assertEqual(result["classification"], "SUSPICIOUS")

    def test_primary_and_supporting_signals_can_corroborate_high_risk(
        self,
    ) -> None:
        result = fuse_evidence_scores(
            model_human_score=20.0,
            rules_human_score=60.0,
            behavioral_summary=behavioral_summary(
                mechanically_uniform=True,
                minimal_revision=10.0,
            ),
        )

        self.assertTrue(result["high_risk_corroborated"])
        self.assertEqual(result["classification"], "SYNTHETIC")
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertLess(
            result["final_human_score"],
            SUSPICIOUS_SCORE_THRESHOLD,
        )

    def test_paste_tier_boundaries_are_exact(self) -> None:
        cases = (
            (
                "NONE",
                {
                    "paste_count": 0,
                    "pasted_length": 0,
                    "text_length": 100,
                    "keydown_count": 100,
                },
            ),
            (
                "UNQUANTIFIED",
                {
                    "paste_count": 1,
                    "pasted_length": 0,
                    "text_length": 100,
                    "keydown_count": 100,
                },
            ),
            (
                "LIMITED_TYPED_EVIDENCE",
                {
                    "paste_count": 1,
                    "pasted_length": 19,
                    "text_length": 100,
                    "keydown_count": MINIMUM_KEYSTROKES - 1,
                },
            ),
            (
                "LIGHT",
                {
                    "paste_count": 1,
                    "pasted_length": 19,
                    "text_length": 100,
                    "keydown_count": MINIMUM_KEYSTROKES,
                },
            ),
            (
                "MODERATE",
                {
                    "paste_count": 1,
                    "pasted_length": int(
                        LIGHT_PASTE_RATIO_THRESHOLD * 100
                    ),
                    "text_length": 100,
                    "keydown_count": 100,
                },
            ),
            (
                "DOMINANT",
                {
                    "paste_count": 1,
                    "pasted_length": int(
                        DOMINANT_PASTE_RATIO_THRESHOLD * 100
                    ),
                    "text_length": 100,
                    "keydown_count": 100,
                },
            ),
        )

        for expected, arguments in cases:
            with self.subTest(expected=expected):
                self.assertEqual(
                    classify_paste_tier(**arguments),
                    expected,
                )

    def test_moderate_paste_keeps_all_final_fields_synchronised(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 200,
                "keydown_count": 120,
            },
            text_content="x" * 1000,
            classification="HUMAN",
            confidence_score=93.0,
            risk_score=7.0,
            risk_level="LOW",
        )

        diagnostics = result["advanced_stats"]["score_diagnostics"]
        final_decision = diagnostics["final_decision"]

        self.assertEqual(result["classification"], "SUSPICIOUS")
        self.assertEqual(result["risk_level"], "MEDIUM")
        self.assertEqual(result["confidence_score"], 79.99)
        self.assertEqual(result["risk_score"], 20.01)
        self.assertEqual(
            result["advanced_stats"]["human_score"],
            result["confidence_score"],
        )
        self.assertEqual(
            result["advanced_stats"]["classification"],
            result["classification"],
        )
        self.assertEqual(
            result["advanced_stats"]["risk_level"],
            result["risk_level"],
        )
        self.assertEqual(
            final_decision["human_score"],
            result["confidence_score"],
        )
        self.assertEqual(
            final_decision["risk_score"],
            result["risk_score"],
        )
        self.assertEqual(
            final_decision["classification"],
            result["classification"],
        )
        self.assertTrue(
            result["advanced_stats"]["paste_override_applied"],
        )

    def test_dominant_paste_is_high_risk_and_sets_kill_switch(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 600,
                "keydown_count": 120,
            },
            text_content="x" * 1000,
            classification="HUMAN",
            confidence_score=95.0,
            risk_score=5.0,
            risk_level="LOW",
        )

        self.assertEqual(result["classification"], "SYNTHETIC")
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["confidence_score"], 20.0)
        self.assertEqual(result["risk_score"], 80.0)
        self.assertTrue(result["kill_switch_triggered"])
        self.assertEqual(
            result["advanced_stats"]["paste_tier"],
            "DOMINANT",
        )
        self.assertIn(
            "Paste-dominant",
            str(result["kill_switch_reason"]),
        )

    def test_light_paste_cannot_make_existing_high_risk_safer(self) -> None:
        result = apply_paste_policy(
            result=inference_result(),
            event_counts={
                "paste_count": 1,
                "pasted_length": 50,
                "keydown_count": 120,
            },
            text_content="x" * 1000,
            classification="SYNTHETIC",
            confidence_score=35.0,
            risk_score=65.0,
            risk_level="HIGH",
        )

        self.assertEqual(result["classification"], "SYNTHETIC")
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["confidence_score"], 35.0)
        self.assertEqual(result["risk_score"], 65.0)
        self.assertFalse(
            result["advanced_stats"]["paste_override_applied"],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
