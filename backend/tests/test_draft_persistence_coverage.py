from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes import drafts as draft_routes
from app.core.crypto import encrypt_json, encrypt_text
from app.core.errors import ApiError
from tests.helpers import make_user
from tests.persistence_coverage_helpers import CoverageSession, make_request


NOW = datetime(2026, 8, 14, 12, 0, tzinfo=timezone.utc)


def draft_record(**overrides):
    draft = SimpleNamespace(
        id="draft-server-1",
        local_draft_id="local-1",
        user_id="student-a",
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
        conflict_payload=None,
        submitted_session_id=None,
        created_at=NOW,
        updated_at=NOW,
    )
    for key, value in overrides.items():
        setattr(draft, key, value)
    return draft


def payload(**overrides):
    values = dict(
        draft_id="local-1",
        title="  Updated draft  ",
        text_content="updated essay",
        keystroke_array=[],
        active_duration_ms=15_000,
        expected_version=3,
        save_reason="manual",
        lifecycle_status="PAUSED",
        sync_status="PENDING_SYNC",
    )
    values.update(overrides)
    return draft_routes.DraftUpsertRequest(**values)


class DraftPersistenceCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_draft_encrypts_content_audits_and_returns_plaintext(self) -> None:
        db = CoverageSession([None], assign_draft_identity=True)
        result = await draft_routes.upsert_draft(
            payload=payload(draft_id="new-local", expected_version=None, text_content="new evidence"),
            request=make_request("/api/v1/drafts"),
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )

        created = next(item for item in db.added if item.__class__.__name__ == "DraftSession")
        self.assertEqual(created.id, "draft-created-coverage")
        self.assertNotEqual(created.text_content, "new evidence")
        self.assertEqual(result["draft"]["text_content"], "new evidence")
        self.assertEqual(result["draft"]["save_reason"], "manual")
        self.assertEqual(db.flushes, 1)
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.refreshes, 1)

    async def test_update_existing_draft_increments_version_and_normalizes_state(self) -> None:
        existing = draft_record(version=3, lifecycle_status="ACTIVE")
        db = CoverageSession([existing])
        result = await draft_routes.upsert_draft(
            payload=payload(sync_status="CONFLICT", title="  Revised title  "),
            request=make_request("/api/v1/drafts/local-1", "PATCH"),
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )

        self.assertEqual(existing.version, 4)
        self.assertEqual(existing.title, "Revised title")
        self.assertEqual(existing.sync_status, "CONFLICT")
        self.assertEqual(existing.lifecycle_status, "PAUSED")
        self.assertEqual(result["draft"]["version"], 4)
        self.assertEqual(result["draft"]["text_content"], "updated essay")

    async def test_upsert_rejects_submitted_and_stale_versions(self) -> None:
        with self.assertRaises(HTTPException) as submitted:
            await draft_routes.upsert_draft(
                payload=payload(),
                request=make_request("/api/v1/drafts"),
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=CoverageSession([draft_record(lifecycle_status="SUBMITTED")]),
            )
        self.assertEqual(submitted.exception.status_code, 409)

        stale = draft_record(version=9)
        with self.assertRaises(ApiError) as conflict:
            await draft_routes.upsert_draft(
                payload=payload(expected_version=8),
                request=make_request("/api/v1/drafts"),
                current_user=make_user(user_id="student-a", role="STUDENT"),
                db=CoverageSession([stale]),
            )
        self.assertEqual(conflict.exception.status_code, 409)
        self.assertEqual(conflict.exception.code, "DRAFT_VERSION_CONFLICT")
        self.assertEqual(conflict.exception.details["server_draft"]["text_content"], "private essay")

    async def test_update_wrapper_uses_path_draft_id_when_payload_has_none(self) -> None:
        existing = draft_record(local_draft_id="path-draft")
        update_payload = payload(draft_id=None, expected_version=3)
        result = await draft_routes.update_draft(
            draft_id="path-draft",
            payload=update_payload,
            request=make_request("/api/v1/drafts/path-draft", "PATCH"),
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=CoverageSession([existing]),
        )
        self.assertEqual(update_payload.draft_id, "path-draft")
        self.assertEqual(result["draft"]["version"], 4)

    async def test_delete_is_idempotent_and_persists_tombstone_when_present(self) -> None:
        missing_db = CoverageSession([None])
        missing = await draft_routes.delete_draft(
            draft_id="missing",
            request=make_request("/api/v1/drafts/missing", "DELETE"),
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=missing_db,
        )
        self.assertIn("already removed", missing["message"])
        self.assertEqual(missing_db.commits, 0)

        existing = draft_record()
        db = CoverageSession([existing])
        result = await draft_routes.delete_draft(
            draft_id="local-1",
            request=make_request("/api/v1/drafts/local-1", "DELETE"),
            current_user=make_user(user_id="student-a", role="STUDENT"),
            db=db,
        )
        self.assertEqual(result["message"], "Draft deleted.")
        self.assertEqual(existing.lifecycle_status, "DELETED")
        self.assertEqual(existing.sync_status, "SYNCED")
        self.assertEqual(db.commits, 1)

    async def test_submit_rejects_missing_session_and_cross_evidence_link(self) -> None:
        student = make_user(user_id="student-a", role="STUDENT")
        with self.assertRaises(HTTPException) as missing:
            await draft_routes.mark_draft_submitted(
                draft_id="local-1",
                payload=draft_routes.DraftSubmitLinkRequest(session_id=157),
                request=make_request("/api/v1/drafts/local-1/submit"),
                current_user=student,
                db=CoverageSession([draft_record(), None]),
            )
        self.assertEqual(missing.exception.status_code, 404)

        session = SimpleNamespace(id=157, evidence_hash="submitted-hash")
        canonical = SimpleNamespace(evidence_hash="different-hash")
        with patch.object(draft_routes, "compute_canonical_evidence", return_value=canonical):
            with self.assertRaises(HTTPException) as mismatch:
                await draft_routes.mark_draft_submitted(
                    draft_id="local-1",
                    payload=draft_routes.DraftSubmitLinkRequest(session_id=157),
                    request=make_request("/api/v1/drafts/local-1/submit"),
                    current_user=student,
                    db=CoverageSession([draft_record(), session]),
                )
        self.assertEqual(mismatch.exception.status_code, 409)
        self.assertIn("does not match", mismatch.exception.detail)

    async def test_submit_is_idempotent_for_same_session_and_rejects_different_session(self) -> None:
        student = make_user(user_id="student-a", role="STUDENT")
        same = await draft_routes.mark_draft_submitted(
            draft_id="local-1",
            payload=draft_routes.DraftSubmitLinkRequest(session_id=157),
            request=make_request("/api/v1/drafts/local-1/submit"),
            current_user=student,
            db=CoverageSession([draft_record(submitted_session_id=157), SimpleNamespace(id=157, evidence_hash="hash")]),
        )
        self.assertIn("already linked", same["message"])

        with self.assertRaises(HTTPException) as different:
            await draft_routes.mark_draft_submitted(
                draft_id="local-1",
                payload=draft_routes.DraftSubmitLinkRequest(session_id=157),
                request=make_request("/api/v1/drafts/local-1/submit"),
                current_user=student,
                db=CoverageSession([draft_record(submitted_session_id=99), SimpleNamespace(id=157, evidence_hash="hash")]),
            )
        self.assertEqual(different.exception.status_code, 409)

    async def test_submit_matching_evidence_marks_draft_submitted_and_audits(self) -> None:
        student = make_user(user_id="student-a", role="STUDENT")
        draft = draft_record()
        session = SimpleNamespace(id=157, evidence_hash="matching-hash")
        canonical = SimpleNamespace(evidence_hash="matching-hash")
        db = CoverageSession([draft, session])
        with patch.object(draft_routes, "compute_canonical_evidence", return_value=canonical):
            result = await draft_routes.mark_draft_submitted(
                draft_id="local-1",
                payload=draft_routes.DraftSubmitLinkRequest(session_id=157),
                request=make_request("/api/v1/drafts/local-1/submit"),
                current_user=student,
                db=db,
            )
        self.assertEqual(result["message"], "Draft marked as submitted.")
        self.assertEqual(draft.lifecycle_status, "SUBMITTED")
        self.assertEqual(draft.submitted_session_id, 157)
        self.assertEqual(db.commits, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
