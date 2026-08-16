from __future__ import annotations

from typing import Any, Iterable

from starlette.requests import Request


class FlexibleResult:
    """Small SQLAlchemy-result stand-in for direct async route tests."""

    def __init__(self, value: Any = None, *, rowcount: int = 0):
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
        return self.value if isinstance(self.value, list) else [self.value]

    def fetchall(self):
        return self.all()

    def scalar_one(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value


class SequenceAsyncSession:
    """Async DB fake that returns a deterministic sequence of values."""

    def __init__(self, values: Iterable[Any] = (), *, commit_exception: Exception | None = None):
        self.values = list(values)
        self.executed: list[tuple[Any, Any]] = []
        self.added: list[Any] = []
        self.commits = 0
        self.rollbacks = 0
        self.flushes = 0
        self.refreshes = 0
        self.commit_exception = commit_exception

    async def execute(self, statement, parameters=None):
        self.executed.append((statement, parameters))
        value = self.values.pop(0) if self.values else None
        if isinstance(value, FlexibleResult):
            return value
        return FlexibleResult(value)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flushes += 1

    async def commit(self):
        self.commits += 1
        if self.commit_exception is not None:
            raise self.commit_exception

    async def rollback(self):
        self.rollbacks += 1

    async def refresh(self, value):
        self.refreshes += 1


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
            "headers": [(b"user-agent", b"typetrace-coverage-tests")],
            "client": ("127.0.0.1", 41000),
            "server": ("testserver", 80),
        }
    )
