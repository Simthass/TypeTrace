import unittest

from fastapi import HTTPException

from app.api.routes.sessions import (
    _certificate_status_for,
    _clamp_score,
    _normalize_result_label,
    _normalize_risk_level,
    _validate_event_stream,
)
from app.ml.paste_policy import MINIMUM_KEYSTROKES


class SessionValidationBoundaryTests(unittest.TestCase):
    def test_score_clamping_handles_bounds_nan_infinity_and_bad_input(self):
        self.assertEqual(_clamp_score(-10), 0.0)
        self.assertEqual(_clamp_score(42.126), 42.13)
        self.assertEqual(_clamp_score(120), 100.0)
        self.assertEqual(_clamp_score(float("nan")), 0.0)
        self.assertEqual(_clamp_score(float("inf")), 0.0)
        self.assertEqual(_clamp_score("bad"), 0.0)

    def test_result_aliases_normalize_to_the_three_review_labels(self):
        self.assertEqual(_normalize_result_label("real"), "HUMAN")
        self.assertEqual(_normalize_result_label("normal"), "HUMAN")
        self.assertEqual(_normalize_result_label("AI-generated"), "SYNTHETIC")
        self.assertEqual(_normalize_result_label("ambiguous"), "SUSPICIOUS")
        self.assertEqual(_normalize_result_label("unexpected"), "UNKNOWN")

    def test_risk_level_uses_explicit_value_or_score_boundaries(self):
        self.assertEqual(_normalize_risk_level("low", 99), "LOW")
        self.assertEqual(_normalize_risk_level("", 19.99), "LOW")
        self.assertEqual(_normalize_risk_level(None, 20), "MEDIUM")
        self.assertEqual(_normalize_risk_level("invalid", 49.99), "MEDIUM")
        self.assertEqual(_normalize_risk_level("invalid", 50), "HIGH")

    def test_exact_typing_threshold_is_accepted(self):
        _validate_event_stream(
            event_counts={
                "event_count": MINIMUM_KEYSTROKES,
                "keydown_count": MINIMUM_KEYSTROKES,
                "paste_count": 0,
            },
            text_content="Evidence",
        )

    def test_paste_evidence_requires_nonblank_final_text(self):
        with self.assertRaises(HTTPException) as raised:
            _validate_event_stream(
                event_counts={
                    "event_count": 1,
                    "keydown_count": 0,
                    "paste_count": 1,
                },
                text_content="   ",
            )
        self.assertEqual(raised.exception.status_code, 422)

    def test_certificate_status_fails_closed_for_nonhuman_or_elevated_risk(self):
        self.assertEqual(_certificate_status_for("HUMAN", "LOW"), "VALID")
        self.assertEqual(
            _certificate_status_for("SUSPICIOUS", "LOW"),
            "REVIEW_REQUIRED",
        )
        self.assertEqual(
            _certificate_status_for("HUMAN", "MEDIUM"),
            "REVIEW_REQUIRED",
        )
        self.assertEqual(_certificate_status_for("SYNTHETIC", "HIGH"), "HIGH_RISK")
        self.assertEqual(_certificate_status_for("UNKNOWN", "LOW"), "HIGH_RISK")


if __name__ == "__main__":
    unittest.main(verbosity=2)
