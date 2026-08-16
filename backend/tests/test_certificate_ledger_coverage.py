from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.api.routes import certificates as routes
from app.repositories import certificates as repository


class _MappingsResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def mappings(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


def _record(**overrides):
    base = {
        "certificate_id": "TT-COVERAGE-ABC123",
        "session_id": 41,
        "user_id": "student-1",
        "teacher_id": "teacher-1",
        "course_id": 8,
        "title": "Certificate coverage essay",
        "student_name": "Grace Hopper",
        "student_id": "STU-1",
        "university_name": "Example University",
        "department": "Computing",
        "course_name": "Secure Systems",
        "course_code": "SEC401",
        "word_count": 420,
        "wpm": 47.5,
        "total_keystrokes": 1800,
        "deletions": 28,
        "pauses": 14,
        "avg_iki": 168.2,
        "duration_seconds": 540.0,
        "classification": "HUMAN",
        "classification_label": "Human",
        "confidence": 93.5,
        "risk_level": "LOW",
        "review_status": "APPROVED",
        "document_hash": "a" * 64,
        "evidence_hash": "b" * 64,
        "created_at": "2026-08-16 06:00 UTC",
        "generated_at": "2026-08-16 06:01 UTC",
        "ledger_status": "VALID",
        "signature_algorithm": "ED25519",
        "signing_key_id": "key-1",
        "signed_at": "2026-08-16 06:01 UTC",
        "signed_payload_hash": "c" * 64,
        "signature": "signature",
        "revoked_at": None,
        "revocation_reason": None,
        "decision_source": "MODEL_FUSION",
        "model_available": True,
        "degraded_analysis": False,
    }
    base.update(overrides)
    return base


class CertificateRepositoryCoverageTests(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_certificate_record_row_returns_mapping_and_binds_identifier(self):
        db = SimpleNamespace(execute=AsyncMock(return_value=_MappingsResult([{"certificate_id": "TT-1", "session_id": 9}])))
        row = await repository.fetch_certificate_record_row(db, certificate_id="TT-1")
        self.assertEqual(row, {"certificate_id": "TT-1", "session_id": 9})
        query, params = db.execute.await_args.args
        self.assertIn("WHERE ts.certificate_id = :certificate_id", str(query))
        self.assertEqual(params, {"certificate_id": "TT-1"})

    async def test_fetch_certificate_record_row_returns_none_for_missing_record(self):
        db = SimpleNamespace(execute=AsyncMock(return_value=_MappingsResult([])))
        self.assertIsNone(await repository.fetch_certificate_record_row(db, certificate_id="TT-MISSING"))

    async def test_list_and_owned_certificate_helpers_preserve_database_scope(self):
        list_db = SimpleNamespace(execute=AsyncMock(return_value=_MappingsResult([
            {"certificate_id": "TT-2"}, {"certificate_id": "TT-1"}
        ])))
        self.assertEqual(
            await repository.list_user_certificate_ids(list_db, user_id="student-1"),
            ["TT-2", "TT-1"],
        )
        query, params = list_db.execute.await_args.args
        self.assertIn("user_id = :user_id", str(query))
        self.assertEqual(params["user_id"], "student-1")

        owned_db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult("TT-9")))
        self.assertEqual(
            await repository.fetch_owned_session_certificate_id(
                owned_db, session_id=9, user_id="student-1"
            ),
            "TT-9",
        )
        missing_db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(None)))
        self.assertIsNone(
            await repository.fetch_owned_session_certificate_id(
                missing_db, session_id=10, user_id="student-1"
            )
        )

    async def test_revocation_lock_returns_dict_or_none(self):
        db = SimpleNamespace(execute=AsyncMock(return_value=_MappingsResult([
            {"certificate_id": "TT-LOCK", "verification_status": "VALID", "session_id": 4}
        ])))
        row = await repository.lock_certificate_for_revocation(db, certificate_id="TT-LOCK")
        self.assertEqual(row["certificate_id"], "TT-LOCK")
        query, params = db.execute.await_args.args
        self.assertIn("FOR UPDATE OF cert", str(query))
        self.assertEqual(params["certificate_id"], "TT-LOCK")

        missing = SimpleNamespace(execute=AsyncMock(return_value=_MappingsResult([])))
        self.assertIsNone(await repository.lock_certificate_for_revocation(missing, certificate_id="TT-X"))


