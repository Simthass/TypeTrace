"""Access-token revocation contract tests."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import get_current_user
from tests.helpers import FakeAsyncSession, make_user


class TokenVersionContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_matching_token_version_is_accepted(self) -> None:
        user = make_user()
        user.token_version = 3
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="token",
        )
        with patch(
            "app.api.deps.decode_access_token",
            return_value={
                "id": str(user.id),
                "sub": user.email,
                "token_version": 3,
            },
        ):
            resolved = await get_current_user(
                credentials=credentials,
                db=FakeAsyncSession([user]),
            )
        self.assertIs(resolved, user)

    async def test_older_access_token_is_rejected(self) -> None:
        user = make_user()
        user.token_version = 4
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="token",
        )
        with patch(
            "app.api.deps.decode_access_token",
            return_value={
                "id": str(user.id),
                "sub": user.email,
                "token_version": 3,
            },
        ):
            with self.assertRaises(HTTPException) as raised:
                await get_current_user(
                    credentials=credentials,
                    db=FakeAsyncSession([user]),
                )
        self.assertEqual(raised.exception.status_code, 401)

    async def test_legacy_token_without_version_is_rejected(self) -> None:
        user = make_user()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="token",
        )
        with patch(
            "app.api.deps.decode_access_token",
            return_value={"id": str(user.id), "sub": user.email},
        ):
            with self.assertRaises(HTTPException) as raised:
                await get_current_user(
                    credentials=credentials,
                    db=FakeAsyncSession([user]),
                )
        self.assertEqual(raised.exception.status_code, 401)

    async def test_unverified_account_is_rejected(self) -> None:
        user = make_user(verified=False)
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="token",
        )
        with patch(
            "app.api.deps.decode_access_token",
            return_value={
                "id": str(user.id),
                "sub": user.email,
                "token_version": 0,
            },
        ):
            with self.assertRaises(HTTPException) as raised:
                await get_current_user(
                    credentials=credentials,
                    db=FakeAsyncSession([user]),
                )
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
