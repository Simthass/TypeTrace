from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from pydantic import ValidationError

from app.api.routes import drafts
from app.schemas.evidence import MAX_ANALYSIS_TEXT_CHARACTERS


class DraftContractTests(unittest.TestCase):
    def test_title_and_status_normalizers_are_bounded(self):
        self.assertEqual(drafts._normalize_title("  Draft title  "), "Draft title")
        self.assertEqual(drafts._normalize_title("   "), "Untitled Document")
        self.assertEqual(len(drafts._normalize_title("x" * 400)), 255)

        for value in ("LOCAL_ONLY", "SYNCED", "PENDING_SYNC", "CONFLICT"):
            self.assertEqual(drafts._safe_sync_status(value.lower()), value)
        self.assertEqual(drafts._safe_sync_status("unexpected"), "SYNCED")

        for value in ("autosave", "manual", "recovery", "resume"):
            self.assertEqual(drafts._safe_save_reason(value.upper()), value)
        self.assertEqual(drafts._safe_save_reason("unexpected"), "autosave")

    def test_timestamp_conversion_handles_timezone_and_invalid_values(self):
        stamp = 1_700_000_000_000
        dt = drafts._ms_to_datetime(stamp)
        self.assertIsNotNone(dt)
        self.assertEqual(drafts._datetime_to_ms(dt), stamp)

        naive = datetime(2026, 8, 13, 8, 0)
        aware_ms = drafts._datetime_to_ms(naive)
        self.assertIsInstance(aware_ms, int)

        self.assertIsNone(drafts._ms_to_datetime(None))
        self.assertIsNone(drafts._datetime_to_ms(None))
        self.assertIsNone(drafts._ms_to_datetime(10**30))

    def test_upsert_schema_forbids_unknown_fields_and_invalid_enums(self):
        request = drafts.DraftUpsertRequest(
            title="Evidence draft",
            save_reason="manual",
            lifecycle_status="ACTIVE",
            sync_status="PENDING_SYNC",
        )
        self.assertEqual(request.title, "Evidence draft")
        self.assertEqual(request.save_reason, "manual")

        with self.assertRaises(ValidationError):
            drafts.DraftUpsertRequest(title="Draft", unexpected=True)

        with self.assertRaises(ValidationError):
            drafts.DraftUpsertRequest(save_reason="invalid")

        with self.assertRaises(ValidationError):
            drafts.DraftUpsertRequest(lifecycle_status="DELETED")

    def test_utf16_text_limit_rejects_non_bmp_overflow(self):
        # Pydantic's string length counts Python code points; the explicit
        # validator must still enforce the server's UTF-16 contract.
        text = "😀" * (MAX_ANALYSIS_TEXT_CHARACTERS // 2 + 1)
        request = drafts.DraftUpsertRequest(text_content=text)
        with self.assertRaises(ValueError):
            request.validated_text_content()

    def test_event_dicts_use_the_strict_schema_shape(self):
        request = drafts.DraftUpsertRequest(
            keystroke_array=[
                {
                    "key": "a",
                    "keyCode": 65,
                    "type": "keydown",
                    "timestamp": 1000,
                    "down_time": 1000,
                    "up_time": 1060,
                    "dwell_time": 60,
                    "flight_time": None,
                    "documentLength": 0,
                    "cursorPosition": 0,
                }
            ]
        )
        event = request.event_dicts()[0]
        self.assertEqual(event["key"], "a")
        self.assertEqual(event["type"], "keydown")
        self.assertNotIn("insertedText", event)

    def test_draft_payload_serializes_runtime_state_without_encryption_side_effects(self):
        created = datetime(2026, 8, 13, 7, 0, tzinfo=timezone.utc)
        updated = datetime(2026, 8, 13, 7, 5, tzinfo=timezone.utc)
        model = SimpleNamespace(
            id="backend-id",
            local_draft_id="local-id",
            title="Evidence draft",
            text_content="ciphertext",
            course_id=12,
            keystroke_array=[{"cipher": "event"}],
            active_duration_ms=2450,
            started_at=created,
            last_activity_at=updated,
            paused_at=None,
            version=3,
            lifecycle_status="PAUSED",
            sync_status="SYNCED",
            save_reason="manual",
            created_at=created,
            updated_at=updated,
        )
        payload = drafts._draft_payload(model)
        self.assertEqual(payload["backend_draft_id"], "backend-id")
        self.assertEqual(payload["draft_id"], "local-id")
        self.assertEqual(payload["version"], 3)
        self.assertEqual(payload["active_duration_ms"], 2450)
        self.assertEqual(payload["started_at"], drafts._datetime_to_ms(created))


if __name__ == "__main__":
    unittest.main()
