# backend/app/models/user.py

import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False, default="")

    role = Column(String(20), nullable=False, default="STUDENT", index=True)

    student_id = Column(String(30), unique=True, index=True, nullable=True)

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    university_name = Column(String(200), nullable=True)
    department = Column(String(200), nullable=True)

    is_verified = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    sessions = relationship(
        "TypingSession",
        back_populates="user",
        foreign_keys="TypingSession.user_id",
        cascade="all, delete-orphan",
    )

    reviewed_sessions = relationship(
        "TypingSession",
        foreign_keys="TypingSession.reviewed_by",
    )

    courses_taught = relationship(
        "Course",
        back_populates="teacher",
        cascade="all, delete-orphan",
    )

    joined_courses = relationship(
        "CourseStudent",
        back_populates="student",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('STUDENT', 'TEACHER')",
            name="ck_users_role_valid",
        ),
    )