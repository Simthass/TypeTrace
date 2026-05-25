# backend/app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime
import uuid
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    # UUID primary key so attackers can't enumerate user counts
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)

    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)

    # ── RBAC: "STUDENT" or "TEACHER" ─────────────────────────────────────────
    # Default to STUDENT so existing rows in the DB are backwards-compatible.
    role = Column(String(20), nullable=False, default="STUDENT")

    # student_id is NOW NULLABLE because teachers don't have one.
    # The unique constraint still works: Postgres treats NULLs as distinct,
    # so multiple teachers with NULL student_id won't collide.
    student_id = Column(String(20), unique=True, index=True, nullable=True)

    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Shared optional institutional fields
    university_name = Column(String(200), nullable=True)

    # Teachers fill this in; students leave it NULL
    department = Column(String(200), nullable=True)

    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)