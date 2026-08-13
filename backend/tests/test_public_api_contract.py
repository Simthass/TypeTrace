"""Public API, model-metadata, and security-header contract tests."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import require_teacher
from app.api.routes.health import router as health_router
from app.api.routes.model import router as model_router
from app.core.config import settings
from app.middleware.security_headers import SecurityHeadersMiddleware
from tests.helpers import make_user


def build_public_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(model_router, prefix="/api/v1")
    return app


class PublicApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_public_app()
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        self.client.close()

    def test_health_endpoint_and_security_headers(self) -> None:
        response = self.client.get("/api/v1/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "service": "TypeTrace API",
            },
        )
        self.assertEqual(
            response.headers["x-content-type-options"],
            "nosniff",
        )
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertIn(
            "camera=()",
            response.headers["permissions-policy"],
        )

    def test_public_model_status_excludes_operational_secrets(self) -> None:
        internal_status = {
            "status": "ready",
            "model_available": True,
            "model_name": "TypeTrace Isolation Forest",
            "model_version": "isolation-forest-v2-timing-only",
            "feature_family": "public-timing-v2",
            "feature_count": 43,
            "artifact_path": "D:/private/model.joblib",
            "artifact_manifest": {"private": "value"},
            "load_error": None,
        }

        with patch(
            "app.api.routes.model.inference_engine.get_status",
            return_value=internal_status,
        ):
            response = self.client.get("/api/v1/model/status")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["feature_count"], 43)
        self.assertNotIn("artifact_path", payload)
        self.assertNotIn("artifact_manifest", payload)
        self.assertNotIn("load_error", payload)
        self.assertIn("not a calibrated probability", payload["decision_note"])

    def test_model_reload_is_denied_when_disabled(self) -> None:
        async def _teacher_override():
            return make_user(role="TEACHER")

        self.app.dependency_overrides[require_teacher] = _teacher_override
        original = settings.ALLOW_MODEL_RELOAD
        settings.ALLOW_MODEL_RELOAD = False
        try:
            response = self.client.post("/api/v1/model/reload")
        finally:
            settings.ALLOW_MODEL_RELOAD = original

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Model reload is disabled in this environment.",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
