import os


def _normalize_database_url() -> None:
    """Adapt a standard PostgreSQL URL to TypeTrace's async SQLAlchemy driver."""

    value = os.environ.get("DATABASE_URL", "").strip()

    if value.startswith("postgres://"):
        os.environ["DATABASE_URL"] = (
            "postgresql+asyncpg://" + value[len("postgres://"):]
        )
    elif value.startswith("postgresql://"):
        os.environ["DATABASE_URL"] = (
            "postgresql+asyncpg://" + value[len("postgresql://"):]
        )


_normalize_database_url()

from app.main import app
