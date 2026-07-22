"""Encryption helpers for private TypeTrace writing evidence.

New evidence is always encrypted with the configured primary cipher. Legacy
plaintext or the former development cipher is accepted only when the explicit
ALLOW_LEGACY_EVIDENCE_DECRYPTION migration flag is enabled.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
from functools import lru_cache
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


logger = logging.getLogger("typetrace.crypto")
_LEGACY_DEVELOPMENT_KEY = base64.urlsafe_b64encode(b"0" * 32)


def _development_key() -> bytes:
    seed = settings.SECRET_KEY.strip()
    if not seed:
        raise RuntimeError(
            "Configure ENCRYPTION_MASTER_KEY. Development fallback derivation "
            "also requires a non-empty SECRET_KEY."
        )

    digest = hashlib.sha256(
        f"typetrace-evidence-development:{seed}".encode("utf-8"),
    ).digest()
    return base64.urlsafe_b64encode(digest)


def _primary_key() -> bytes:
    configured = settings.ENCRYPTION_MASTER_KEY.strip()
    if configured:
        return configured.encode("utf-8")

    if settings.is_production:
        raise RuntimeError(
            "ENCRYPTION_MASTER_KEY is required in production."
        )

    logger.warning(
        "ENCRYPTION_MASTER_KEY is not configured; using a key derived from "
        "SECRET_KEY for local development only."
    )
    return _development_key()


def _build_cipher(key: bytes, label: str) -> Fernet:
    try:
        return Fernet(key)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            f"Invalid {label}. Expected a Fernet-compatible url-safe base64 key."
        ) from exc


@lru_cache(maxsize=1)
def _cipher() -> Fernet:
    return _build_cipher(_primary_key(), "ENCRYPTION_MASTER_KEY")


@lru_cache(maxsize=1)
def _legacy_cipher() -> Fernet:
    return _build_cipher(
        _LEGACY_DEVELOPMENT_KEY,
        "legacy development encryption key",
    )


def _decrypt_bytes(token: str) -> bytes:
    encoded = token.encode("utf-8")

    try:
        return _cipher().decrypt(encoded)
    except InvalidToken as primary_error:
        if not settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION:
            raise ValueError(
                "Evidence decryption failed. Enable "
                "ALLOW_LEGACY_EVIDENCE_DECRYPTION only during a controlled "
                "legacy-data migration."
            ) from primary_error

        try:
            return _legacy_cipher().decrypt(encoded)
        except InvalidToken:
            return token.encode("utf-8")


def encrypt_text(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return value
    return _cipher().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(token: Optional[str]) -> Optional[str]:
    if token is None or token == "":
        return token
    return _decrypt_bytes(token).decode("utf-8")


def encrypt_json(data: Optional[Any]) -> Optional[str]:
    if data is None:
        return None

    payload = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return _cipher().encrypt(payload).decode("utf-8")


def decrypt_json(token: Optional[Any]) -> Optional[Any]:
    if token is None:
        return None

    if isinstance(token, (dict, list)):
        if settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION:
            return token
        raise ValueError(
            "Unencrypted JSON evidence was encountered. Enable "
            "ALLOW_LEGACY_EVIDENCE_DECRYPTION only during a controlled "
            "legacy-data migration."
        )

    if not isinstance(token, str):
        raise TypeError("Encrypted JSON evidence must be a string.")

    decrypted = _decrypt_bytes(token).decode("utf-8")
    try:
        return json.loads(decrypted)
    except json.JSONDecodeError as exc:
        if settings.ALLOW_LEGACY_EVIDENCE_DECRYPTION:
            return decrypted
        raise ValueError("Decrypted evidence is not valid JSON.") from exc
    