import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, false, text
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

    # A user is verified only when the OTP-backed registration transaction succeeds.
    is_verified = Column(Boolean, nullable=False, default=False, server_default=false())

    # Every security-sensitive credential change increments this value. Access JWTs
    # include the version and are rejected when they no longer match the database.
    token_version = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    # Nullable and unique so the OTP completion endpoint can safely recover from a
    # PostgreSQL-commit/Redis-cleanup split-brain without creating a second account.
    registration_id = Column(String(200), nullable=True, unique=True)
    last_password_reset_id = Column(String(200), nullable=True)

    consent_accepted_at = Column(DateTime(timezone=True), nullable=True)
    consent_policy_version = Column(String(100), nullable=True)
    consent_source = Column(String(100), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

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
        back_populates="reviewer",
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
        CheckConstraint(
            "token_version >= 0",
            name="ck_users_token_version_non_negative",
        ),
    )
