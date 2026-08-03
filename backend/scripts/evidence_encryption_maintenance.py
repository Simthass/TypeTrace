"""Shared, privacy-safe helpers for evidence-encryption audits and migration.

These helpers classify stored values without writing plaintext, ciphertext, or
keys to reports. Migration callers may hold plaintext transiently in memory,
but must never serialize it.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any, Literal

from cryptography.fernet import Fernet, InvalidToken

from app.core import crypto

EvidenceStatus = Literal[
    "EMPTY",
    "ACTIVE_CIPHER",
    "LEGACY_CIPHER",
    "PLAINTEXT",
    "PLAINTEXT_JSON_STRING",
    "UNKNOWN_FERNET_KEY",
    "INVALID_UTF8",
    "INVALID_JSON",
    "INVALID_JSON_SHAPE",
    "UNSUPPORTED_TYPE",
]

PASSING_STATUSES = frozenset({"EMPTY", "ACTIVE_CIPHER"})
MIGRATABLE_STATUSES = frozenset(
    {"LEGACY_CIPHER", "PLAINTEXT", "PLAINTEXT_JSON_STRING"}
)
BLOCKING_STATUSES = frozenset(
    {
        "UNKNOWN_FERNET_KEY",
        "INVALID_UTF8",
        "INVALID_JSON",
        "INVALID_JSON_SHAPE",
        "UNSUPPORTED_TYPE",
    }
)


@dataclass(frozen=True)
class ClassifiedEvidence:
    status: EvidenceStatus
    plaintext: Any = None


def looks_like_fernet_token(value: str) -> bool:
    """Return True for a structurally plausible Fernet token.

    This does not verify the signature. It prevents a token encrypted under an
    unknown key from being mistaken for plaintext and irreversibly re-encrypted.
    """

    if not isinstance(value, str) or len(value) < 80:
        return False

    try:
        padding = "=" * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode((value + padding).encode("ascii"))
    except (UnicodeEncodeError, ValueError):
        return False

    # Fernet: version byte + timestamp + IV + at least one ciphertext block + HMAC.
    return len(decoded) >= 73 and decoded[0] == 0x80


def _ciphers(
    active_cipher: Fernet | None,
    legacy_cipher: Fernet | None,
) -> tuple[Fernet, Fernet]:
    return active_cipher or crypto._cipher(), legacy_cipher or crypto._legacy_cipher()


def _decrypt_utf8(cipher: Fernet, token: str) -> str:
    return cipher.decrypt(token.encode("utf-8")).decode("utf-8")


def classify_text(
    value: Any,
    *,
    active_cipher: Fernet | None = None,
    legacy_cipher: Fernet | None = None,
) -> ClassifiedEvidence:
    if value is None or value == "":
        return ClassifiedEvidence("EMPTY", value)
    if not isinstance(value, str):
        return ClassifiedEvidence("UNSUPPORTED_TYPE")

    active, legacy = _ciphers(active_cipher, legacy_cipher)

    try:
        return ClassifiedEvidence("ACTIVE_CIPHER", _decrypt_utf8(active, value))
    except InvalidToken:
        pass
    except UnicodeDecodeError:
        return ClassifiedEvidence("INVALID_UTF8")

    try:
        return ClassifiedEvidence("LEGACY_CIPHER", _decrypt_utf8(legacy, value))
    except InvalidToken:
        pass
    except UnicodeDecodeError:
        return ClassifiedEvidence("INVALID_UTF8")

    if looks_like_fernet_token(value):
        return ClassifiedEvidence("UNKNOWN_FERNET_KEY")

    return ClassifiedEvidence("PLAINTEXT", value)


def _validate_event_array(value: Any) -> ClassifiedEvidence:
    if not isinstance(value, list):
        return ClassifiedEvidence("INVALID_JSON_SHAPE")
    return ClassifiedEvidence("PLAINTEXT", value)


def classify_json(
    value: Any,
    *,
    active_cipher: Fernet | None = None,
    legacy_cipher: Fernet | None = None,
) -> ClassifiedEvidence:
    if value is None:
        return ClassifiedEvidence("EMPTY", None)
    if isinstance(value, list):
        return ClassifiedEvidence("PLAINTEXT", value)
    if not isinstance(value, str):
        return ClassifiedEvidence(
            "INVALID_JSON_SHAPE" if isinstance(value, dict) else "UNSUPPORTED_TYPE"
        )

    active, legacy = _ciphers(active_cipher, legacy_cipher)

    try:
        decrypted = _decrypt_utf8(active, value)
    except InvalidToken:
        decrypted = None
    except UnicodeDecodeError:
        return ClassifiedEvidence("INVALID_UTF8")
    if decrypted is not None:
        try:
            parsed = json.loads(decrypted)
        except json.JSONDecodeError:
            return ClassifiedEvidence("INVALID_JSON")
        if not isinstance(parsed, list):
            return ClassifiedEvidence("INVALID_JSON_SHAPE")
        return ClassifiedEvidence("ACTIVE_CIPHER", parsed)

    try:
        decrypted = _decrypt_utf8(legacy, value)
    except InvalidToken:
        decrypted = None
    except UnicodeDecodeError:
        return ClassifiedEvidence("INVALID_UTF8")
    if decrypted is not None:
        try:
            parsed = json.loads(decrypted)
        except json.JSONDecodeError:
            return ClassifiedEvidence("INVALID_JSON")
        if not isinstance(parsed, list):
            return ClassifiedEvidence("INVALID_JSON_SHAPE")
        return ClassifiedEvidence("LEGACY_CIPHER", parsed)

    if looks_like_fernet_token(value):
        return ClassifiedEvidence("UNKNOWN_FERNET_KEY")

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return ClassifiedEvidence("INVALID_JSON")
    if not isinstance(parsed, list):
        return ClassifiedEvidence("INVALID_JSON_SHAPE")
    return ClassifiedEvidence("PLAINTEXT_JSON_STRING", parsed)
