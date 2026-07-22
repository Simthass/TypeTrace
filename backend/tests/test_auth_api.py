"""HTTP-level authentication contract tests using isolated dependencies."""

from __future__ import annotations

import unittest
from contextlib import ExitStack
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes.auth import router as auth_router
from app.core.rate_limit import limiter
from app.db.database import get_db
from tests.helpers import FakeAsyncSession, make_user


class AuthenticationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = FastAPI()
        self.app.state.limiter = limiter
        self.app.add_exception_handler(
            RateLimitExceeded,
            _rate_limit_exceeded_handler,
        )
        self.app.include_router(auth_router, prefix="/api/v1/auth")
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        self.client.close()

    def override_database(self, session: FakeAsyncSession) -> None:
        async def _override():
            yield session

        self.app.dependency_overrides[get_db] = _override

    def test_registration_rejects_unknown_role_before_database_access(self) -> None:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "role": "ADMIN",
                "first_name": "Test",
                "last_name": "User",
                "email": "test@example.com",
                "password": "Password1!",
                "consent": True,
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["detail"],
            "Role must be STUDENT or TEACHER.",
        )

    def test_student_registration_enforces_password_contract(self) -> None:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "role": "STUDENT",
                "first_name": "Test",
                "last_name": "User",
                "student_id": "2540927",
                "email": "student@example.com",
                "university_name": "University",
                "password": "weakpass",
                "consent": True,
            },
        )

        self.assertEqual(response.status_code, 422)
        detail = str(response.json()["detail"])
        self.assertIn("Password must contain at least one number.", detail)
        self.assertNotIn("weakpass", detail)
        self.assertNotIn("ValueError", detail)

    def test_login_returns_token_and_normalized_user(self) -> None:
        user = make_user()
        self.override_database(FakeAsyncSession([user]))

        with ExitStack() as stack:
            verify_password = stack.enter_context(
                patch(
                    "app.api.routes.auth.verify_password",
                    return_value=True,
                )
            )
            create_token = stack.enter_context(
                patch(
                    "app.api.routes.auth.create_access_token",
                    return_value="signed-test-token",
                )
            )

            response = self.client.post(
                "/api/v1/auth/login",
                json={
                    "email": "STUDENT@EXAMPLE.COM",
                    "password": "Password1!",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["access_token"], "signed-test-token")
        self.assertEqual(payload["token_type"], "bearer")
        self.assertEqual(payload["user"]["role"], "STUDENT")
        self.assertEqual(payload["user"]["id"], "user-1")
        verify_password.assert_called_once_with(
            "Password1!",
            "stored-password-hash",
        )
        create_token.assert_called_once()

    def test_login_rejects_invalid_credentials(self) -> None:
        user = make_user()
        self.override_database(FakeAsyncSession([user]))

        with patch(
            "app.api.routes.auth.verify_password",
            return_value=False,
        ):
            response = self.client.post(
                "/api/v1/auth/login",
                json={
                    "email": "student@example.com",
                    "password": "WrongPassword1!",
                },
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid credentials.")

    def test_login_rejects_unverified_account(self) -> None:
        user = make_user(verified=False)
        self.override_database(FakeAsyncSession([user]))

        with patch(
            "app.api.routes.auth.verify_password",
            return_value=True,
        ):
            response = self.client.post(
                "/api/v1/auth/login",
                json={
                    "email": "student@example.com",
                    "password": "Password1!",
                },
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Account is not verified.",
        )

    def test_password_reset_request_does_not_reveal_missing_account(self) -> None:
        self.override_database(FakeAsyncSession([None]))

        response = self.client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": "missing@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["message"],
            "If that email exists, a reset code has been sent.",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
