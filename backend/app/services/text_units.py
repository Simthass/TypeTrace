from __future__ import annotations

from typing import Iterable


def utf16_length(value: str) -> int:
    """Return the number of UTF-16 code units used by browser text controls."""

    return len((value or "").encode("utf-16-le", errors="surrogatepass")) // 2


def to_utf16_units(value: str) -> list[bytes]:
    encoded = (value or "").encode("utf-16-le", errors="surrogatepass")
    return [encoded[index : index + 2] for index in range(0, len(encoded), 2)]


def from_utf16_units(units: Iterable[bytes]) -> str:
    return b"".join(units).decode("utf-16-le", errors="surrogatepass")
