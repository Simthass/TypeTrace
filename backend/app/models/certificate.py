
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(
        Integer,
        ForeignKey("typing_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    certificate_id = Column(String(50), unique=True, nullable=False, index=True)
    document_hash = Column(String(64), nullable=False, index=True)

    pdf_url = Column(String(500), nullable=True)
    blockchain_txn = Column(String(100), nullable=True)
    verification_notes = Column(Text, nullable=True)

    # Part 1 data-integrity foundation. Existing certificates are automatically
    # treated as legacy unsigned records by the additive migration.
    evidence_hash = Column(String(64), nullable=True, index=True)
    signed_payload_hash = Column(String(64), nullable=True, index=True)
    signature = Column(Text, nullable=True)
    signature_algorithm = Column(
        String(40),
        nullable=False,
        default="UNSIGNED_LEGACY",
        server_default="UNSIGNED_LEGACY",
    )
    signing_key_id = Column(String(80), nullable=True, index=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    verification_status = Column(
        String(30),
        nullable=False,
        default="VALID_LEGACY",
        server_default="VALID_LEGACY",
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(Text, nullable=True)

    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship(
        "TypingSession",
        back_populates="certificate",
    )

    __table_args__ = (
        CheckConstraint(
            "signature_algorithm IN ('UNSIGNED_LEGACY', 'HMAC-SHA256', 'Ed25519')",
            name="ck_certificates_signature_algorithm_valid",
        ),
        CheckConstraint(
            "verification_status IN "
            "('VALID', 'VALID_LEGACY', 'REVIEW_REQUIRED', 'HIGH_RISK', "
            "'REVOKED', 'INVALID_SIGNATURE')",
            name="ck_certificates_verification_status_valid",
        ),
        Index("ix_certificates_signature_status", "verification_status", "generated_at"),
    )
