from __future__ import annotations

import io
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes import certificates


def _record(**overrides):
    base = {
        "session_id": 42,
        "user_id": "student-1",
        "teacher_id": "teacher-1",
        "course_id": 9,
        "title": "Evidence Contract",
        "student_name": "Student Example",
        "student_id": "ST-001",
        "university_name": "Example University",
        "department": "Computing",
        "course_name": "Secure Systems",
        "course_code": "SEC401",
        "word_count": 120,
        "wpm": 42.5,
        "total_keystrokes": 620,
        "deletions": 18,
        "pauses": 6,
        "avg_iki": 180.0,
        "duration_seconds": 185.0,
        "classification": "HUMAN",
        "classification_label": "Human",
        "confidence": 94.0,
        "risk_level": "LOW",
        "review_status": "APPROVED",
        "certificate_id": "TT-QUALITY-001",
        "document_hash": "d" * 64,
        "evidence_hash": "e" * 64,
        "model_version": "test-model",
        "model_score": 0.94,
        "decision_source": "MODEL",
        "model_available": True,
        "degraded_analysis": False,
        "created_at": "2026-08-13 07:00 UTC",
        "generated_at": "2026-08-13 07:01 UTC",
        "ledger_status": "VALID",
        "verification_notes": "",
        "signed_payload_hash": "a" * 64,
        "signature": "sig",
        "signature_algorithm": "ED25519",
        "signing_key_id": "test-key",
        "signed_at": "2026-08-13 07:01 UTC",
        "verification_status": "VALID",
        "revoked_at": None,
        "revocation_reason": None,
        "status": "VALID",
    }
    base.update(overrides)
    return base


