import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def _normalize_database_url() -> None:
    """Adapt Neon/PostgreSQL URLs for SQLAlchemy's asyncpg driver."""

    value = os.environ.get("DATABASE_URL", "").strip()
    if not value:
        return

    if value.startswith("postgres://"):
        value = "postgresql+asyncpg://" + value[len("postgres://"):]
    elif value.startswith("postgresql://"):
        value = "postgresql+asyncpg://" + value[len("postgresql://"):]

    parts = urlsplit(value)

    query = []
    ssl_value = None

    for key, item_value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "sslmode":
            ssl_value = item_value or "require"
            continue

        if key == "channel_binding":
            continue

        query.append((key, item_value))

    if ssl_value and not any(key == "ssl" for key, _ in query):
        query.append(("ssl", ssl_value))

    normalized = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query),
            parts.fragment,
        )
    )

    os.environ["DATABASE_URL"] = normalized


_normalize_database_url()

from app.main import app