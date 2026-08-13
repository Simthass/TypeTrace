"""capture, replay, and duration integrity regression tests."""

from __future__ import annotations

import unittest

from pydantic import ValidationError

from app.schemas.evidence import KeystrokeEvent
from app.services.canonical_evidence import event_counts, select_active_duration_ms
from app.services.evidence_replay import (
    EvidenceReplayMismatch,
    reconstruct_evidence_text,
    validate_evidence_text,
)
from app.services.text_units import utf16_length


def typed_event(
    *,
    key: str,
    timestamp: int,
    before: int,
    position: int,
    inserted_text: str,
    deleted: int = 0,
    selection_length: int = 0,
) -> dict[str, object]:
    inserted_units = utf16_length(inserted_text)
    after = before - deleted + inserted_units
    return {
        "key": key,
        "keyCode": ord(key.upper()) if len(key) == 1 and key.isascii() else 0,
        "code": "Key" + key.upper() if len(key) == 1 and key.isascii() else "Input",
        "type": "keydown",
        "timestamp": timestamp,
        "down_time": 10.0,
        "up_time": 80.0,
        "dwell_time": 70.0,
        "flight_time": 120.0,
        "documentLength": before,
        "documentLengthBefore": before,
        "documentLengthAfter": after,
        "cursorPosition": position,
        "selectionStartBefore": position,
        "selectionEndBefore": position + selection_length,
        "selection_length_before": selection_length,
        "deltaLength": inserted_units - deleted,
        "insertedCharacters": inserted_units,
        "insertedText": inserted_text,
        "deletedCharacters": deleted,
        "chars_deleted": deleted,
        "deletion_method": "replacement" if deleted and inserted_units else "unknown",
    }


class Utf16EvidenceTests(unittest.TestCase):
    def test_browser_utf16_length_is_preserved_for_non_bmp_text(self) -> None:
        self.assertEqual(utf16_length("A😀B"), 4)

        parsed = KeystrokeEvent.model_validate(
            typed_event(
                key="Unidentified",
                timestamp=1_785_280_000_000,
                before=0,
                position=0,
                inserted_text="😀",
            )
        )
        self.assertEqual(parsed.insertedCharacters, 2)

    def test_incorrect_utf16_insert_count_is_rejected(self) -> None:
        event = typed_event(
            key="Unidentified",
            timestamp=1_785_280_000_000,
            before=0,
            position=0,
            inserted_text="😀",
        )
        event["insertedCharacters"] = 1
        with self.assertRaises(ValidationError):
            KeystrokeEvent.model_validate(event)


class EvidenceReplayTests(unittest.TestCase):
    def test_typed_stream_reconstructs_exact_final_text(self) -> None:
        events = [
            typed_event(
                key="a",
                timestamp=1_785_280_000_000,
                before=0,
                position=0,
                inserted_text="a",
            ),
            typed_event(
                key="b",
                timestamp=1_785_280_000_120,
                before=1,
                position=1,
                inserted_text="b",
            ),
            typed_event(
                key="Unidentified",
                timestamp=1_785_280_000_240,
                before=2,
                position=2,
                inserted_text="😀",
            ),
        ]

        result = validate_evidence_text(events=events, expected_text="ab😀")
        self.assertTrue(result.complete)
        self.assertEqual(result.text, "ab😀")

    def test_paste_over_selection_deletes_before_inserting(self) -> None:
        events = [
            typed_event(
                key="Unidentified",
                timestamp=1_785_280_000_000,
                before=0,
                position=0,
                inserted_text="hello world",
            ),
            {
                "key": "__PASTE_EVENT__",
                "keyCode": 0,
                "code": "Paste",
                "type": "paste",
                "timestamp": 1_785_280_000_200,
                "documentLength": 11,
                "documentLengthBefore": 11,
                "documentLengthAfter": 11,
                "cursorPosition": 6,
                "selectionStartBefore": 6,
                "selectionEndBefore": 11,
                "selection_length_before": 5,
                "pastedLength": 5,
                "insertedCharacters": 5,
                "insertedText": "there",
                "deletedCharacters": 5,
                "chars_deleted": 5,
                "deltaLength": 0,
                "deletion_method": "replacement",
            },
        ]

        result = reconstruct_evidence_text(events)
        self.assertEqual(result.issues, ())
        self.assertEqual(result.text, "hello there")

    def test_confirmed_noop_backspace_does_not_mutate_or_fail_replay(self) -> None:
        event = {
            "key": "Backspace",
            "keyCode": 8,
            "type": "keydown",
            "timestamp": 1_785_280_000_000,
            "documentLength": 0,
            "documentLengthBefore": 0,
            "documentLengthAfter": 0,
            "cursorPosition": 0,
            "insertedCharacters": 0,
            "insertedText": "",
            "deletedCharacters": 0,
            "chars_deleted": 0,
            "deltaLength": 0,
        }
        result = validate_evidence_text(events=[event], expected_text="")
        self.assertTrue(result.complete)
        self.assertEqual(result.text, "")

    def test_text_that_does_not_match_events_is_rejected(self) -> None:
        event = typed_event(
            key="a",
            timestamp=1_785_280_000_000,
            before=0,
            position=0,
            inserted_text="a",
        )
        with self.assertRaises(EvidenceReplayMismatch):
            validate_evidence_text(events=[event], expected_text="b")


class CaptureMetricTests(unittest.TestCase):
    def test_navigation_modifiers_shortcuts_and_repeats_do_not_meet_threshold(self) -> None:
        events = [
            {
                "type": "keydown",
                "key": "Shift",
                "timestamp": 1,
            },
            {
                "type": "keydown",
                "key": "ArrowLeft",
                "timestamp": 2,
            },
            {
                "type": "keydown",
                "key": "c",
                "ctrlKey": True,
                "timestamp": 3,
            },
            {
                "type": "keydown",
                "key": "x",
                "repeat": True,
                "timestamp": 4,
            },
            {
                "type": "keydown",
                "key": "Backspace",
                "timestamp": 5,
            },
            {
                "type": "keydown",
                "key": "a",
                "insertedCharacters": 1,
                "timestamp": 6,
            },
        ]

        counts = event_counts(events)
        self.assertEqual(counts["raw_keydown_count"], 6)
        self.assertEqual(counts["keydown_count"], 1)

    def test_unreasonably_small_client_duration_is_rejected(self) -> None:
        events = [
            {"type": "keydown", "key": "a", "timestamp": 10_000},
            {"type": "keydown", "key": "b", "timestamp": 20_000},
        ]

        selected = select_active_duration_ms(
            events=events,
            client_active_duration_ms=1_000,
            client_session_seconds=1,
        )
        self.assertEqual(selected["active_duration_ms"], 10_000)
        self.assertEqual(
            selected["duration_source"],
            "server_reconstructed_active_duration",
        )
        self.assertEqual(selected["rejected_client_active_duration_ms"], 1_000)


if __name__ == "__main__":
    unittest.main()
