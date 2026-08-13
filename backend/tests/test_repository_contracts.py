from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.repositories.student import StudentSessionFilters, list_student_session_rows
from app.repositories.teacher import TeacherSubmissionFilters, list_teacher_submission_rows


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value


class _RowsResult:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows


class RepositoryContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_student_repository_parameterizes_filters_and_synthetic_aliases(self) -> None:
        db = SimpleNamespace(
            execute=AsyncMock(
                side_effect=[
                    _ScalarResult(2),
                    _RowsResult([{"id": 1}, {"id": 2}]),
                ]
            )
        )
        count, rows = await list_student_session_rows(
            db,
            user_id="student-1",
            filters=StudentSessionFilters(
                classification=" synthetic ",
                review_status=" approved ",
                search="  Essay  ",
            ),
            limit=20,
            offset=5,
        )
        self.assertEqual(count, 2)
        self.assertEqual(rows, [{"id": 1}, {"id": 2}])
        self.assertEqual(db.execute.await_count, 2)

        query, params = db.execute.await_args_list[0].args
        sql = str(query)
        self.assertIn("ts.user_id = :user_id", sql)
        self.assertIn("AI-GENERATED", sql)
        self.assertIn("review_status", sql)
        self.assertIn("LOWER(ts.title) LIKE :search", sql)
        self.assertEqual(params["user_id"], "student-1")
        self.assertEqual(params["review_status"], "APPROVED")
        self.assertEqual(params["search"], "%essay%")
        self.assertNotIn("classification", params)

    async def test_student_repository_binds_normal_classification(self) -> None:
        db = SimpleNamespace(
            execute=AsyncMock(side_effect=[_ScalarResult(0), _RowsResult([])])
        )
        await list_student_session_rows(
            db,
            user_id="student-2",
            filters=StudentSessionFilters(classification="human"),
            limit=10,
            offset=0,
        )
        _, params = db.execute.await_args_list[0].args
        self.assertEqual(params["classification"], "HUMAN")

    async def test_teacher_repository_scopes_to_owner_and_binds_all_optional_filters(self) -> None:
        db = SimpleNamespace(
            execute=AsyncMock(
                side_effect=[_ScalarResult(1), _RowsResult([{"id": 9}])]
            )
        )
        count, rows = await list_teacher_submission_rows(
            db,
            teacher_id="teacher-1",
            filters=TeacherSubmissionFilters(
                course_id=44,
                review_status="flagged",
                risk_level="high",
                search=" Student ",
            ),
            limit=15,
            offset=30,
        )
        self.assertEqual(count, 1)
        self.assertEqual(rows, [{"id": 9}])

        query, params = db.execute.await_args_list[0].args
        sql = str(query)
        self.assertIn("c.teacher_id = :teacher_id", sql)
        self.assertIn("c.id = :course_id", sql)
        self.assertIn("COALESCE(ts.risk_level", sql)
        self.assertIn("LOWER(u.email) LIKE :search", sql)
        self.assertEqual(
            params,
            {
                "teacher_id": "teacher-1",
                "limit": 15,
                "offset": 30,
                "course_id": 44,
                "review_status": "FLAGGED",
                "risk_level": "HIGH",
                "search": "%student%",
            },
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
