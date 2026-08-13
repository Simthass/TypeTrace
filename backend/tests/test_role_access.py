"""Role dependency tests through FastAPI's request pipeline."""

from __future__ import annotations

import unittest

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.deps import (
    get_current_user,
    require_student,
    require_teacher,
)
from tests.helpers import make_user


def build_role_app() -> FastAPI:
    app = FastAPI()

    @app.get("/student-only")
    async def student_only(user=Depends(require_student)):
        return {"role": user.role}

    @app.get("/teacher-only")
    async def teacher_only(user=Depends(require_teacher)):
        return {"role": user.role}

    return app


class RoleAccessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_role_app()
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        self.client.close()

    def authenticate_as(self, role: str) -> None:
        async def _override():
            return make_user(role=role)

        self.app.dependency_overrides[get_current_user] = _override

    def test_student_can_use_student_endpoint(self) -> None:
        self.authenticate_as("STUDENT")
        response = self.client.get("/student-only")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"role": "STUDENT"})

    def test_teacher_is_blocked_from_student_endpoint(self) -> None:
        self.authenticate_as("TEACHER")
        response = self.client.get("/student-only")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Student account required.",
        )

    def test_teacher_can_use_teacher_endpoint(self) -> None:
        self.authenticate_as("TEACHER")
        response = self.client.get("/teacher-only")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"role": "TEACHER"})

    def test_student_is_blocked_from_teacher_endpoint(self) -> None:
        self.authenticate_as("STUDENT")
        response = self.client.get("/teacher-only")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Teacher account required.",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
