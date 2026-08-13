from __future__ import annotations

import hashlib
import hmac
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.services import certificate_signing as signing


FIXED_TIME = datetime(2026, 8, 12, 10, 30, tzinfo=timezone.utc)


def settings_stub(**overrides):
    values = {
        "CERTIFICATE_SIGNING_PRIVATE_KEY": "",
        "CERTIFICATE_SIGNING_PUBLIC_KEY": "",
        "CERTIFICATE_SIGNING_HMAC_SECRET": "contract-hmac-secret-0123456789abcdef",
        "SECRET_KEY": "contract-secret-key-0123456789-abcdef",
        "CERTIFICATE_SIGNING_KEY_ID": "contract-key-v1",
        "CERTIFICATE_ALLOW_HMAC_FALLBACK": True,
        "is_production": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def sample_payload():
    return signing.build_certificate_payload_from_values(
        certificate_id="TT-COVERAGE",
        session_id="12",
        user_id="student-1",
        course_id=9,
        document_hash="doc-hash",
        evidence_hash="evidence-hash",
        classification="human",
        risk_level="low",
        confidence_score="91.23456",
        model_version="model-v1",
        model_score="0.12345678",
        wpm="44.22222",
        duration_seconds=180.75,
        total_keystrokes="250",
        deletions=4,
        pauses=3,
        avg_iki=121.98765,
        signed_at=FIXED_TIME,
    )


class CertificateSigningTests(unittest.TestCase):
    def test_stable_helpers_and_payload_normalization(self) -> None:
        self.assertIsNone(signing.iso_datetime(None))
        self.assertEqual(
            signing.iso_datetime(datetime(2026, 8, 12, 10, 30)),
            "2026-08-12T10:30:00Z",
        )
        self.assertIsNone(signing.stable_round("not-a-number"))
        self.assertIsNone(signing.stable_round(float("nan")))
        self.assertEqual(signing.stable_int("12.9"), 12)
        self.assertEqual(signing.stable_int("bad"), 0)

        payload = sample_payload()
        self.assertEqual(payload["classification"], "HUMAN")
        self.assertEqual(payload["risk_level"], "LOW")
        self.assertEqual(payload["confidence_score"], 91.2346)
        self.assertEqual(payload["metrics"]["total_keystrokes"], 250)
        self.assertEqual(payload["signed_at"], "2026-08-12T10:30:00Z")
        self.assertEqual(
            signing.sha256_hex_json(payload),
            hashlib.sha256(signing.canonical_json_bytes(payload)).hexdigest(),
        )

    def test_build_record_prefers_raw_values_and_handles_invalid_datetime(self) -> None:
        record = {
            "certificate_id": "TT-COVERAGE",
            "session_id": 5,
            "user_id": "student-1",
            "course_id": None,
            "confidence": 91.2,
            "confidence_raw": 91.23456,
            "model_score": 0.1,
            "model_score_raw": 0.12345678,
            "wpm": 44.2,
            "wpm_raw": 44.22222,
            "duration_seconds": 181,
            "duration_seconds_raw": 180.75,
            "avg_iki": 122,
            "avg_iki_raw": 121.98765,
            "signed_at": "2026-08-12T10:30:00Z",
        }
        payload = signing.build_certificate_payload_from_record(record)
        self.assertEqual(payload["confidence_score"], 91.2346)
        self.assertEqual(payload["model_score"], 0.123457)
        self.assertEqual(payload["metrics"]["wpm"], 44.2222)

        with patch.object(signing, "utc_now", return_value=FIXED_TIME):
            invalid = signing.build_certificate_payload_from_record(
                {**record, "signed_at": "not-a-date"}
            )
        self.assertEqual(invalid["signed_at"], "2026-08-12T10:30:00Z")

    def test_hmac_signing_verification_and_tamper_detection(self) -> None:
        payload = sample_payload()
        stub = settings_stub()
        with patch.object(signing, "settings", stub):
            bundle = signing.sign_payload(payload)
            self.assertEqual(bundle.algorithm, signing.HMAC_ALGORITHM)
            self.assertEqual(bundle.signing_key_id, "contract-key-v1")

            valid = signing.verify_payload_signature(
                payload=payload,
                signed_payload_hash=bundle.payload_hash,
                signature=bundle.signature,
                algorithm=bundle.algorithm,
            )
            self.assertTrue(valid.valid)
            self.assertTrue(valid.signature_valid)

            tampered_hash = signing.verify_payload_signature(
                payload={**payload, "document_hash": "tampered"},
                signed_payload_hash=bundle.payload_hash,
                signature=bundle.signature,
                algorithm=bundle.algorithm,
            )
            self.assertEqual(tampered_hash.status, "INVALID_SIGNATURE")
            self.assertFalse(tampered_hash.payload_hash_matches)

            invalid_signature = signing.verify_payload_signature(
                payload=payload,
                signed_payload_hash=bundle.payload_hash,
                signature="bad-signature",
                algorithm=bundle.algorithm,
            )
            self.assertFalse(invalid_signature.valid)
            self.assertTrue(invalid_signature.payload_hash_matches)

    def test_ed25519_signing_verification_and_key_unavailable_path(self) -> None:
        private_key = Ed25519PrivateKey.generate()
        private_value = signing.private_key_b64(private_key)
        payload = sample_payload()

        with patch.object(
            signing,
            "settings",
            settings_stub(CERTIFICATE_SIGNING_PRIVATE_KEY=private_value),
        ):
            bundle = signing.sign_payload(payload)
            self.assertEqual(bundle.algorithm, signing.ED25519_ALGORITHM)
            self.assertIsNotNone(bundle.public_key)
            result = signing.verify_payload_signature(
                payload=payload,
                signed_payload_hash=bundle.payload_hash,
                signature=bundle.signature,
                algorithm=bundle.algorithm,
            )
            self.assertTrue(result.valid)

            bad = signing.verify_payload_signature(
                payload=payload,
                signed_payload_hash=bundle.payload_hash,
                signature="AA",
                algorithm=bundle.algorithm,
            )
            self.assertEqual(bad.status, "INVALID_SIGNATURE")

        with patch.object(
            signing,
            "settings",
            settings_stub(
                CERTIFICATE_SIGNING_PRIVATE_KEY="",
                CERTIFICATE_SIGNING_PUBLIC_KEY="",
            ),
        ):
            unavailable = signing.verify_payload_signature(
                payload=payload,
                signed_payload_hash=signing.sha256_hex_json(payload),
                signature="AA",
                algorithm=signing.ED25519_ALGORITHM,
            )
            self.assertEqual(unavailable.status, "SIGNATURE_KEY_UNAVAILABLE")

    def test_legacy_unsupported_and_signing_policy_fail_closed(self) -> None:
        payload = sample_payload()
        legacy = signing.verify_payload_signature(
            payload=payload,
            signed_payload_hash=None,
            signature=None,
            algorithm=None,
        )
        self.assertEqual(legacy.status, "VALID_LEGACY")

        unsupported = signing.verify_payload_signature(
            payload=payload,
            signed_payload_hash=signing.sha256_hex_json(payload),
            signature="present",
            algorithm="RSA-UNKNOWN",
        )
        self.assertEqual(unsupported.status, "INVALID_SIGNATURE")
        self.assertIn("Unsupported", unsupported.reason)

        with patch.object(
            signing,
            "settings",
            settings_stub(
                CERTIFICATE_ALLOW_HMAC_FALLBACK=False,
                CERTIFICATE_SIGNING_PRIVATE_KEY="",
            ),
        ):
            with self.assertRaisesRegex(ValueError, "private key is not configured"):
                signing.sign_payload(payload)

        with patch.object(
            signing,
            "settings",
            settings_stub(
                is_production=True,
                CERTIFICATE_ALLOW_HMAC_FALLBACK=False,
                CERTIFICATE_SIGNING_PRIVATE_KEY="",
            ),
        ):
            with self.assertRaisesRegex(ValueError, "Production certificate signing"):
                signing.sign_payload(payload)

    def test_sign_certificate_for_session_mutates_only_signature_fields(self) -> None:
        session = SimpleNamespace(
            id=7,
            user_id="student-7",
            course_id=3,
            document_hash="session-doc",
            evidence_hash="session-evidence",
            classification_result="HUMAN",
            risk_level="LOW",
            ml_confidence_score=94.5,
            model_version="model-v1",
            model_score=0.2,
            wpm=41.0,
            duration_seconds=240.0,
            total_keystrokes=300,
            deletions=8,
            pauses=4,
            avg_iki=132.0,
        )
        certificate = SimpleNamespace(
            certificate_id="TT-COVERAGE-7",
            document_hash="",
            evidence_hash="",
            signed_at=FIXED_TIME,
            signed_payload_hash=None,
            signature=None,
            signature_algorithm=None,
            signing_key_id=None,
        )

        with patch.object(signing, "settings", settings_stub()):
            bundle = signing.sign_certificate_for_session(session, certificate)

        self.assertEqual(certificate.signed_payload_hash, bundle.payload_hash)
        self.assertEqual(certificate.signature, bundle.signature)
        self.assertEqual(certificate.signature_algorithm, signing.HMAC_ALGORITHM)

        record = {
            **bundle.payload,
            "user_id": "student-7",
            "classification": "HUMAN",
            "risk_level": "LOW",
            "confidence_raw": 94.5,
            "model_score_raw": 0.2,
            "wpm_raw": 41.0,
            "duration_seconds_raw": 240.0,
            "avg_iki_raw": 132.0,
            "total_keystrokes": 300,
            "deletions": 8,
            "pauses": 4,
            "signed_at_raw": FIXED_TIME,
            "signed_payload_hash": bundle.payload_hash,
            "signature": bundle.signature,
            "signature_algorithm": bundle.algorithm,
        }
        with patch.object(signing, "settings", settings_stub()):
            verified = signing.verify_certificate_record(record)
        self.assertTrue(verified.valid)


if __name__ == "__main__":
    unittest.main(verbosity=2)
