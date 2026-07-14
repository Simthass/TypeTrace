import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    recipient_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    actor_id = Column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    event_type = Column(String(60), nullable=False, index=True)
    entity_type = Column(String(60), nullable=False) 
    entity_id = Column(String(120), nullable=True)

    title = Column(String(160), nullable=False)
    body = Column(Text, nullable=True)
    action_url = Column(String(255), nullable=True) 

    metadata_json = Column("metadata", JSONB, nullable=True)

    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    read_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    recipient = relationship("User", foreign_keys=[recipient_id])
    actor = relationship("User", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_notifications_recipient_created", "recipient_id", "created_at"),
        Index("ix_notifications_recipient_unread", "recipient_id", "is_read"),
    )