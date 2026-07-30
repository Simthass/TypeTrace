"""ASGI-level regression tests for the global request body cap."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_body_limit import RequestBodyLimitMiddleware


class RequestBodyLimitTests(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.add_middleware(RequestBodyLimitMiddleware, max_bytes=64)

        @app.post("/echo")
        async def echo(payload: dict[str, object]) -> dict[str, object]:
            return payload

        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()

    def test_declared_oversized_body_is_rejected_before_json_parsing(self) -> None:
        response = self.client.post("/echo", json={"value": "x" * 100})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "REQUEST_BODY_TOO_LARGE")
        self.assertEqual(response.headers.get("cache-control"), "no-store")

    def test_body_within_limit_reaches_application(self) -> None:
        response = self.client.post("/echo", json={"value": "ok"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"value": "ok"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
