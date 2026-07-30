"""Pure public-certificate state resolution.

This module deliberately has no FastAPI, database, Redis, or settings imports so
certificate-state semantics can be tested independently of application wiring.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional


PublicCertificateStatus = Literal[
    "NOT_FOUND",
    "VALID",
    "REVIEW_REQUIRED",
    "REVOKED",
    "INVALID_SIGNATURE",
    "LEGACY_UNSIGNED",
]


@dataclass(frozen=True)
class PublicCertificateState:
    status: PublicCertificateStatus
    record_found: bool
    ledger_verified: bool
    certificate_active: bool

    @property
    def compatibility_valid(self) -> bool:
        """Compatibility field for older clients.

        New clients must use ``status`` and ``certificate_active``. This value
        remains false for revoked, invalid-signature, legacy-unsigned, and
        missing records.
        """

        return self.certificate_active


def resolve_public_certificate_state(
    *,
    record_found: bool,
    ledger_status: Optional[str] = None,
    revoked: bool = False,
    signature_valid: bool = False,
    signature_status: Optional[str] = None,
    signature_algorithm: Optional[str] = None,
) -> PublicCertificateState:
    """Resolve one unambiguous public state from ledger and signature facts."""

    if not record_found:
        return PublicCertificateState(
            status="NOT_FOUND",
            record_found=False,
            ledger_verified=False,
            certificate_active=False,
        )

    normalized_algorithm = str(signature_algorithm or "").strip().upper()
    normalized_signature_status = str(signature_status or "").strip().upper()
    normalized_ledger_status = str(ledger_status or "").strip().upper()

    if revoked:
        return PublicCertificateState(
            status="REVOKED",
            record_found=True,
            ledger_verified=bool(signature_valid),
            certificate_active=False,
        )

    if (
        normalized_algorithm == "UNSIGNED_LEGACY"
        or normalized_signature_status == "VALID_LEGACY"
        or normalized_ledger_status == "LEGACY_UNSIGNED"
    ):
        return PublicCertificateState(
            status="LEGACY_UNSIGNED",
            record_found=True,
            ledger_verified=False,
            certificate_active=False,
        )

    if not signature_valid:
        return PublicCertificateState(
            status="INVALID_SIGNATURE",
            record_found=True,
            ledger_verified=False,
            certificate_active=False,
        )

    status: PublicCertificateStatus = (
        "VALID" if normalized_ledger_status == "VALID" else "REVIEW_REQUIRED"
    )
    return PublicCertificateState(
        status=status,
        record_found=True,
        ledger_verified=True,
        certificate_active=True,
    )
