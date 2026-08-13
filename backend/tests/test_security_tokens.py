from __future__ import annotations

import unittest
from datetime import timedelta
from unittest.mock import patch

from jose import JWTError, jwt

from app.core import jwt as jwt_service
from app.core import security


class SecurityAndTokenTests(unittest.TestCase):
    def test_password_policy_and_hash_round_trip(self) -> None:
        for weak in ("short1", "abcdefgh", "12345678", "x" * 129 + "1"):
            with self.assertRaises(ValueError):
                security.validate_password_strength(weak)

        value = "AcademicEvidence2026"
        hashed = security.get_password_hash(value)
        self.assertNotEqual(hashed, value)
        self.assertTrue(security.verify_password(value, hashed))
        self.assertFalse(security.verify_password("wrong-password", hashed))
        self.assertFalse(security.verify_password("", hashed))
        self.assertFalse(security.verify_password(value, "not-a-bcrypt-hash"))

    def test_otp_helpers_and_email_redaction(self) -> None:
        otp = security.generate_otp()
        self.assertRegex(otp, r"^\d{6}$")
        self.assertTrue(security.is_valid_otp_format(f" {otp} "))
        self.assertFalse(security.is_valid_otp_format("12345"))
        self.assertTrue(security.secure_compare("123456", "123456"))
        self.assertFalse(security.secure_compare("123456", "654321"))
        self.assertEqual(security.redact_email("invalid"), "***")
        self.assertEqual(security.redact_email("a@example.com"), "a***@example.com")
        self.assertEqual(security.redact_email("alice@example.com"), "al***@example.com")

    def test_access_token_contains_required_type_and_is_decodable(self) -> None:
        token = jwt_service.create_access_token(
            {"sub": "student@example.com", "id": "student-1"},
            expires_delta=timedelta(minutes=5),
        )
        payload = jwt_service.decode_access_token(token)

        self.assertEqual(payload["sub"], "student@example.com")
        self.assertEqual(payload["id"], "student-1")
        self.assertEqual(payload["type"], "access")
        self.assertEqual(payload["iss"], jwt_service.settings.JWT_ISSUER)
        self.assertTrue(payload["jti"])

    def test_reset_token_requires_reset_type_and_identity_fields(self) -> None:
        token, token_jti = jwt_service.create_reset_token(
            "student@example.com",
            user_id="student-1",
            reset_id="rst_test",
            jti="fixed-jti",
        )
        payload = jwt_service.decode_reset_token(token)

        self.assertEqual(token_jti, "fixed-jti")
        self.assertEqual(payload["jti"], "fixed-jti")
        self.assertEqual(payload["reset_id"], "rst_test")
        self.assertEqual(payload["type"], "password_reset")

        with self.assertRaises(JWTError):
            jwt_service.decode_access_token(token)

    def test_reset_decoder_rejects_incomplete_payload(self) -> None:
        raw = jwt.encode(
            {
                "sub": "student@example.com",
                "type": "password_reset",
                "iss": jwt_service.settings.JWT_ISSUER,
            },
            jwt_service.SECRET_KEY,
            algorithm=jwt_service.ALGORITHM,
        )

        with self.assertRaises(JWTError):
            jwt_service.decode_reset_token(raw)


if __name__ == "__main__":
    unittest.main(verbosity=2)
