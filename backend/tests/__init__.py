"""TypeTrace automated regression tests."""

import os

# Configuration is validated at import time. Tests use non-secret local values and
# never connect unless an integration test explicitly opts in.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-" + "x" * 48)
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://typetrace_test:typetrace_test@127.0.0.1:55432/typetrace_test",
)
os.environ.setdefault("REDIS_HOST", "127.0.0.1")
os.environ.setdefault("REDIS_PORT", "56379")
os.environ.setdefault("MAIL_FROM", "tests@typetrace.local")
