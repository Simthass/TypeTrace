import unittest

from app.services.canonical_evidence import (
    MAX_REASONABLE_ACTIVE_DURATION_MS,
    compute_canonical_evidence,
    compute_idle_breaks,
    compute_revision_metrics,
    is_writing_keydown_event,
    sanitize_dwell_time,
    sanitize_flight_time,
    select_active_duration_ms,
    timing_values,
)


def keydown(key: str, timestamp: int, **extra):
    return {
        "type": "keydown",
        "key": key,
        "timestamp": timestamp,
        **extra,
    }


class CanonicalEvidenceBoundaryTests(unittest.TestCase):
    def test_writing_keydown_contract_distinguishes_mutation_navigation_and_shortcuts(self):
        self.assertTrue(is_writing_keydown_event(keydown("Enter", 1)))
        self.assertTrue(is_writing_keydown_event(keydown("Tab", 2)))
        self.assertTrue(
            is_writing_keydown_event(
                keydown("@", 3, ctrlKey=True, altKey=True)
            )
        )
        self.assertTrue(
            is_writing_keydown_event(
                keydown("Unidentified", 4, insertedCharacters=2)
            )
        )

        self.assertFalse(is_writing_keydown_event(keydown("Shift", 5)))
        self.assertFalse(is_writing_keydown_event(keydown("ArrowLeft", 6)))
        self.assertFalse(is_writing_keydown_event(keydown("c", 7, ctrlKey=True)))
        self.assertFalse(is_writing_keydown_event(keydown("a", 8, repeat=True)))
        self.assertFalse(
            is_writing_keydown_event(
                keydown("a", 9, insertedCharacters=0, deletedCharacters=0)
            )
        )

    def test_timing_sanitizers_reject_nonpositive_and_implausible_values(self):
        self.assertIsNone(sanitize_flight_time(0))
        self.assertIsNone(sanitize_flight_time(-1))
        self.assertIsNone(sanitize_flight_time(30_001))
        self.assertEqual(sanitize_flight_time("750"), 750.0)

        self.assertIsNone(sanitize_dwell_time(0))
        self.assertIsNone(sanitize_dwell_time(2_001))
        self.assertEqual(sanitize_dwell_time("80"), 80.0)

    def test_explicit_zero_deletion_does_not_reintroduce_backspace_fallback(self):
        metrics = compute_revision_metrics(
            [
                keydown(
                    "Backspace",
                    1_000,
                    deletedCharacters=0,
                    chars_deleted=0,
                    deletion_method="unknown",
                )
            ]
        )

        self.assertEqual(metrics["delete_actions"], 0)
        self.assertEqual(metrics["deleted_characters"], 0)

    def test_session_seconds_fallback_is_bounded_when_no_events_can_reconstruct_time(self):
        fallback = select_active_duration_ms(
            events=[],
            client_session_seconds=12.5,
        )
        self.assertEqual(fallback["active_duration_ms"], 12_500)
        self.assertEqual(fallback["duration_source"], "client_session_seconds_fallback")

        bounded = select_active_duration_ms(
            events=[],
            client_session_seconds=60 * 60 * 24 * 7,
        )
        self.assertEqual(
            bounded["active_duration_ms"],
            MAX_REASONABLE_ACTIVE_DURATION_MS,
        )

    def test_timing_values_ignore_navigation_keydowns(self):
        values = timing_values(
            [
                keydown(
                    "a",
                    1_000,
                    insertedCharacters=1,
                    dwell_time=75,
                    flight_time=125,
                ),
                keydown(
                    "Shift",
                    1_100,
                    dwell_time=1_900,
                    flight_time=20_000,
                ),
                keydown(
                    "b",
                    1_300,
                    insertedCharacters=1,
                    dwell_time=90,
                    flight_time=175,
                ),
            ]
        )

        self.assertEqual(values["dwell_values"], [75.0, 90.0])
        self.assertEqual(values["flight_values"], [125.0, 175.0])

    def test_idle_marker_is_preserved_as_auditable_metadata(self):
        breaks = compute_idle_breaks(
            [
                keydown("a", 10_000, insertedCharacters=1),
                {
                    "type": "input",
                    "key": "__IDLE_BREAK__",
                    "inputType": "historyIdleBreak",
                    "timestamp": 45_000,
                    "idleBreakMs": 35_000,
                },
            ]
        )

        self.assertTrue(any(item["source"] == "idle_marker" for item in breaks))
        self.assertTrue(any(item["duration_ms"] == 35_000 for item in breaks))

    def test_canonical_metadata_counts_utf16_characters_and_paste_ratio(self):
        result = compute_canonical_evidence(
            title=" Boundary ",
            text_content="A😀",
            user_id="student-boundary",
            keystroke_array=[
                {
                    "type": "paste",
                    "key": "__PASTE_EVENT__",
                    "timestamp": 1_000,
                    "pastedLength": 3,
                    "insertedCharacters": 3,
                    "insertedText": "A😀",
                }
            ],
            client_active_duration_ms=1_000,
        )

        self.assertEqual(result.evidence_metadata["character_count"], 3)
        self.assertEqual(result.evidence_metadata["pasted_length"], 3)
        self.assertEqual(result.evidence_metadata["paste_ratio"], 1.0)
        self.assertEqual(len(result.document_hash), 64)
        self.assertEqual(len(result.evidence_hash), 64)


if __name__ == "__main__":
    unittest.main(verbosity=2)
