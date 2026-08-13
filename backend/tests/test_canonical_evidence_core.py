import unittest

from app.services.canonical_evidence import (
    canonical_json,
    clean_events,
    compute_canonical_evidence,
    compute_idle_breaks,
    compute_revision_metrics,
    event_counts,
    normalize_title,
    reconstruct_active_duration_ms,
    safe_int,
    safe_number,
    select_active_duration_ms,
)


def writing_event(key: str, timestamp: int, *, flight_time=None):
    return {
        "type": "keydown",
        "key": key,
        "timestamp": timestamp,
        "flight_time": flight_time,
        "dwell_time": 70,
        "insertedCharacters": 1,
        "insertedText": key,
        "deletedCharacters": 0,
    }


class CanonicalEvidenceCoreTests(unittest.TestCase):
    def test_normalization_and_numeric_helpers_fail_safely(self):
        self.assertEqual(canonical_json({"b": 1, "a": 2}), '{"a":2,"b":1}')
        self.assertIsNone(safe_number(float("nan")))
        self.assertIsNone(safe_number(float("inf")))
        self.assertIsNone(safe_number("not-a-number"))
        self.assertEqual(safe_int(-3), 0)
        self.assertEqual(safe_int("4.4"), 4)
        self.assertEqual(normalize_title("  Core  "), "Core")
        self.assertEqual(normalize_title("   "), "Untitled Document")

    def test_cleaning_and_event_counts_distinguish_writing_from_navigation(self):
        raw = [
            writing_event("a", 1_000, flight_time=80),
            {
                "type": "keydown",
                "key": "Shift",
                "timestamp": 1_050,
                "flight_time": 50_000,
                "dwell_time": 3_000,
            },
            {
                "type": "paste",
                "key": "__PASTE_EVENT__",
                "timestamp": 1_100,
                "pastedLength": 4,
            },
            {
                "type": "cut",
                "key": "__CUT_EVENT__",
                "timestamp": 1_200,
            },
            "ignore-non-dict",
        ]

        cleaned = clean_events(raw)
        self.assertEqual(len(cleaned), 4)
        self.assertIsNone(cleaned[1]["flight_time"])
        self.assertIsNone(cleaned[1]["dwell_time"])

        counts = event_counts(cleaned)
        self.assertEqual(counts["raw_keydown_count"], 2)
        self.assertEqual(counts["keydown_count"], 1)
        self.assertEqual(counts["paste_count"], 1)
        self.assertEqual(counts["cut_count"], 1)
        self.assertEqual(counts["pasted_length"], 4)
        self.assertEqual(counts["event_count"], 4)

    def test_revision_metrics_deduplicate_one_confirmed_edit(self):
        events = [
            {
                "type": "keydown",
                "key": "Backspace",
                "timestamp": 1_000,
                "revision_id": "rev-1",
                "deletedCharacters": 3,
                "selection_length_before": 3,
                "deletion_method": "selection",
            },
            {
                "type": "input",
                "key": "__TEXT_REVISION__",
                "timestamp": 1_001,
                "revision_id": "rev-1",
                "deletedCharacters": 3,
                "selection_length_before": 3,
                "deletion_method": "selection",
            },
        ]

        metrics = compute_revision_metrics(events)
        self.assertEqual(metrics["delete_actions"], 1)
        self.assertEqual(metrics["deleted_characters"], 3)
        self.assertEqual(metrics["bulk_deletion_events"], 1)
        self.assertEqual(metrics["largest_deletion_chars"], 3)
        self.assertEqual(metrics["selection_deletion_events"], 1)

    def test_active_duration_accepts_verified_client_clock_and_rejects_outlier(self):
        events = [
            writing_event("a", 1_000),
            writing_event("b", 4_000, flight_time=3_000),
        ]

        verified = select_active_duration_ms(
            events=events,
            client_active_duration_ms=3_200,
        )
        self.assertEqual(verified["active_duration_ms"], 3_200)
        self.assertEqual(verified["duration_source"], "client_active_duration_verified")
        self.assertEqual(verified["reconstructed_active_duration_ms"], 3_000)

        rejected = select_active_duration_ms(
            events=events,
            client_active_duration_ms=20_000,
        )
        self.assertEqual(rejected["active_duration_ms"], 3_000)
        self.assertEqual(rejected["duration_source"], "server_reconstructed_active_duration")
        self.assertEqual(rejected["rejected_client_active_duration_ms"], 20_000)

        fallback = select_active_duration_ms(
            events=[],
            client_session_seconds=2.5,
        )
        self.assertEqual(fallback["active_duration_ms"], 2_500)
        self.assertEqual(fallback["duration_source"], "client_session_seconds_fallback")

        empty = select_active_duration_ms(events=[])
        self.assertEqual(empty["active_duration_ms"], 0)
        self.assertEqual(empty["duration_source"], "empty_or_unavailable")

    def test_idle_gap_is_a_break_not_active_writing_time(self):
        events = [
            writing_event("a", 1_000),
            writing_event("b", 35_001),
        ]

        breaks = compute_idle_breaks(events)
        self.assertEqual(len(breaks), 1)
        self.assertEqual(breaks[0]["duration_ms"], 34_001)
        self.assertEqual(breaks[0]["source"], "event_gap")
        self.assertEqual(reconstruct_active_duration_ms(events), 1_000)

    def test_canonical_hashes_are_deterministic_and_bind_document_and_evidence(self):
        events = [
            writing_event("a", 1_000),
            writing_event("b", 2_000, flight_time=1_000),
        ]
        kwargs = {
            "title": "  Evidence title  ",
            "text_content": "ab",
            "keystroke_array": events,
            "user_id": "student-1",
            "client_active_duration_ms": 1_000,
        }

        first = compute_canonical_evidence(**kwargs)
        second = compute_canonical_evidence(**kwargs)

        self.assertEqual(first.document_hash, second.document_hash)
        self.assertEqual(first.evidence_hash, second.evidence_hash)
        self.assertEqual(len(first.document_hash), 64)
        self.assertEqual(len(first.evidence_hash), 64)
        self.assertEqual(first.stats["keystrokes"], 2)
        self.assertEqual(first.evidence_metadata["writing_keydown_count"], 2)
        self.assertEqual(first.evidence_metadata["character_count"], 2)
        self.assertEqual(first.active_duration_ms, 1_000)

        changed = compute_canonical_evidence(
            **{**kwargs, "text_content": "ac"}
        )
        self.assertNotEqual(first.document_hash, changed.document_hash)
        self.assertNotEqual(first.evidence_hash, changed.evidence_hash)


if __name__ == "__main__":
    unittest.main()
