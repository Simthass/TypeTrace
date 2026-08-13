import unittest

from app.services.evidence_replay import (
    EvidenceReplayMismatch,
    _deleted_characters,
    _fallback_insert_text,
    _insert_text,
    _optional_int,
    _safe_int,
    reconstruct_evidence_text,
    validate_evidence_text,
)


def insertion(text: str, before: int, *, timestamp: int = 1_000):
    utf16_units = len(text.encode("utf-16-le")) // 2
    return {
        "type": "keydown",
        "key": text if utf16_units == 1 else "Unidentified",
        "timestamp": timestamp,
        "cursorPosition": before,
        "documentLength": before,
        "documentLengthBefore": before,
        "documentLengthAfter": before + utf16_units,
        "selection_length_before": 0,
        "insertedCharacters": utf16_units,
        "insertedText": text,
        "deletedCharacters": 0,
        "deltaLength": utf16_units,
    }


class EvidenceReplayCoreTests(unittest.TestCase):
    def test_helper_conversion_and_shortcut_fallbacks(self):
        self.assertEqual(_safe_int("3.6"), 4)
        self.assertEqual(_safe_int(-2), 0)
        self.assertEqual(_optional_int(""), None)
        self.assertEqual(_optional_int("7"), 7)
        self.assertEqual(_fallback_insert_text({"type": "keydown", "key": "Enter"}), "\n")
        self.assertEqual(_fallback_insert_text({"type": "keydown", "key": "Tab"}), "    ")
        self.assertEqual(
            _fallback_insert_text({"type": "keydown", "key": "c", "ctrlKey": True}),
            "",
        )
        self.assertEqual(
            _fallback_insert_text(
                {"type": "keydown", "key": "@", "ctrlKey": True, "altKey": True}
            ),
            "@",
        )
        self.assertEqual(_deleted_characters({"type": "keydown", "key": "Backspace"}), 1)
        self.assertEqual(_insert_text({"type": "keydown", "key": "x"}), "x")

    def test_typed_stream_reconstructs_exact_text(self):
        events = [insertion("a", 0), insertion("b", 1, timestamp=1_100)]
        result = reconstruct_evidence_text(events)

        self.assertTrue(result.complete)
        self.assertEqual(result.text, "ab")
        self.assertEqual(result.issues, ())
        self.assertEqual(validate_evidence_text(events=events, expected_text="ab"), result)

    def test_utf16_cursor_semantics_preserve_non_bmp_text(self):
        events = [
            insertion("😀", 0),
            insertion("a", 2, timestamp=1_100),
        ]
        result = reconstruct_evidence_text(events)

        self.assertTrue(result.complete)
        self.assertEqual(result.text, "😀a")
        validate_evidence_text(events=events, expected_text="😀a")

    def test_backspace_fallback_deletes_immediately_before_cursor(self):
        events = [
            insertion("a", 0),
            insertion("b", 1, timestamp=1_100),
            {
                "type": "keydown",
                "key": "Backspace",
                "timestamp": 1_200,
                "cursorPosition": 2,
                "documentLength": 2,
                "documentLengthBefore": 2,
                "documentLengthAfter": 1,
                "selection_length_before": 0,
                "insertedCharacters": 0,
                "deltaLength": -1,
            },
        ]

        result = reconstruct_evidence_text(events)
        self.assertTrue(result.complete)
        self.assertEqual(result.text, "a")

    def test_internal_length_inconsistency_is_rejected(self):
        bad_event = insertion("a", 0)
        bad_event["documentLengthAfter"] = 2

        result = reconstruct_evidence_text([bad_event])
        self.assertFalse(result.complete)
        self.assertTrue(any("post-edit length" in issue for issue in result.issues))

        with self.assertRaisesRegex(EvidenceReplayMismatch, "internally inconsistent"):
            validate_evidence_text(events=[bad_event], expected_text="a")

    def test_final_text_mismatch_is_rejected(self):
        events = [insertion("a", 0)]
        with self.assertRaisesRegex(EvidenceReplayMismatch, "does not match"):
            validate_evidence_text(events=events, expected_text="b")

    def test_paste_without_literal_content_is_not_replayable(self):
        event = {
            "type": "paste",
            "key": "__PASTE_EVENT__",
            "timestamp": 1_000,
            "cursorPosition": 0,
            "documentLength": 0,
            "documentLengthBefore": 0,
            "pastedLength": 5,
            "insertedCharacters": 5,
        }
        result = reconstruct_evidence_text([event])

        self.assertFalse(result.complete)
        self.assertTrue(any("paste content is missing" in issue for issue in result.issues))


if __name__ == "__main__":
    unittest.main()
