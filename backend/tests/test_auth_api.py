"""HTTP-level authentication and account-lifecycle regression tests."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes.auth import router as auth_router
from app.core.rate_limit import limiter
from app.db.database import get_db
from app.services.email import EmailDeliveryError
from tests.helpers import FakeAsyncSession, make_user


REGISTRATION_ID = "reg_" + "A" * 64
RESET_ID = "rst_" + "B" * 64


def pending_registration() -> dict[str, object]:
    return {
        "registration_id": REGISTRATION_ID,
        "role": "STUDENT",
        "first_name": "Test",
        "last_name": "User",
        "email": "student@example.com",
        "hashed_password": "stored-password-hash",
        "student_id": "2540927",
        "university_name": "University of Bedfordshire",
        "department": None,
        "otp_hash": "otp-hash",
        "attempt_count": 0,
        "resend_count": 0,
        "consent_accepted_at": datetime.now(timezone.utc).isoformat(),
        "consent_policy_version": "typetrace-consent-v1",
        "consent_source": "web_registration",
        "state": "CLAIMED",
    }


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

    def test_registration_rejects_unknown_role(self) -> None:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "role": "ADMIN",
                "first_name": "Test",
                "last_name": "User",
                "email": "test@example.com",
                "password": "Password1",
                "consent": True,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_registration_rejects_json_array_without_500(self) -> None:
        response = self.client.post("/api/v1/auth/register", json=[])
        self.assertEqual(response.status_code, 422)

    def test_registration_stores_only_pending_state_before_otp(self) -> None:
        db = FakeAsyncSession([None, None])
        self.override_database(db)
        create_pending = AsyncMock(
            return_value={"registration_id": REGISTRATION_ID}
        )
        send_email = AsyncMock(return_value=None)

        with (
            patch(
                "app.api.routes.auth.redis_cache.create_pending_registration",
                create_pending,
            ),
            patch("app.api.routes.auth.send_otp_email", send_email),
            patch(
                "app.api.routes.auth.get_password_hash",
                return_value="stored-password-hash",
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/register",
                json={
                    "role": "STUDENT",
                    "first_name": "Test",
                    "last_name": "User",
                    "student_id": "2540927",
                    "email": "student@example.com",
                    "university_name": "University",
                    "password": "Password1",
                    "consent": True,
                },
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["registration_id"], REGISTRATION_ID)
        self.assertEqual(db.added, [])
        self.assertEqual(db.commits, 0)
        create_pending.assert_awaited_once()
        send_email.assert_awaited_once()
        action_url = send_email.call_args.kwargs["action_url"]
        self.assertIn("/verify-otp#registration_id=", action_url)
        self.assertIn(REGISTRATION_ID, action_url)

    def test_registration_email_failure_removes_pending_state(self) -> None:
        db = FakeAsyncSession([None, None])
        self.override_database(db)
        cancel = AsyncMock(return_value={"status": "CANCELLED"})
        send_email = AsyncMock(side_effect=EmailDeliveryError("delivery failed"))

        with (
            patch(
                "app.api.routes.auth.redis_cache.create_pending_registration",
                AsyncMock(return_value={"registration_id": REGISTRATION_ID}),
            ),
            patch(
                "app.api.routes.auth.redis_cache.cancel_pending_registration",
                cancel,
            ),
            patch(
                "app.api.routes.auth.send_otp_email",
                send_email,
            ),
            patch(
                "app.api.routes.auth.get_password_hash",
                return_value="stored-password-hash",
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/register",
                json={
                    "role": "STUDENT",
                    "first_name": "Test",
                    "last_name": "User",
                    "student_id": "2540927",
                    "email": "student@example.com",
                    "password": "Password1",
                    "consent": True,
                },
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(db.added, [])
        cancel.assert_awaited_once_with(REGISTRATION_ID)

    def test_wrong_otp_creates_no_user(self) -> None:
        db = FakeAsyncSession([None])
        self.override_database(db)
        with patch(
            "app.api.routes.auth.redis_cache.claim_registration",
            AsyncMock(return_value={"status": "INVALID", "attempts": 1}),
        ):
            response = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"registration_id": REGISTRATION_ID, "otp": "123456"},
            )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(db.added, [])
        self.assertEqual(db.commits, 0)

    def test_correct_otp_creates_one_verified_user_and_persists_consent(self) -> None:
        db = FakeAsyncSession([None])
        self.override_database(db)
        complete = AsyncMock(return_value=True)

        with (
            patch(
                "app.api.routes.auth.redis_cache.claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim-token",
                        "payload": pending_registration(),
                    }
                ),
            ),
            patch(
                "app.api.routes.auth.redis_cache.complete_registration",
                complete,
            ),
            patch(
                "app.api.routes.auth.create_access_token",
                return_value="access-token",
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"registration_id": REGISTRATION_ID, "otp": "123456"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["access_token"], "access-token")
        self.assertEqual(db.flushes, 1)
        self.assertEqual(db.commits, 1)
        created_user = db.added[0]
        self.assertTrue(created_user.is_verified)
        self.assertEqual(created_user.registration_id, REGISTRATION_ID)
        self.assertEqual(
            created_user.consent_policy_version,
            "typetrace-consent-v1",
        )
        complete.assert_awaited_once()

    def test_post_commit_redis_cleanup_failure_does_not_change_success(self) -> None:
        db = FakeAsyncSession([None])
        self.override_database(db)
        with (
            patch(
                "app.api.routes.auth.redis_cache.claim_registration",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "claim-token",
                        "payload": pending_registration(),
                    }
                ),
            ),
            patch(
                "app.api.routes.auth.redis_cache.complete_registration",
                AsyncMock(side_effect=RuntimeError("redis unavailable")),
            ),
            patch(
                "app.api.routes.auth.create_access_token",
                return_value="access-token",
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"registration_id": REGISTRATION_ID, "otp": "123456"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(db.commits, 1)
        self.assertEqual(response.json()["access_token"], "access-token")


    def test_completed_registration_does_not_reissue_access_token_from_otp(self) -> None:
        self.override_database(FakeAsyncSession(["existing-user-id"]))
        with patch(
            "app.api.routes.auth.create_access_token",
            return_value="must-not-be-issued",
        ) as create_token:
            response = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"registration_id": REGISTRATION_ID, "otp": "123456"},
            )

        self.assertEqual(response.status_code, 409)
        create_token.assert_not_called()

    def test_login_returns_token_with_current_token_version(self) -> None:
        user = make_user()
        self.override_database(FakeAsyncSession([user]))
        with (
            patch("app.api.routes.auth.verify_password", return_value=True),
            patch(
                "app.api.routes.auth.create_access_token",
                return_value="signed-test-token",
            ) as create_token,
        ):
            response = self.client.post(
                "/api/v1/auth/login",
                json={
                    "email": "STUDENT@EXAMPLE.COM",
                    "password": "Password1",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["access_token"], "signed-test-token")
        token_data = create_token.call_args.kwargs["data"]
        self.assertEqual(token_data["token_version"], 0)

    def test_password_reset_missing_account_returns_opaque_session_id(self) -> None:
        self.override_database(FakeAsyncSession([None]))
        create_reset = AsyncMock(
            return_value={"reset_id": RESET_ID}
        )
        send_email = AsyncMock(return_value=None)
        with (
            patch(
                "app.api.routes.auth.redis_cache.create_password_reset",
                create_reset,
            ),
            patch("app.api.routes.auth.send_otp_email", send_email),
        ):
            response = self.client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": "missing@example.com"},
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["reset_id"], RESET_ID)
        send_email.assert_not_awaited()

    def test_password_reset_email_failure_is_not_reported_as_success(self) -> None:
        self.override_database(FakeAsyncSession([make_user()]))
        delete_reset = AsyncMock(return_value=True)
        send_email = AsyncMock(side_effect=EmailDeliveryError("delivery failed"))
        with (
            patch(
                "app.api.routes.auth.redis_cache.create_password_reset",
                AsyncMock(return_value={"reset_id": RESET_ID}),
            ),
            patch(
                "app.api.routes.auth.redis_cache.delete_password_reset",
                delete_reset,
            ),
            patch(
                "app.api.routes.auth.send_otp_email",
                send_email,
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": "student@example.com"},
            )

        self.assertEqual(response.status_code, 503)
        delete_reset.assert_awaited_once_with(RESET_ID)
        self.assertIn(
            "/forgot-password#reset_id=",
            send_email.call_args.kwargs["action_url"],
        )

    def test_password_reset_commit_increments_token_version_and_consumes_session(self) -> None:
        user = make_user()
        db = FakeAsyncSession([user])
        self.override_database(db)
        complete = AsyncMock(return_value=True)
        with (
            patch(
                "app.api.routes.auth.decode_reset_token",
                return_value={
                    "reset_id": RESET_ID,
                    "jti": "reset-jti",
                    "user_id": str(user.id),
                    "sub": user.email,
                },
            ),
            patch(
                "app.api.routes.auth.redis_cache.claim_password_reset",
                AsyncMock(
                    return_value={
                        "status": "CLAIMED",
                        "claim_token": "reset-claim",
                        "payload": {
                            "user_id": str(user.id),
                            "email": user.email,
                        },
                    }
                ),
            ),
            patch(
                "app.api.routes.auth.redis_cache.complete_password_reset",
                complete,
            ),
            patch("app.api.routes.auth.verify_password", return_value=False),
            patch(
                "app.api.routes.auth.get_password_hash",
                return_value="new-password-hash",
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/password-reset/confirm",
                json={
                    "reset_token": "x" * 80,
                    "new_password": "NewPassword1",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(user.hashed_password, "new-password-hash")
        self.assertEqual(user.token_version, 1)
        self.assertEqual(user.last_password_reset_id, RESET_ID)
        self.assertEqual(db.commits, 1)
        complete.assert_awaited_once_with(RESET_ID, "reset-claim")

    def test_reused_reset_token_is_rejected(self) -> None:
        self.override_database(FakeAsyncSession())
        with (
            patch(
                "app.api.routes.auth.decode_reset_token",
                return_value={
                    "reset_id": RESET_ID,
                    "jti": "reset-jti",
                    "user_id": "user-1",
                    "sub": "student@example.com",
                },
            ),
            patch(
                "app.api.routes.auth.redis_cache.claim_password_reset",
                AsyncMock(return_value={"status": "COMPLETED"}),
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/password-reset/confirm",
                json={
                    "reset_token": "x" * 80,
                    "new_password": "NewPassword1",
                },
            )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main(verbosity=2)
