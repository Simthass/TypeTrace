# backend/app/models/session.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.database import Base

class TypingSession(Base):
    __tablename__ = "typing_sessions"

    id = Column(Integer, primary_key=True, index=True)
    
    # bruh i forgot my User model uses strings for IDs (probably uuids) instead of ints
    # changing this to String so postgres doesnt yell at me about datatype mismatch
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    title = Column(String, index=True)
    text_content = Column(String) # saving the actual essay here
    
    # metrics from frontend
    wpm = Column(Integer)
    total_keystrokes = Column(Integer)
    deletions = Column(Integer)
    pauses = Column(Integer)
    avg_iki = Column(Integer)
    duration_seconds = Column(Integer)
    
    # ML stuff (will update this when i plug in scikit learn next week)
    ml_confidence_score = Column(Float, nullable=True)
    classification_result = Column(String, nullable=True) # HUMAN, SUSPICIOUS, AI
    
    # dumping the whole raw array here cos its way faster to read/write as one big json blob
    raw_keystroke_data = Column(JSONB)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())