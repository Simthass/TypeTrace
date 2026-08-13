import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.api.routes.drafts import (
    DraftSubmitLinkRequest,
    DraftUpsertRequest,
    _datetime_to_ms,
    _ms_to_datetime,
    _normalize_title,
    _safe_save_reason,
    _safe_sync_status,
)


class DraftSchemaCoreTests(unittest.TestCase):
    def test_valid_snapshot_contract_serializes_strict_event_shape(self):
        request = DraftUpsertRequest(
            draft_id="core-draft",
            title=" Evidence draft ",
            text_content="a",
            expected_version=2,
            save_reason="manual",
            lifecycle_status="PAUSED",
            sync_status="PENDING_SYNC",
            keystroke_array=[
                {
                    "type": "keydown",
                    "key": "a",
                    "keyCode": 65,
                    "timestamp": 1_786_000_000_000,
                    "documentLength": 0,
                    "cursorPosition": 0,
                    "documentLengthBefore": 0,
                    "documentLengthAfter": 1,
                    "insertedCharacters": 1,
                    "insertedText": "a",
                    "deletedCharacters": 0,
                    "deltaLength": 1,
                }
            ],
        )

        self.assertEqual(request.validated_text_content(), "a")
        events = request.event_dicts()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["insertedText"], "a")
        self.assertNotIn("unknown_field", events[0])

    def test_extra_fields_and_invalid_enums_fail_closed(self):
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(extra_field="unexpected")
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(expected_version=0)
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(save_reason="other")
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(lifecycle_status="SUBMITTED")
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(sync_status="UNKNOWN")
        with self.assertRaises(ValidationError):
            DraftSubmitLinkRequest(session_id=0)

    def test_invalid_event_position_and_paste_contract_are_rejected(self):
        with self.assertRaises(ValidationError):
            DraftUpsertRequest(
                keystroke_array=[
                    {
                        "type": "keydown",
                        "timestamp": 1_000,
                        "documentLength": 0,
                        "cursorPosition": 1,
                    }
                ]
            )

        with self.assertRaises(ValidationError):
            DraftUpsertRequest(
                keystroke_array=[
                    {
                        "type": "paste",
                        "key": "__PASTE_EVENT__",
                        "timestamp": 1_000,
                        "documentLength": 0,
                        "cursorPosition": 0,
                        "pastedLength": 2,
                        "insertedCharacters": 2,
                    }
                ]
            )

    def test_timestamp_and_normalization_helpers_are_stable(self):
        self.assertEqual(_normalize_title("  Draft title  "), "Draft title")
        self.assertEqual(_normalize_title(""), "Untitled Document")
        self.assertEqual(_safe_sync_status("pending_sync"), "PENDING_SYNC")
        self.assertEqual(_safe_sync_status("invalid"), "SYNCED")
        self.assertEqual(_safe_save_reason("RECOVERY"), "recovery")
        self.assertEqual(_safe_save_reason("invalid"), "autosave")

        source = datetime(2026, 8, 12, 12, 0, tzinfo=timezone.utc)
        milliseconds = _datetime_to_ms(source)
        self.assertEqual(_ms_to_datetime(milliseconds), source)
        self.assertIsNone(_ms_to_datetime(None))
        self.assertIsNone(_datetime_to_ms(None))


if __name__ == "__main__":
    unittest.main()
