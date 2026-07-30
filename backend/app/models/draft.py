
import uuid

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class DraftSession(Base):
    """
    Backend-synced editor draft.

    Local IndexedDB remains the offline-first recovery layer. This table gives the
    product a SaaS-grade persistent draft ledger without touching submitted
    typing_sessions rows.
    """

    __tablename__ = "draft_sessions"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submitted_session_id = Column(
        Integer,
        ForeignKey("typing_sessions.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    course_id = Column(
        Integer,
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    local_draft_id = Column(String(120), nullable=True)
    title = Column(String(255), nullable=False, default="Untitled Document", server_default="Untitled Document")
    text_content = Column(Text, nullable=False, default="", server_default="")
    keystroke_array = Column(JSONB, nullable=False, server_default="[]")

    active_duration_ms = Column(BigInteger, nullable=False, default=0, server_default="0")
    started_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)

    version = Column(Integer, nullable=False, default=1, server_default="1")
    lifecycle_status = Column(String(30), nullable=False, default="PAUSED", server_default="PAUSED")
    sync_status = Column(String(30), nullable=False, default="SYNCED", server_default="SYNCED")
    save_reason = Column(String(30), nullable=False, default="autosave", server_default="autosave")
    conflict_payload = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User")
    course = relationship("Course")
    submitted_session = relationship("TypingSession")

    __table_args__ = (
        CheckConstraint(
            "lifecycle_status IN ('ACTIVE', 'PAUSED', 'SUBMITTED', 'DELETED')",
            name="ck_draft_sessions_lifecycle_status_valid",
        ),
        CheckConstraint(
            "sync_status IN ('LOCAL_ONLY', 'SYNCED', 'PENDING_SYNC', 'CONFLICT')",
            name="ck_draft_sessions_sync_status_valid",
        ),
        UniqueConstraint("user_id", "local_draft_id", name="uq_draft_sessions_user_local_draft"),
        Index("ix_draft_sessions_user_updated", "user_id", "updated_at"),
        Index("ix_draft_sessions_user_status_updated", "user_id", "lifecycle_status", "updated_at"),
        Index("ix_draft_sessions_course_updated", "course_id", "updated_at"),
    )
