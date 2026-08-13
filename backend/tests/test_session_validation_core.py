import unittest

from fastapi import HTTPException

from app.api.routes.sessions import (
    _clamp_score,
    _normalize_result_label,
    _normalize_risk_level,
    _stats_from_dict,
    _validate_event_stream,
)
from app.ml.paste_policy import MINIMUM_KEYSTROKES


class SessionValidationCoreTests(unittest.TestCase):
    def test_stats_from_dict_uses_canonical_server_defaults(self):
        stats = _stats_from_dict(
            {
                "wpm": 42.5,
                "keystrokes": 31,
                "deletions": 2,
                "deletedCharacters": 4,
                "bulkDeletionEvents": 1,
                "largestDeletionChars": 3,
                "selectionDeletionEvents": 1,
                "wordDeletionEvents": 0,
                "cutEvents": 1,
                "pauses": 2,
                "avgIki": 145.5,
                "sessionSeconds": 30,
            }
        )

        self.assertEqual(stats.keystrokes, 31)
        self.assertEqual(stats.deletedCharacters, 4)
        self.assertEqual(stats.bulkDeletionEvents, 1)
        self.assertEqual(stats.cutEvents, 1)
        self.assertEqual(stats.wpm, 42.5)

    def test_empty_event_stream_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            _validate_event_stream(
                event_counts={"event_count": 0, "keydown_count": 0, "paste_count": 0},
                text_content="Evidence",
            )
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, "Keystroke evidence is required.")

    def test_insufficient_non_paste_evidence_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            _validate_event_stream(
                event_counts={
                    "event_count": MINIMUM_KEYSTROKES - 1,
                    "keydown_count": MINIMUM_KEYSTROKES - 1,
                    "paste_count": 0,
                },
                text_content="Evidence",
            )
        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn(str(MINIMUM_KEYSTROKES), raised.exception.detail)

    def test_threshold_typing_evidence_is_accepted(self):
        _validate_event_stream(
            event_counts={
                "event_count": MINIMUM_KEYSTROKES,
                "keydown_count": MINIMUM_KEYSTROKES,
                "paste_count": 0,
            },
            text_content="Evidence",
        )

    def test_captured_paste_with_nonblank_text_is_accepted(self):
        _validate_event_stream(
            event_counts={"event_count": 1, "keydown_count": 0, "paste_count": 1},
            text_content="Pasted evidence",
        )

        with self.assertRaises(HTTPException):
            _validate_event_stream(
                event_counts={"event_count": 1, "keydown_count": 0, "paste_count": 1},
                text_content="   ",
            )

    def test_result_and_risk_normalizers_are_bounded(self):
        self.assertEqual(_clamp_score(120), 100.0)
        self.assertEqual(_clamp_score(-1), 0.0)
        self.assertEqual(_clamp_score(float("nan")), 0.0)
        self.assertEqual(_normalize_result_label("AI-generated"), "SYNTHETIC")
        self.assertEqual(_normalize_result_label("real"), "HUMAN")
        self.assertEqual(_normalize_result_label("ambiguous"), "SUSPICIOUS")
        self.assertEqual(_normalize_result_label("other"), "UNKNOWN")
        self.assertEqual(_normalize_risk_level("HIGH", 0), "HIGH")
        self.assertEqual(_normalize_risk_level(None, 50), "HIGH")
        self.assertEqual(_normalize_risk_level(None, 20), "MEDIUM")
        self.assertEqual(_normalize_risk_level(None, 19.99), "LOW")


if __name__ == "__main__":
    unittest.main()
