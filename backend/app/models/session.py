# backend/app/models/session.py

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class TypingSession(Base):
    __tablename__ = "typing_sessions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    course_id = Column(
        Integer,
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(255), nullable=False, default="Untitled Document")
    text_content = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False, default=0, server_default="0")

    # Canonical backend-computed behavioral metrics. These fields remain for
    # compatibility with the existing app and are populated from server-side
    # recomputation during analysis.
    wpm = Column(Float, nullable=False, default=0)
    total_keystrokes = Column(Integer, nullable=False, default=0)
    deletions = Column(Integer, nullable=False, default=0)
    pauses = Column(Integer, nullable=False, default=0)
    avg_iki = Column(Integer, nullable=False, default=0)
    duration_seconds = Column(Float, nullable=False, default=0)

    ml_confidence_score = Column(Float, nullable=True)
    classification_result = Column(String(30), nullable=True)

    raw_keystroke_data = Column(JSONB, nullable=True)

    certificate_id = Column(String(50), unique=True, index=True, nullable=True)
    document_hash = Column(String(64), index=True, nullable=True)

    # Data-integrity foundation for Part 1. All are nullable/additive so existing
    # collected sessions remain untouched during migration.
    evidence_hash = Column(String(64), nullable=True)
    model_version = Column(String(80), nullable=True, index=True)
    model_score = Column(Float, nullable=True)
    canonical_stats_json = Column(JSONB, nullable=True)
    evidence_metadata = Column(JSONB, nullable=True)
    active_duration_ms = Column(BigInteger, nullable=True)
    idle_breaks_json = Column(JSONB, nullable=True)

    review_status = Column(String(30), nullable=False, default="PENDING", server_default="PENDING")
    reviewed_by = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    review_notes = Column(Text, nullable=True)

    risk_level = Column(String(20), nullable=False, default="LOW", server_default="LOW")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="sessions",
        foreign_keys=[user_id],
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )

    course = relationship(
        "Course",
        back_populates="sessions",
    )

    certificate = relationship(
        "Certificate",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "classification_result IS NULL OR classification_result IN "
            "('HUMAN', 'SUSPICIOUS', 'SYNTHETIC', 'AI-GENERATED', 'UNKNOWN')",
            name="ck_typing_sessions_classification_valid",
        ),
        CheckConstraint(
            "review_status IN ('PENDING', 'APPROVED', 'FLAGGED', 'NEEDS_DISCUSSION', 'NOT_APPLICABLE')",
            name="ck_typing_sessions_review_status_valid",
        ),
        CheckConstraint(
            "risk_level IN ('LOW', 'MEDIUM', 'HIGH')",
            name="ck_typing_sessions_risk_level_valid",
        ),
        Index("ix_typing_sessions_user_created", "user_id", "created_at"),
        Index("ix_typing_sessions_course_created", "course_id", "created_at"),
        Index("ix_typing_sessions_user_model_created", "user_id", "model_version", "created_at"),
    )