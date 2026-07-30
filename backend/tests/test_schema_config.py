"""Configuration and request-schema validation tests."""

from __future__ import annotations

import unittest

from cryptography.fernet import Fernet
from pydantic import ValidationError

from app.core.config import Settings
from app.core.rate_limit import per_minute
from app.models.user import User
from app.schemas.user import (
    OTPVerify,
    PasswordResetConfirm,
    StudentRegister,
    TeacherRegister,
)


class ConfigurationContractTests(unittest.TestCase):
    def test_development_configuration_parses_origins_and_sync_url(self) -> None:
        config = Settings(
            _env_file=None,
            DATABASE_URL=(
                "postgresql+asyncpg://user:password@localhost/typetrace"
            ),
            SECRET_KEY="x" * 40,
            ALLOWED_ORIGINS=(
                "http://localhost:5173, http://127.0.0.1:5173"
            ),
        )

        self.assertEqual(
            config.cors_origins,
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
        )
        self.assertEqual(
            config.sync_database_url,
            "postgresql://user:password@localhost/typetrace",
        )
        self.assertTrue(config.api_docs_enabled)
        self.assertFalse(config.PUBLIC_CERTIFICATE_SHOW_STUDENT_NAME)

    def test_production_disables_docs_even_when_requested(self) -> None:
        config = Settings(
            _env_file=None,
            ENVIRONMENT="production",
            ENABLE_API_DOCS=True,
            SECRET_KEY="x" * 40,
            ENCRYPTION_MASTER_KEY=Fernet.generate_key().decode("utf-8"),
            RATE_LIMIT_STORAGE_URI="redis://localhost:6379/1",
            ALLOWED_ORIGINS="https://typetrace.example",
            CERTIFICATE_ALLOW_HMAC_FALLBACK=True,
            MAIL_USE_CREDENTIALS=False,
        )

        self.assertFalse(config.api_docs_enabled)
        self.assertTrue(config.is_production)

    def test_production_rejects_in_memory_rate_limit_storage(self) -> None:
        with self.assertRaises(ValidationError):
            Settings(
                _env_file=None,
                ENVIRONMENT="production",
                SECRET_KEY="x" * 40,
                ENCRYPTION_MASTER_KEY=Fernet.generate_key().decode("utf-8"),
                RATE_LIMIT_STORAGE_URI="memory://",
                ALLOWED_ORIGINS="https://typetrace.example",
            )

    def test_rate_limit_string_is_validated(self) -> None:
        self.assertEqual(per_minute(8), "8/minute")
        with self.assertRaises(ValueError):
            per_minute(0)


class UserSchemaContractTests(unittest.TestCase):
    def test_student_registration_sanitizes_names(self) -> None:
        payload = StudentRegister(
            first_name="  <b>Mohammed</b> ",
            last_name=" Simthass ",
            student_id="2540927",
            email="student@example.com",
            university_name=" University ",
            password="Password1!",
            consent=True,
        )

        self.assertEqual(payload.first_name, "Mohammed")
        self.assertEqual(payload.last_name, "Simthass")
        self.assertEqual(payload.student_id, "2540927")
        self.assertEqual(payload.university_name, "University")

    def test_student_registration_requires_consent(self) -> None:
        with self.assertRaises(ValidationError):
            StudentRegister(
                first_name="Test",
                last_name="Student",
                student_id="2540927",
                email="student@example.com",
                password="Password1!",
                consent=False,
            )

    def test_teacher_registration_requires_department(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherRegister(
                first_name="Test",
                last_name="Teacher",
                email="teacher@example.com",
                university_name="University",
                department=" ",
                password="Password1!",
                consent=True,
            )

    def test_otp_requires_exactly_six_digits(self) -> None:
        self.assertEqual(
            OTPVerify(
                registration_id="reg_" + "A" * 64,
                otp="123456",
            ).otp,
            "123456",
        )
        with self.assertRaises(ValidationError):
            OTPVerify(
                registration_id="reg_" + "A" * 64,
                otp="12345",
            )

    def test_user_verification_defaults_fail_closed(self) -> None:
        column = User.__table__.c.is_verified
        self.assertIsNotNone(column.default)
        self.assertFalse(bool(column.default.arg))
        self.assertIsNotNone(column.server_default)
        self.assertIn("false", str(column.server_default.arg).lower())

    def test_reset_password_uses_same_strength_contract(self) -> None:
        with self.assertRaises(ValidationError):
            PasswordResetConfirm(
                reset_token="x" * 80,
                new_password="weakpass",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
