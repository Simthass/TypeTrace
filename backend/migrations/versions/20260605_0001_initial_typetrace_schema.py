# backend/migrations/versions/20260605_0001_initial_typetrace_schema.py

"""Initial TypeTrace database schema

Revision ID: 20260605_0001
Revises:
Create Date: 2026-06-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260605_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False),
        sa.Column("last_name", sa.String(length=50), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("student_id", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("university_name", sa.String(length=200), nullable=True),
        sa.Column("department", sa.String(length=200), nullable=True),
        sa.Column("is_verified", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('STUDENT', 'TEACHER')",
            name="ck_users_role_valid",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_student_id", "users", ["student_id"], unique=True)

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("course_name", sa.String(length=200), nullable=False),
        sa.Column("course_code", sa.String(length=100), nullable=False),
        sa.Column("invite_code", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "course_code", name="uq_courses_teacher_course_code"),
    )

    op.create_index("ix_courses_id", "courses", ["id"], unique=False)
    op.create_index("ix_courses_teacher_id", "courses", ["teacher_id"], unique=False)
    op.create_index("ix_courses_invite_code", "courses", ["invite_code"], unique=True)
    op.create_index("ix_courses_teacher_created", "courses", ["teacher_id", "created_at"], unique=False)

    op.create_table(
        "course_students",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", "student_id", name="uq_course_students_course_student"),
    )

    op.create_index("ix_course_students_id", "course_students", ["id"], unique=False)
    op.create_index("ix_course_students_course_id", "course_students", ["course_id"], unique=False)
    op.create_index("ix_course_students_student_id", "course_students", ["student_id"], unique=False)
    op.create_index(
        "ix_course_students_student_joined",
        "course_students",
        ["student_id", "joined_at"],
        unique=False,
    )

    op.create_table(
        "typing_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=False),
        sa.Column("wpm", sa.Float(), nullable=False),
        sa.Column("total_keystrokes", sa.Integer(), nullable=False),
        sa.Column("deletions", sa.Integer(), nullable=False),
        sa.Column("pauses", sa.Integer(), nullable=False),
        sa.Column("avg_iki", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=False),
        sa.Column("ml_confidence_score", sa.Float(), nullable=True),
        sa.Column("classification_result", sa.String(length=30), nullable=True),
        sa.Column("raw_keystroke_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("certificate_id", sa.String(length=50), nullable=True),
        sa.Column("document_hash", sa.String(length=64), nullable=True),
        sa.Column("review_status", sa.String(length=30), server_default="PENDING", nullable=False),
        sa.Column("reviewed_by", sa.String(length=36), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("risk_level", sa.String(length=20), server_default="LOW", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "classification_result IS NULL OR classification_result IN "
            "('HUMAN', 'SUSPICIOUS', 'SYNTHETIC', 'AI-GENERATED', 'UNKNOWN')",
            name="ck_typing_sessions_classification_valid",
        ),
        sa.CheckConstraint(
            "review_status IN ('PENDING', 'APPROVED', 'FLAGGED', 'NEEDS_DISCUSSION')",
            name="ck_typing_sessions_review_status_valid",
        ),
        sa.CheckConstraint(
            "risk_level IN ('LOW', 'MEDIUM', 'HIGH')",
            name="ck_typing_sessions_risk_level_valid",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_typing_sessions_id", "typing_sessions", ["id"], unique=False)
    op.create_index("ix_typing_sessions_user_id", "typing_sessions", ["user_id"], unique=False)
    op.create_index("ix_typing_sessions_course_id", "typing_sessions", ["course_id"], unique=False)
    op.create_index("ix_typing_sessions_reviewed_by", "typing_sessions", ["reviewed_by"], unique=False)
    op.create_index("ix_typing_sessions_certificate_id", "typing_sessions", ["certificate_id"], unique=True)
    op.create_index("ix_typing_sessions_document_hash", "typing_sessions", ["document_hash"], unique=False)
    op.create_index(
        "ix_typing_sessions_user_created",
        "typing_sessions",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_typing_sessions_course_created",
        "typing_sessions",
        ["course_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("certificate_id", sa.String(length=50), nullable=False),
        sa.Column("document_hash", sa.String(length=64), nullable=False),
        sa.Column("pdf_url", sa.String(length=500), nullable=True),
        sa.Column("blockchain_txn", sa.String(length=100), nullable=True),
        sa.Column("verification_notes", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["typing_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )

    op.create_index("ix_certificates_id", "certificates", ["id"], unique=False)
    op.create_index("ix_certificates_session_id", "certificates", ["session_id"], unique=True)
    op.create_index("ix_certificates_certificate_id", "certificates", ["certificate_id"], unique=True)
    op.create_index("ix_certificates_document_hash", "certificates", ["document_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_certificates_document_hash", table_name="certificates")
    op.drop_index("ix_certificates_certificate_id", table_name="certificates")
    op.drop_index("ix_certificates_session_id", table_name="certificates")
    op.drop_index("ix_certificates_id", table_name="certificates")
    op.drop_table("certificates")

    op.drop_index("ix_typing_sessions_course_created", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_user_created", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_document_hash", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_certificate_id", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_reviewed_by", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_course_id", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_user_id", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_id", table_name="typing_sessions")
    op.drop_table("typing_sessions")

    op.drop_index("ix_course_students_student_joined", table_name="course_students")
    op.drop_index("ix_course_students_student_id", table_name="course_students")
    op.drop_index("ix_course_students_course_id", table_name="course_students")
    op.drop_index("ix_course_students_id", table_name="course_students")
    op.drop_table("course_students")

    op.drop_index("ix_courses_teacher_created", table_name="courses")
    op.drop_index("ix_courses_invite_code", table_name="courses")
    op.drop_index("ix_courses_teacher_id", table_name="courses")
    op.drop_index("ix_courses_id", table_name="courses")
    op.drop_table("courses")

    op.drop_index("ix_users_student_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")