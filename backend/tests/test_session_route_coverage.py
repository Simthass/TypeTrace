from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes import sessions as session_routes
from app.core.crypto import encrypt_json, encrypt_text
from app.schemas.evidence import KeystrokeSessionAnalyzeRequest
from tests.workflow_coverage_helpers import SequenceAsyncSession


def valid_payload() -> KeystrokeSessionAnalyzeRequest:
    return KeystrokeSessionAnalyzeRequest.model_validate(
        {
            "submission_id": "submission-coverage-000000000001",
            "title": "Evidence draft",
            "text_content": "hello",
            "keystroke_array": [
                {
                    "key": "h",
                    "keyCode": 72,
                    "type": "keydown",
                    "timestamp": 1_785_280_000_000,
                    "documentLength": 1,
                    "cursorPosition": 1,
                }
            ],
            "stats": {
                "wpm": 10,
                "keystrokes": 1,
                "deletions": 0,
                "pauses": 0,
                "avgIki": 0,
                "sessionSeconds": 1,
            },
            "active_duration_ms": 1000,
        }
    )


class SessionRouteCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_idempotent_lookup_returns_none_for_new_submission(self) -> None:
        result = await session_routes._load_idempotent_response(
            db=SequenceAsyncSession([None]),
            user_id="student-a",
            submission_id="submission-coverage-000000000001",
            expected_evidence_hash="hash-a",
        )
        self.assertIsNone(result)

    async def test_idempotent_lookup_rejects_reused_identifier_for_different_evidence(self) -> None:
        session = SimpleNamespace(evidence_hash="hash-old")
        with self.assertRaises(HTTPException) as raised:
            await session_routes._load_idempotent_response(
                db=SequenceAsyncSession([session]),
                user_id="student-a",
                submission_id="submission-coverage-000000000001",
                expected_evidence_hash="hash-new",
            )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("different evidence", raised.exception.detail)

    async def test_idempotent_lookup_rejects_incomplete_certificate_transaction(self) -> None:
        session = SimpleNamespace(id=41, evidence_hash="hash-a")
        with self.assertRaises(HTTPException) as raised:
            await session_routes._load_idempotent_response(
                db=SequenceAsyncSession([session, None]),
                user_id="student-a",
                submission_id="submission-coverage-000000000001",
                expected_evidence_hash="hash-a",
            )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("certificate transaction is incomplete", raised.exception.detail)

    async def test_load_owned_draft_handles_no_identifier_success_and_missing(self) -> None:
        self.assertIsNone(
            await session_routes._load_owned_draft(
                db=SequenceAsyncSession(), user_id="student-a", draft_id=None
            )
        )
        draft = SimpleNamespace(id="draft-1")
        self.assertIs(
            await session_routes._load_owned_draft(
                db=SequenceAsyncSession([draft]), user_id="student-a", draft_id="local-1"
            ),
            draft,
        )
        with self.assertRaises(HTTPException) as raised:
            await session_routes._load_owned_draft(
                db=SequenceAsyncSession([None]), user_id="student-a", draft_id="missing"
            )
        self.assertEqual(raised.exception.status_code, 404)

    def test_draft_submission_guard_rejects_already_submitted_and_malformed_evidence(self) -> None:
        payload = valid_payload()
        already = SimpleNamespace(submitted_session_id=99)
        with self.assertRaises(HTTPException) as submitted:
            session_routes._verify_draft_matches_submission(
                draft=already,
                payload=payload,
                user_id="student-a",
                submission_evidence_hash="hash-a",
            )
        self.assertEqual(submitted.exception.status_code, 409)

        malformed = SimpleNamespace(
            submitted_session_id=None,
            title="Draft",
            text_content=encrypt_text("hello"),
            keystroke_array=encrypt_json({"not": "a list"}),
            active_duration_ms=1000,
        )
        with self.assertRaises(HTTPException) as invalid:
            session_routes._verify_draft_matches_submission(
                draft=malformed,
                payload=payload,
                user_id="student-a",
                submission_evidence_hash="hash-a",
            )
        self.assertEqual(invalid.exception.status_code, 409)
        self.assertIn("malformed", invalid.exception.detail)

    def test_draft_submission_guard_accepts_matching_hash_and_rejects_stale_hash(self) -> None:
        payload = valid_payload()
        draft = SimpleNamespace(
            submitted_session_id=None,
            title="Evidence draft",
            text_content=encrypt_text("hello"),
            keystroke_array=encrypt_json(
                [
                    {
                        "key": "h",
                        "keyCode": 72,
                        "type": "keydown",
                        "timestamp": 1_785_280_000_000,
                        "documentLength": 1,
                        "cursorPosition": 1,
                    }
                ]
            ),
            active_duration_ms=1000,
        )
        canonical = SimpleNamespace(evidence_hash="hash-match")
        with patch.object(session_routes, "compute_canonical_evidence", return_value=canonical):
            session_routes._verify_draft_matches_submission(
                draft=draft,
                payload=payload,
                user_id="student-a",
                submission_evidence_hash="hash-match",
            )
            with self.assertRaises(HTTPException) as stale:
                session_routes._verify_draft_matches_submission(
                    draft=draft,
                    payload=payload,
                    user_id="student-a",
                    submission_evidence_hash="hash-new",
                )
        self.assertEqual(stale.exception.status_code, 409)
        self.assertIn("no longer matches", stale.exception.detail)

    def test_store_analysis_response_preserves_existing_metadata(self) -> None:
        session = SimpleNamespace(evidence_metadata={"source": "existing"})
        response = SimpleNamespace(model_dump=lambda mode="json": {"classification": "HUMAN"})
        session_routes._store_analysis_response(session, response)
        self.assertEqual(session.evidence_metadata["source"], "existing")
        self.assertEqual(session.evidence_metadata["analysis_response"]["classification"], "HUMAN")


if __name__ == "__main__":
    unittest.main(verbosity=2)
