"""Cryptographic signing and verification for TypeTrace certificate records.

The certificate signature intentionally signs *evidence metadata*, not the essay
text or raw keystroke stream. This gives public verifiers a stable integrity
record while keeping private writing data out of the public ledger.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
    load_pem_public_key,
)

from app.core.config import settings


SIGNED_PAYLOAD_SCHEMA_VERSION = "typetrace.certificate.v1"
ED25519_ALGORITHM = "Ed25519"
HMAC_ALGORITHM = "HMAC-SHA256"
LEGACY_ALGORITHM = "UNSIGNED_LEGACY"


@dataclass(frozen=True)
class SignatureBundle:
    payload: Dict[str, Any]
    payload_hash: str
    signature: str
    algorithm: str
    signing_key_id: str
    signed_at: datetime
    public_key: Optional[str] = None


@dataclass(frozen=True)
class SignatureVerificationResult:
    status: str
    valid: bool
    payload_hash_matches: bool
    signature_valid: bool
    algorithm: str
    reason: str
    expected_payload_hash: Optional[str] = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return str(value)


def stable_round(value: Any, digits: int = 6) -> Optional[float]:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric != numeric:
        return None
    return round(numeric, digits)


def stable_int(value: Any) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def canonical_json_bytes(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def sha256_hex_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_hex_json(payload: Mapping[str, Any]) -> str:
    return sha256_hex_bytes(canonical_json_bytes(payload))  


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    clean = str(value or "").strip()
    padding = "=" * (-len(clean) % 4)
    return base64.urlsafe_b64decode((clean + padding).encode("ascii"))


def _private_key_from_setting() -> Optional[Ed25519PrivateKey]:
    value = str(settings.CERTIFICATE_SIGNING_PRIVATE_KEY or "").strip()
    if not value:
        return None

    if "BEGIN" in value:
        loaded = load_pem_private_key(value.encode("utf-8"), password=None)
        if not isinstance(loaded, Ed25519PrivateKey):
            raise ValueError("CERTIFICATE_SIGNING_PRIVATE_KEY must be an Ed25519 key.")
        return loaded

    raw = _b64url_decode(value)
    if len(raw) != 32:
        raise ValueError(
            "CERTIFICATE_SIGNING_PRIVATE_KEY must be PEM or base64url raw 32-byte Ed25519 private key."
        )
    return Ed25519PrivateKey.from_private_bytes(raw)


def _public_key_from_setting() -> Optional[Ed25519PublicKey]:
    value = str(settings.CERTIFICATE_SIGNING_PUBLIC_KEY or "").strip()
    if not value:
        return None

    if "BEGIN" in value:
        loaded = load_pem_public_key(value.encode("utf-8"))
        if not isinstance(loaded, Ed25519PublicKey):
            raise ValueError("CERTIFICATE_SIGNING_PUBLIC_KEY must be an Ed25519 public key.")
        return loaded

    raw = _b64url_decode(value)
    if len(raw) != 32:
        raise ValueError(
            "CERTIFICATE_SIGNING_PUBLIC_KEY must be PEM or base64url raw 32-byte Ed25519 public key."
        )
    return Ed25519PublicKey.from_public_bytes(raw)


def public_key_b64_from_private(private_key: Ed25519PrivateKey) -> str:
    raw = private_key.public_key().public_bytes(
        encoding=Encoding.Raw,
        format=PublicFormat.Raw,
    )
    return _b64url_encode(raw)


def private_key_b64(private_key: Ed25519PrivateKey) -> str:
    raw = private_key.private_bytes(
        encoding=Encoding.Raw,
        format=PrivateFormat.Raw,
        encryption_algorithm=NoEncryption(),
    )
    return _b64url_encode(raw)


def build_certificate_payload_from_values(
    *,
    certificate_id: str,
    session_id: Any,
    user_id: Any,
    course_id: Any,
    document_hash: Optional[str],
    evidence_hash: Optional[str],
    classification: Optional[str],
    risk_level: Optional[str],
    confidence_score: Any,
    model_version: Optional[str],
    model_score: Any,
    wpm: Any,
    duration_seconds: Any,
    total_keystrokes: Any,
    deletions: Any,
    pauses: Any,
    avg_iki: Any,
    signed_at: datetime,
) -> Dict[str, Any]:
    """Build the stable certificate payload used for signing and verification.

    Mutable workflow state such as review_status, verification_status and
    revocation_reason is intentionally excluded. Revocation is represented by a
    separate ledger state, while the original evidence signature remains stable.
    """

    return {
        "schema_version": SIGNED_PAYLOAD_SCHEMA_VERSION,
        "certificate_id": str(certificate_id),
        "session_id": stable_int(session_id),
        "student_user_id": str(user_id),
        "course_id": stable_int(course_id) if course_id is not None else None,
        "document_hash": str(document_hash or ""),
        "evidence_hash": str(evidence_hash or ""),
        "classification": str(classification or "UNKNOWN").upper(),
        "risk_level": str(risk_level or "LOW").upper(),
        "confidence_score": stable_round(confidence_score, 4),
        "model_version": str(model_version or "unknown"),
        "model_score": stable_round(model_score, 6),
        "metrics": {
            "wpm": stable_round(wpm, 4),
            "duration_seconds": stable_round(duration_seconds, 4),
            "total_keystrokes": stable_int(total_keystrokes),
            "deletions": stable_int(deletions),
            "pauses": stable_int(pauses),
            "avg_iki": stable_round(avg_iki, 4),
        },
        "signed_at": iso_datetime(signed_at),
    }


def build_certificate_payload_from_session(session: Any, certificate: Any) -> Dict[str, Any]:
    signed_at = certificate.signed_at or utc_now()
    return build_certificate_payload_from_values(
        certificate_id=certificate.certificate_id,
        session_id=session.id,
        user_id=session.user_id,
        course_id=session.course_id,
        document_hash=certificate.document_hash or session.document_hash,
        evidence_hash=certificate.evidence_hash or session.evidence_hash,
        classification=session.classification_result,
        risk_level=session.risk_level,
        confidence_score=session.ml_confidence_score,
        model_version=session.model_version,
        model_score=session.model_score,
        wpm=session.wpm,
        duration_seconds=session.duration_seconds,
        total_keystrokes=session.total_keystrokes,
        deletions=session.deletions,
        pauses=session.pauses,
        avg_iki=session.avg_iki,
        signed_at=signed_at,
    )


def _first_present(record: Mapping[str, Any], *keys: str) -> Any:
    """Return the first non-None value from a certificate record.

    Public API records often include display-rounded fields such as ``wpm`` and
    ``confidence``. The signed ledger must be verified against the same raw
    database values that were used when the certificate was signed, otherwise a
    harmless UI rounding step can make a valid certificate look tampered with.
    """

    for key in keys:
        value = record.get(key)
        if value is not None:
            return value
    return None


def build_certificate_payload_from_record(record: Mapping[str, Any]) -> Dict[str, Any]:
    signed_at = record.get("signed_at_raw") or record.get("signed_at") or record.get("ledger_generated_at_raw")
    if isinstance(signed_at, str):
        try:
            signed_at = datetime.fromisoformat(signed_at.replace("Z", "+00:00"))
        except ValueError:
            signed_at = None
    signed_at = signed_at or utc_now()

    return build_certificate_payload_from_values(
        certificate_id=str(record.get("certificate_id") or ""),
        session_id=record.get("session_id"),
        user_id=record.get("user_id"),
        course_id=record.get("course_id"),
        document_hash=record.get("document_hash"),
        evidence_hash=record.get("evidence_hash"),
        classification=record.get("classification"),
        risk_level=record.get("risk_level"),
        confidence_score=_first_present(record, "confidence_raw", "confidence"),
        model_version=record.get("model_version"),
        model_score=_first_present(record, "model_score_raw", "model_score"),
        wpm=_first_present(record, "wpm_raw", "wpm"),
        duration_seconds=_first_present(record, "duration_seconds_raw", "duration_seconds"),
        total_keystrokes=record.get("total_keystrokes"),
        deletions=record.get("deletions"),
        pauses=record.get("pauses"),
        avg_iki=_first_present(record, "avg_iki_raw", "avg_iki"),
        signed_at=signed_at,
    )


def _hmac_secret() -> bytes:
    secret = str(settings.CERTIFICATE_SIGNING_HMAC_SECRET or settings.SECRET_KEY or "").strip()
    if not secret:
        raise ValueError("Certificate signing requires SECRET_KEY or CERTIFICATE_SIGNING_HMAC_SECRET.")
    return secret.encode("utf-8")


def sign_payload(payload: Dict[str, Any]) -> SignatureBundle:
    signed_at_value = payload.get("signed_at")
    signed_at = utc_now()
    if isinstance(signed_at_value, str):
        try:
            signed_at = datetime.fromisoformat(signed_at_value.replace("Z", "+00:00"))
        except ValueError:
            signed_at = utc_now()

    payload_hash = sha256_hex_json(payload)
    payload_bytes = canonical_json_bytes(payload)
    key_id = str(settings.CERTIFICATE_SIGNING_KEY_ID or "typetrace-local-v1").strip()

    private_key = _private_key_from_setting()
    if private_key is not None:
        signature = _b64url_encode(private_key.sign(payload_bytes))
        return SignatureBundle(
            payload=payload,
            payload_hash=payload_hash,
            signature=signature,
            algorithm=ED25519_ALGORITHM,
            signing_key_id=key_id,
            signed_at=signed_at,
            public_key=public_key_b64_from_private(private_key),
        )

    if settings.is_production and not settings.CERTIFICATE_ALLOW_HMAC_FALLBACK:
        raise ValueError("Production certificate signing requires an Ed25519 private key.")

    if not settings.CERTIFICATE_ALLOW_HMAC_FALLBACK:
        raise ValueError("Certificate signing private key is not configured.")

    signature = hmac.new(_hmac_secret(), payload_bytes, hashlib.sha256).hexdigest()
    return SignatureBundle(
        payload=payload,
        payload_hash=payload_hash,
        signature=signature,
        algorithm=HMAC_ALGORITHM,
        signing_key_id=key_id,
        signed_at=signed_at,
        public_key=None,
    )


def sign_certificate_for_session(session: Any, certificate: Any) -> SignatureBundle:
    signed_at = certificate.signed_at or utc_now()
    certificate.signed_at = signed_at
    payload = build_certificate_payload_from_session(session, certificate)
    bundle = sign_payload(payload)
    certificate.signed_payload_hash = bundle.payload_hash
    certificate.signature = bundle.signature
    certificate.signature_algorithm = bundle.algorithm
    certificate.signing_key_id = bundle.signing_key_id
    certificate.signed_at = bundle.signed_at
    return bundle


def verify_payload_signature(
    *,
    payload: Dict[str, Any],
    signed_payload_hash: Optional[str],
    signature: Optional[str],
    algorithm: Optional[str],
) -> SignatureVerificationResult:
    normalized_algorithm = str(algorithm or LEGACY_ALGORITHM).strip()

    if normalized_algorithm == LEGACY_ALGORITHM or not signature or not signed_payload_hash:
        return SignatureVerificationResult(
            status="VALID_LEGACY",
            valid=True,
            payload_hash_matches=False,
            signature_valid=False,
            algorithm=normalized_algorithm,
            reason="Certificate was issued before signed ledgers were enabled.",
            expected_payload_hash=sha256_hex_json(payload),
        )

    expected_hash = sha256_hex_json(payload)
    hash_matches = hmac.compare_digest(expected_hash, str(signed_payload_hash or ""))
    if not hash_matches:
        return SignatureVerificationResult(
            status="INVALID_SIGNATURE",
            valid=False,
            payload_hash_matches=False,
            signature_valid=False,
            algorithm=normalized_algorithm,
            reason="Signed payload hash does not match the current certificate evidence record.",
            expected_payload_hash=expected_hash,
        )

    payload_bytes = canonical_json_bytes(payload)

    if normalized_algorithm == ED25519_ALGORITHM:
        public_key = _public_key_from_setting()
        if public_key is None:
            private_key = _private_key_from_setting()
            public_key = private_key.public_key() if private_key else None
        if public_key is None:
            return SignatureVerificationResult(
                status="SIGNATURE_KEY_UNAVAILABLE",
                valid=False,
                payload_hash_matches=True,
                signature_valid=False,
                algorithm=normalized_algorithm,
                reason="Public signing key is not configured on this server.",
                expected_payload_hash=expected_hash,
            )
        try:
            public_key.verify(_b64url_decode(str(signature)), payload_bytes)
        except (InvalidSignature, ValueError):
            return SignatureVerificationResult(
                status="INVALID_SIGNATURE",
                valid=False,
                payload_hash_matches=True,
                signature_valid=False,
                algorithm=normalized_algorithm,
                reason="Ed25519 signature verification failed.",
                expected_payload_hash=expected_hash,
            )
        return SignatureVerificationResult(
            status="VALID",
            valid=True,
            payload_hash_matches=True,
            signature_valid=True,
            algorithm=normalized_algorithm,
            reason="Signed payload hash and Ed25519 signature are valid.",
            expected_payload_hash=expected_hash,
        )

    if normalized_algorithm == HMAC_ALGORITHM:
        expected_signature = hmac.new(_hmac_secret(), payload_bytes, hashlib.sha256).hexdigest()
        signature_valid = hmac.compare_digest(expected_signature, str(signature or ""))
        return SignatureVerificationResult(
            status="VALID" if signature_valid else "INVALID_SIGNATURE",
            valid=signature_valid,
            payload_hash_matches=True,
            signature_valid=signature_valid,
            algorithm=normalized_algorithm,
            reason="HMAC signature is valid." if signature_valid else "HMAC signature verification failed.",
            expected_payload_hash=expected_hash,
        )

    return SignatureVerificationResult(
        status="INVALID_SIGNATURE",
        valid=False,
        payload_hash_matches=True,
        signature_valid=False,
        algorithm=normalized_algorithm,
        reason=f"Unsupported certificate signature algorithm: {normalized_algorithm}",
        expected_payload_hash=expected_hash,
    )


def verify_certificate_record(record: Mapping[str, Any]) -> SignatureVerificationResult:
    payload = build_certificate_payload_from_record(record)
    return verify_payload_signature(
        payload=payload,
        signed_payload_hash=record.get("signed_payload_hash"),
        signature=record.get("signature"),
        algorithm=record.get("signature_algorithm"),
    )