class CertificateLedgerHelperCoverageTests(unittest.IsolatedAsyncioTestCase):
    def test_identifier_datetime_and_classification_helpers_cover_boundary_states(self):
        self.assertEqual(routes._validate_certificate_id("  TT-ABC123  "), "TT-ABC123")
        with self.assertRaises(HTTPException) as caught:
            routes._validate_certificate_id("invalid id !")
        self.assertEqual(caught.exception.status_code, 400)

        self.assertEqual(routes._format_datetime(None), "Unknown")
        rendered = routes._format_datetime(datetime(2026, 8, 16, 6, tzinfo=timezone.utc))
        self.assertEqual(rendered, "2026-08-16 06:00 UTC")
        self.assertEqual(routes._format_datetime("already formatted"), "already formatted")

        self.assertEqual(routes._classification_label("human"), "Human")
        self.assertEqual(routes._classification_label("suspicious"), "Review Required")
        self.assertEqual(routes._classification_label("AI-GENERATED"), "High Risk")
        self.assertEqual(routes._classification_label("other"), "Unknown")

    def test_certificate_and_review_status_helpers_cover_every_public_bucket(self):
        self.assertEqual(routes._certificate_status("HUMAN", "LOW"), "VALID")
        self.assertEqual(routes._certificate_status("SUSPICIOUS", "LOW"), "REVIEW_REQUIRED")
        self.assertEqual(routes._certificate_status("HUMAN", "MEDIUM"), "REVIEW_REQUIRED")
        self.assertEqual(routes._certificate_status("SYNTHETIC", "HIGH"), "HIGH_RISK")

        expected = {
            "NOT_APPLICABLE": "Personal session — no review required",
            "APPROVED": "Accepted by teacher",
            "FLAGGED": "Flagged for academic review",
            "NEEDS_DISCUSSION": "Discussion requested",
            "PENDING": "Awaiting teacher review",
        }
        for value, label in expected.items():
            self.assertEqual(routes._review_outcome(value), label)

    def test_ledger_display_status_prioritizes_revocation_and_signature_state(self):
        cases = [
            ({"ledger_status": "VALID", "classification": "HUMAN", "risk_level": "LOW", "revoked_at": "now"}, "REVOKED"),
            ({"ledger_status": "VALID_LEGACY", "classification": "HUMAN", "risk_level": "LOW", "revoked_at": None}, "LEGACY_UNSIGNED"),
            ({"ledger_status": "REVOKED", "classification": "HUMAN", "risk_level": "LOW", "revoked_at": None}, "REVOKED"),
            ({"ledger_status": "INVALID_SIGNATURE", "classification": "HUMAN", "risk_level": "LOW", "revoked_at": None}, "INVALID_SIGNATURE"),
            ({"ledger_status": "VALID", "classification": "SUSPICIOUS", "risk_level": "MEDIUM", "revoked_at": None}, "VALID"),
            ({"ledger_status": "HIGH_RISK", "classification": "SYNTHETIC", "risk_level": "HIGH", "revoked_at": None}, "REVIEW_REQUIRED"),
            ({"ledger_status": None, "classification": "HUMAN", "risk_level": "LOW", "revoked_at": None}, "VALID"),
            ({"ledger_status": None, "classification": "SUSPICIOUS", "risk_level": "MEDIUM", "revoked_at": None}, "REVIEW_REQUIRED"),
        ]
        for kwargs, expected in cases:
            self.assertEqual(routes._ledger_display_status(**kwargs), expected)

    def test_audit_authorization_allows_only_record_owner_or_course_teacher(self):
        record = _record()
        routes._authorize_certificate_audit(record, SimpleNamespace(id="student-1", role="STUDENT"))
        routes._authorize_certificate_audit(record, SimpleNamespace(id="teacher-1", role="TEACHER"))

        for user in (
            SimpleNamespace(id="student-2", role="STUDENT"),
            SimpleNamespace(id="teacher-2", role="TEACHER"),
            SimpleNamespace(id="admin-1", role="ADMIN"),
        ):
            with self.assertRaises(HTTPException) as caught:
                routes._authorize_certificate_audit(record, user)
            self.assertEqual(caught.exception.status_code, 403)

    def test_audit_timeline_handles_signed_legacy_reviewed_and_revoked_records(self):
        signed_result = SimpleNamespace(valid=True, status="VALID", reason="Signature verified")
        timeline = routes._certificate_audit_timeline(_record(revoked_at="2026-08-17", revocation_reason="Superseded"), signed_result)
        labels = [item["label"] for item in timeline]
        self.assertIn("Writing session recorded", labels)
        self.assertIn("Document hash sealed", labels)
        self.assertIn("Certificate ledger signed", labels)
        self.assertIn("Teacher review outcome recorded", labels)
        self.assertIn("Certificate revoked", labels)

        legacy_result = SimpleNamespace(valid=False, status="VALID_LEGACY", reason="Legacy record")
        legacy = routes._certificate_audit_timeline(
            _record(document_hash=None, signed_payload_hash=None, review_status="PENDING"),
            legacy_result,
        )
        legacy_labels = [item["label"] for item in legacy]
        self.assertIn("Legacy unsigned certificate", legacy_labels)
        self.assertNotIn("Teacher review outcome recorded", legacy_labels)

    def test_public_payload_is_privacy_safe_and_exposes_signature_state(self):
        signature = SimpleNamespace(
            valid=True,
            status="VALID",
            signature_valid=True,
            payload_hash_matches=True,
            reason="Signature verified",
        )
        state = SimpleNamespace(
            record_found=True,
            ledger_verified=True,
            certificate_active=True,
            compatibility_valid=True,
            status="VALID",
        )
        with (
            patch.object(routes, "verify_certificate_record", return_value=signature),
            patch.object(routes, "safe_public_certificate_identity", return_value={"student_name": "G. H.", "student_id": "STU-***"}),
            patch.object(routes, "resolve_public_certificate_state", return_value=state),
        ):
            payload = routes._public_certificate_payload(_record(), None)

        self.assertTrue(payload["certificate_active"])
        self.assertEqual(payload["student_name"], "G. H.")
        self.assertEqual(payload["signature_status"], "VALID")
        self.assertFalse(payload["public_exposure"]["essay_text_exposed"])
        self.assertFalse(payload["public_exposure"]["raw_keystrokes_exposed"])
        self.assertIn("does not expose essay text", payload["privacy_notice"])

    def test_pdf_projection_redacts_identity_using_pdf_policy(self):
        with patch.object(
            routes,
            "safe_public_certificate_identity",
            return_value={"student_name": "Student", "student_id": "Hidden"},
        ):
            safe = routes._pdf_public_record(_record())
        self.assertEqual(safe["student_name"], "Student")
        self.assertEqual(safe["student_id"], "Hidden")
        self.assertEqual(safe["certificate_id"], "TT-COVERAGE-ABC123")

    async def test_safe_notification_cache_update_is_best_effort(self):
        success = AsyncMock()
        with patch.object(routes, "bump_unread_cache", success):
            await routes._safe_bump_unread_cache("student-1")
        success.assert_awaited_once_with(recipient_id="student-1")

        failure = AsyncMock(side_effect=RuntimeError("redis down"))
        with patch.object(routes, "bump_unread_cache", failure):
            await routes._safe_bump_unread_cache("student-1")
        failure.assert_awaited_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
