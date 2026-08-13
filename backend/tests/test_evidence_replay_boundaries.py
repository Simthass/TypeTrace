import unittest

from app.services.evidence_replay import (
    EvidenceReplayMismatch,
    reconstruct_evidence_text,
    validate_evidence_text,
)


def insert(text: str, before: int, *, timestamp: int = 1_000):
    units = len(text.encode("utf-16-le")) // 2
    return {
        "type": "input",
        "key": "__TEXT_INSERT__",
        "timestamp": timestamp,
        "cursorPosition": before,
        "documentLength": before,
        "documentLengthBefore": before,
        "documentLengthAfter": before + units,
        "insertedCharacters": units,
        "insertedText": text,
        "deletedCharacters": 0,
        "deltaLength": units,
    }


class EvidenceReplayBoundaryTests(unittest.TestCase):
    def test_same_length_selection_replacement_reconstructs_exact_text(self):
        events = [
            insert("hello", 0),
            {
                "type": "input",
                "key": "__TEXT_REVISION__",
                "timestamp": 2_000,
                "cursorPosition": 1,
                "documentLength": 5,
                "documentLengthBefore": 5,
                "documentLengthAfter": 5,
                "selection_length_before": 1,
                "deletedCharacters": 1,
                "insertedCharacters": 1,
                "insertedText": "a",
                "deltaLength": 0,
            },
        ]

        result = validate_evidence_text(events=events, expected_text="hallo")
        self.assertTrue(result.complete)
        self.assertEqual(result.text, "hallo")

    def test_forward_delete_removes_text_at_the_cursor(self):
        events = [
            insert("abc", 0),
            {
                "type": "keydown",
                "key": "Delete",
                "timestamp": 2_000,
                "cursorPosition": 1,
                "documentLength": 3,
                "documentLengthBefore": 3,
                "documentLengthAfter": 2,
                "deletedCharacters": 1,
                "insertedCharacters": 0,
                "insertedText": "",
                "deltaLength": -1,
            },
        ]

        result = validate_evidence_text(events=events, expected_text="ac")
        self.assertEqual(result.text, "ac")

    def test_explicit_zero_insert_prevents_key_fallback_from_inventing_text(self):
        result = reconstruct_evidence_text(
            [
                {
                    "type": "keydown",
                    "key": "x",
                    "timestamp": 1_000,
                    "cursorPosition": 0,
                    "documentLength": 0,
                    "documentLengthBefore": 0,
                    "documentLengthAfter": 0,
                    "insertedCharacters": 0,
                    "insertedText": "",
                    "deletedCharacters": 0,
                    "deltaLength": 0,
                }
            ]
        )

        self.assertTrue(result.complete)
        self.assertEqual(result.text, "")

    def test_cursor_keyup_and_idle_metadata_do_not_change_reconstructed_text(self):
        result = reconstruct_evidence_text(
            [
                insert("a", 0),
                {
                    "type": "cursor",
                    "key": "__CURSOR_MOVE__",
                    "timestamp": 1_100,
                    "cursorPosition": 0,
                    "documentLength": 1,
                },
                {
                    "type": "keyup",
                    "key": "a",
                    "timestamp": 1_120,
                    "cursorPosition": 1,
                    "documentLength": 1,
                },
                {
                    "type": "input",
                    "key": "__IDLE_BREAK__",
                    "inputType": "historyIdleBreak",
                    "timestamp": 40_000,
                    "documentLength": 1,
                    "cursorPosition": 1,
                },
                insert("b", 1, timestamp=41_000),
            ]
        )

        self.assertTrue(result.complete)
        self.assertEqual(result.text, "ab")

    def test_out_of_range_cursor_and_overdelete_fail_closed(self):
        events = [
            insert("a", 0),
            {
                "type": "keydown",
                "key": "Delete",
                "timestamp": 2_000,
                "cursorPosition": 99,
                "documentLength": 1,
                "documentLengthBefore": 1,
                "documentLengthAfter": 0,
                "deletedCharacters": 5,
                "insertedCharacters": 0,
                "insertedText": "",
                "deltaLength": -1,
            },
        ]

        result = reconstruct_evidence_text(events)
        self.assertFalse(result.complete)
        self.assertTrue(any("cursor position" in issue for issue in result.issues))
        self.assertTrue(any("requested deletion" in issue for issue in result.issues))

        with self.assertRaises(EvidenceReplayMismatch):
            validate_evidence_text(events=events, expected_text="")


if __name__ == "__main__":
    unittest.main(verbosity=2)
