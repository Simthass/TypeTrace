# backend/app/models/certificate.py

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
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
    document_hash = Column(String(64), unique=True, nullable=False, index=True)

    pdf_url = Column(String(500), nullable=True)
    blockchain_txn = Column(String(100), nullable=True)
    verification_notes = Column(Text, nullable=True)

    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship(
        "TypingSession",
        back_populates="certificate",
    )