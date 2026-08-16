from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from starlette.requests import Request


class CoverageResult:
    def __init__(self, value: Any = None, *, rowcount: int = 0) -> None:
        self.value = value
        self.rowcount = rowcount

    def scalars(self):
        return self

    def mappings(self):
        return self

    def first(self):
        if isinstance(self.value, list):
            return self.value[0] if self.value else None
        return self.value

    def fetchone(self):
        return self.first()

    def all(self):
        if self.value is None:
            return []
        return list(self.value) if isinstance(self.value, list) else [self.value]

    def fetchall(self):
        return self.all()

    def scalar_one(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value


class CoverageSession:
    """Deterministic AsyncSession double for route transaction coverage."""

    def __init__(
        self,
        values: Iterable[Any] = (),
        *,
        commit_exception: Exception | None = None,
        assign_draft_identity: bool = False,
    ) -> None:
        self.values = list(values)
        self.commit_exception = commit_exception
        self.assign_draft_identity = assign_draft_identity
        self.executed: list[tuple[Any, Any]] = []
        self.added: list[Any] = []
        self.commits = 0
        self.rollbacks = 0
        self.flushes = 0
        self.refreshes = 0

    async def execute(self, statement: Any, parameters: Any = None) -> CoverageResult:
        self.executed.append((statement, parameters))
        value = self.values.pop(0) if self.values else None
        if isinstance(value, BaseException):
            raise value
        if isinstance(value, CoverageResult):
            return value
        return CoverageResult(value)

    def add(self, value: Any) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flushes += 1
        if not self.assign_draft_identity:
            return
        now = datetime(2026, 8, 14, 12, 0, tzinfo=timezone.utc)
        for value in self.added:
            if value.__class__.__name__ != "DraftSession":
                continue
            if getattr(value, "id", None) is None:
                value.id = "draft-created-coverage"
            if getattr(value, "created_at", None) is None:
                value.created_at = now
            if getattr(value, "updated_at", None) is None:
                value.updated_at = now

    async def commit(self) -> None:
        self.commits += 1
        if self.commit_exception is not None:
            raise self.commit_exception

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def refresh(self, value: Any) -> None:
        self.refreshes += 1
        if self.assign_draft_identity and value.__class__.__name__ == "DraftSession":
            now = datetime(2026, 8, 14, 12, 0, tzinfo=timezone.utc)
            value.updated_at = getattr(value, "updated_at", None) or now


def make_request(path: str, method: str = "POST") -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": [(b"user-agent", b"typetrace-persistence-coverage")],
            "client": ("127.0.0.1", 42000),
            "server": ("testserver", 80),
        }
    )
