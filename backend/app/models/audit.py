
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class AuditLog(Base):
    """Append-only audit trail for security, certificate, review, and data events."""

    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    actor_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_type = Column(String(80), nullable=False, index=True)
    entity_type = Column(String(60), nullable=False, index=True)
    entity_id = Column(String(120), nullable=True, index=True)

    request_id = Column(String(120), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    event_metadata = Column("metadata", JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    actor = relationship("User", foreign_keys=[actor_user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])

    __table_args__ = (
        Index("ix_audit_logs_actor_created", "actor_user_id", "created_at"),
        Index("ix_audit_logs_entity_created", "entity_type", "entity_id", "created_at"),
        Index("ix_audit_logs_event_created", "event_type", "created_at"),
    )
