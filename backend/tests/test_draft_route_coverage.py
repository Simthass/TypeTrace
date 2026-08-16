from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

from app.api.routes import drafts as draft_routes
from app.core.crypto import encrypt_json, encrypt_text
from tests.helpers import make_user
from tests.workflow_coverage_helpers import SequenceAsyncSession


NOW = datetime(2026, 8, 14, 8, 0, tzinfo=timezone.utc)


def draft_record(**overrides):
    draft = SimpleNamespace(
        id="draft-server-1",
        local_draft_id="local-1",
        title="Private draft",
        text_content=encrypt_text("private essay"),
        course_id=None,
        keystroke_array=encrypt_json([]),
        active_duration_ms=12_000,
        started_at=NOW,
        last_activity_at=NOW,
        paused_at=NOW,
        version=3,
        lifecycle_status="PAUSED",
        sync_status="SYNCED",
        save_reason="autosave",
        created_at=NOW,
        updated_at=NOW,
    )
    for key, value in overrides.items():
        setattr(draft, key, value)
    return draft


class DraftRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_decrypted_payload_returns_plaintext_without_changing_ciphertext_record(self) -> None:
        draft = draft_record()
        payload = draft_routes._decrypted_draft_payload(draft)
        self.assertEqual(payload["text_content"], "private essay")
        self.assertEqual(payload["keystroke_array"], [])
        self.assertEqual(payload["version"], 3)
        self.assertNotEqual(draft.text_content, "private essay")

    async def test_course_link_guard_allows_personal_and_enrolled_drafts(self) -> None:
        personal_db = SequenceAsyncSession()
        result = await draft_routes._ensure_student_can_link_course(
            db=personal_db,
            student_id="student-a",
            course_id=None,
        )
        self.assertIsNone(result)
        self.assertEqual(personal_db.executed, [])

        db = SequenceAsyncSession([5])
        result = await draft_routes._ensure_student_can_link_course(
            db=db,
            student_id="student-a",
            course_id=5,
        )
        self.assertIsNone(result)
        self.assertEqual(len(db.executed), 1)

    async def test_course_link_guard_rejects_non_enrolled_student(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            await draft_routes._ensure_student_can_link_course(
                db=SequenceAsyncSession([None]),
                student_id="student-a",
                course_id=5,
            )
        self.assertEqual(raised.exception.status_code, 403)
        self.assertIn("enrolled", raised.exception.detail.lower())

    async def test_list_drafts_decrypts_authorized_records(self) -> None:
        result = await draft_routes.list_drafts(
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=SequenceAsyncSession([[draft_record()]]),
        )
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["drafts"][0]["text_content"], "private essay")
        self.assertEqual(result["drafts"][0]["keystroke_array"], [])

    async def test_get_draft_returns_decrypted_owned_snapshot(self) -> None:
        result = await draft_routes.get_draft(
            draft_id="local-1",
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=SequenceAsyncSession([draft_record()]),
        )
        self.assertEqual(result["draft"]["id"], "draft-server-1")
        self.assertEqual(result["draft"]["text_content"], "private essay")


if __name__ == "__main__":
    unittest.main(verbosity=2)
