# backend/app/models/course.py

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, false
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)

    teacher_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    course_name = Column(String(200), nullable=False)
    course_code = Column(String(100), nullable=False)
    invite_code = Column(String(30), unique=True, nullable=False, index=True)
    is_archived = Column(Boolean, nullable=False, default=False, server_default=false(), index=True)
    invite_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    archived_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    teacher = relationship(
        "User",
        back_populates="courses_taught",
    )

    students = relationship(
        "CourseStudent",
        back_populates="course",
        cascade="all, delete-orphan",
    )

    sessions = relationship(
        "TypingSession",
        back_populates="course",
    )

    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "course_code",
            name="uq_courses_teacher_course_code",
        ),
        Index("ix_courses_teacher_created", "teacher_id", "created_at"),
    )


class CourseStudent(Base):
    __tablename__ = "course_students"

    id = Column(Integer, primary_key=True, index=True)

    course_id = Column(
        Integer,
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    course = relationship(
        "Course",
        back_populates="students",
    )

    student = relationship(
        "User",
        back_populates="joined_courses",
    )

    __table_args__ = (
        UniqueConstraint(
            "course_id",
            "student_id",
            name="uq_course_students_course_student",
        ),
        Index("ix_course_students_student_joined", "student_id", "joined_at"),
    )