class CertificateContractTests(unittest.TestCase):
    def test_certificate_id_validation_trims_and_rejects_invalid_shapes(self):
        self.assertEqual(
            certificates._validate_certificate_id("  TT-QUALITY-001  "),
            "TT-QUALITY-001",
        )

        for value in ("bad id", "x", "!" * 12, "a" * 81):
            with self.subTest(value=value):
                with self.assertRaises(HTTPException) as ctx:
                    certificates._validate_certificate_id(value)
                self.assertEqual(ctx.exception.status_code, 400)

    def test_display_helpers_cover_public_status_variants(self):
        self.assertEqual(certificates._format_datetime(None), "Unknown")
        self.assertEqual(
            certificates._format_datetime(
                datetime(2026, 8, 13, 7, 30, tzinfo=timezone.utc)
            ),
            "2026-08-13 07:30 UTC",
        )
        self.assertEqual(certificates._format_datetime("already formatted"), "already formatted")

        expected_labels = {
            "HUMAN": "Human",
            "SUSPICIOUS": "Review Required",
            "AI": "High Risk",
            "SYNTHETIC": "High Risk",
            None: "Unknown",
        }
        for value, expected in expected_labels.items():
            with self.subTest(value=value):
                self.assertEqual(certificates._classification_label(value), expected)

        self.assertEqual(certificates._certificate_status("HUMAN", "LOW"), "VALID")
        self.assertEqual(
            certificates._certificate_status("SUSPICIOUS", "LOW"),
            "REVIEW_REQUIRED",
        )
        self.assertEqual(
            certificates._certificate_status("HUMAN", "MEDIUM"),
            "REVIEW_REQUIRED",
        )
        self.assertEqual(certificates._certificate_status("AI", "HIGH"), "HIGH_RISK")

        self.assertIn("no review", certificates._review_outcome("NOT_APPLICABLE").lower())
        self.assertEqual(certificates._review_outcome("APPROVED"), "Accepted by teacher")
        self.assertIn("Flagged", certificates._review_outcome("FLAGGED"))
        self.assertIn("Discussion", certificates._review_outcome("NEEDS_DISCUSSION"))
        self.assertIn("Awaiting", certificates._review_outcome(None))

    def test_ledger_status_fails_closed_and_honors_revocation(self):
        self.assertEqual(
            certificates._ledger_display_status(
                ledger_status="VALID",
                classification="HUMAN",
                risk_level="LOW",
                revoked_at=None,
            ),
            "VALID",
        )
        self.assertEqual(
            certificates._ledger_display_status(
                ledger_status="VALID_LEGACY",
                classification="HUMAN",
                risk_level="LOW",
                revoked_at=None,
            ),
            "LEGACY_UNSIGNED",
        )
        self.assertEqual(
            certificates._ledger_display_status(
                ledger_status="anything",
                classification="HUMAN",
                risk_level="LOW",
                revoked_at="now",
            ),
            "REVOKED",
        )
        self.assertEqual(
            certificates._ledger_display_status(
                ledger_status=None,
                classification="SUSPICIOUS",
                risk_level="MEDIUM",
                revoked_at=None,
            ),
            "REVIEW_REQUIRED",
        )

    def test_certificate_audit_authorization_is_role_and_owner_scoped(self):
        record = _record()
        certificates._authorize_certificate_audit(
            record,
            SimpleNamespace(role="STUDENT", id="student-1"),
        )
        certificates._authorize_certificate_audit(
            record,
            SimpleNamespace(role="TEACHER", id="teacher-1"),
        )

        for user in (
            SimpleNamespace(role="STUDENT", id="other"),
            SimpleNamespace(role="TEACHER", id="other"),
            SimpleNamespace(role="ADMIN", id="teacher-1"),
        ):
            with self.subTest(role=user.role):
                with self.assertRaises(HTTPException) as ctx:
                    certificates._authorize_certificate_audit(record, user)
                self.assertEqual(ctx.exception.status_code, 403)

    def test_public_timeline_reports_signature_review_and_revocation_states(self):
        signature = SimpleNamespace(
            valid=True,
            status="VALID",
            reason="Signature verified.",
        )
        timeline = certificates._certificate_audit_timeline(_record(), signature)
        labels = [entry["label"] for entry in timeline]
        self.assertIn("Writing session recorded", labels)
        self.assertIn("Document hash sealed", labels)
        self.assertIn("Certificate ledger signed", labels)
        self.assertIn("Public verification checked", labels)
        self.assertIn("Teacher review outcome recorded", labels)

        revoked = certificates._certificate_audit_timeline(
            _record(revoked_at="2026-08-13 08:00 UTC", revocation_reason="Superseded"),
            signature,
        )
        self.assertEqual(revoked[-1]["label"], "Certificate revoked")
        self.assertEqual(revoked[-1]["description"], "Superseded")

        legacy = certificates._certificate_audit_timeline(
            _record(signed_payload_hash=None, signature_algorithm="UNSIGNED_LEGACY"),
            SimpleNamespace(
                valid=False,
                status="VALID_LEGACY",
                reason="Legacy unsigned record.",
            ),
        )
        self.assertIn(
            "Legacy unsigned certificate",
            [entry["label"] for entry in legacy],
        )

    def test_public_payload_preserves_privacy_and_integrity_fields(self):
        signature = SimpleNamespace(
            valid=True,
            status="VALID",
            signature_valid=True,
            payload_hash_matches=True,
            reason="Signature verified.",
        )
        public_state = SimpleNamespace(
            record_found=True,
            ledger_verified=True,
            certificate_active=True,
            compatibility_valid=True,
            status="VALID",
        )

        with (
            patch.object(certificates, "verify_certificate_record", return_value=signature),
            patch.object(
                certificates,
                "resolve_public_certificate_state",
                return_value=public_state,
            ),
            patch.object(
                certificates,
                "safe_public_certificate_identity",
                return_value={
                    "student_name": "Student Example",
                    "student_id": None,
                },
            ),
        ):
            payload = certificates._public_certificate_payload(_record(), request=None)

        self.assertTrue(payload["record_found"])
        self.assertTrue(payload["certificate_active"])
        self.assertEqual(payload["status"], "VALID")
        self.assertEqual(payload["student_name"], "Student Example")
        self.assertIsNone(payload["student_id"])
        self.assertFalse(payload["public_exposure"]["essay_text_exposed"])
        self.assertFalse(payload["public_exposure"]["raw_keystrokes_exposed"])
        self.assertIn("does not expose essay text", payload["privacy_notice"])

    def test_pdf_and_qr_helpers_generate_valid_binary_outputs(self):
        self.assertEqual(certificates._format_duration_pdf(59), "59s")
        self.assertEqual(certificates._format_duration_pdf(61), "1m 1s")
        self.assertEqual(certificates._format_duration_pdf(3661), "1h 1m 1s")
        self.assertEqual(certificates._format_duration_pdf("bad"), "Unknown")

        self.assertEqual(certificates._status_color("VALID"), certificates.PDF_SUCCESS)
        self.assertEqual(
            certificates._status_color("REVIEW_REQUIRED"),
            certificates.PDF_WARNING,
        )
        self.assertEqual(certificates._status_color("REVOKED"), certificates.PDF_DANGER)

        with patch.object(certificates, "_find_existing_asset", return_value=None):
            qr = certificates._build_branded_qr_image(
                "http://127.0.0.1:5174/verify/TT-QUALITY-001"
            )
        self.assertIsInstance(qr, io.BytesIO)
        self.assertTrue(qr.getvalue().startswith(b"\x89PNG"))

        record = _record(public_status="VALID")
        with patch.object(certificates, "_find_existing_asset", return_value=None):
            pdf = certificates._build_certificate_pdf(
                record,
                "http://127.0.0.1:5174/verify/TT-QUALITY-001",
            )
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1000)


if __name__ == "__main__":
    unittest.main()
