"""Reusable deterministic test doubles for TypeTrace API tests."""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any, Iterable, Optional


@dataclass
class FakeScalarResult:
    value: Any

    def first(self) -> Any:
        return self.value

    def all(self) -> list[Any]:
        if self.value is None:
            return []
        if isinstance(self.value, list):
            return list(self.value)
        return [self.value]


class FakeExecuteResult:
    def __init__(self, value: Any = None, *, rowcount: int = 0) -> None:
        self._value = value
        self.rowcount = rowcount

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._value)

    def mappings(self) -> "FakeExecuteResult":
        return self

    def first(self) -> Any:
        return self._value

    def scalar_one_or_none(self) -> Any:
        return self._value

    def scalar_one(self) -> Any:
        return self._value

    def all(self) -> list[Any]:
        if self._value is None:
            return []
        if isinstance(self._value, list):
            return list(self._value)
        return [self._value]

    def fetchone(self) -> Any:
        return self._value

    def fetchall(self) -> list[Any]:
        if self._value is None:
            return []
        if isinstance(self._value, list):
            return list(self._value)
        return [self._value]


class FakeAsyncSession:
    """Small AsyncSession-compatible double with queued execute results."""

    def __init__(
        self,
        execute_results: Optional[Iterable[Any]] = None,
        *,
        commit_exception: Optional[Exception] = None,
    ) -> None:
        self._execute_results = list(execute_results or [])
        self._commit_exception = commit_exception
        self.added: list[Any] = []
        self.executed: list[tuple[Any, Any]] = []
        self.commits = 0
        self.rollbacks = 0
        self.refreshes = 0
        self.flushes = 0

    async def execute(
        self,
        _statement: Any,
        _parameters: Any = None,
    ) -> FakeExecuteResult:
        self.executed.append((_statement, _parameters))
        value = self._execute_results.pop(0) if self._execute_results else None
        if isinstance(value, FakeExecuteResult):
            return value
        return FakeExecuteResult(value)

    def add(self, value: Any) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flushes += 1

    async def commit(self) -> None:
        self.commits += 1
        if self._commit_exception is not None:
            raise self._commit_exception

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def refresh(self, _value: Any) -> None:
        self.refreshes += 1


def make_user(
    *,
    user_id: str = "user-1",
    role: str = "STUDENT",
    email: str = "student@example.com",
    verified: bool = True,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=user_id,
        first_name="Test",
        last_name="User",
        email=email,
        role=role,
        student_id="2540927" if role == "STUDENT" else None,
        university_name="University of Bedfordshire",
        department="Computer Science" if role == "TEACHER" else None,
        is_verified=verified,
        hashed_password="stored-password-hash",
        token_version=0,
        registration_id=None,
        last_password_reset_id=None,
    )
