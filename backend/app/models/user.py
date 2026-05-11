# backend/app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime
import uuid
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    # using uuid instead of integer id so hackers cant guess user counts
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    student_id = Column(String(20), unique=True, index=True, nullable=False)
    
    # email must be unique and indexed for fast login lookups
    email = Column(String(100), unique=True, index=True, nullable=False)
    
    # we NEVER store plain text. this is the bcrypt hash.
    hashed_password = Column(String(255), nullable=False)
    
    is_verified = Column(Boolean, default=True) # if they are in this table, they passed the OTP check
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # TODO: later we will add a relationship to the Sessions/Certificates table here