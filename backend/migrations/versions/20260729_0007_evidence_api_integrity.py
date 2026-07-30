"""Enforce evidence, certificate, and account lifecycle integrity.

Revision ID: 20260729_0007
Revises: 20260728_0006
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260729_0007"
down_revision: Union[str, None] = "20260728_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "typing_sessions",
        sa.Column("submission_id", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "typing_sessions",
        sa.Column("decision_source", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "typing_sessions",
        sa.Column(
            "model_available",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "typing_sessions",
        sa.Column(
            "degraded_analysis",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_typing_sessions_user_submission_id",
        "typing_sessions",
        ["user_id", "submission_id"],
    )
    op.create_index(
        "ix_typing_sessions_decision_source",
        "typing_sessions",
        ["decision_source"],
        unique=False,
    )

    # Duplicate final documents are legitimate. Session-to-certificate remains
    # one-to-one; document_hash is an indexed integrity value, not an identity.
    op.drop_index("ix_certificates_document_hash", table_name="certificates")
    op.create_index(
        "ix_certificates_document_hash",
        "certificates",
        ["document_hash"],
        unique=False,
    )

    op.add_column(
        "draft_sessions",
        sa.Column("submitted_session_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_draft_sessions_submitted_session_id_typing_sessions",
        "draft_sessions",
        "typing_sessions",
        ["submitted_session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_draft_sessions_submitted_session_id",
        "draft_sessions",
        ["submitted_session_id"],
    )
    op.create_index(
        "ix_draft_sessions_submitted_session_id",
        "draft_sessions",
        ["submitted_session_id"],
        unique=False,
    )

    op.add_column(
        "courses",
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "courses",
        sa.Column(
            "invite_enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )
    op.add_column(
        "courses",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_courses_is_archived",
        "courses",
        ["is_archived"],
        unique=False,
    )

    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_users_deleted_at",
        "users",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_deleted_at", table_name="users")
    op.drop_column("users", "deleted_at")

    op.drop_index("ix_courses_is_archived", table_name="courses")
    op.drop_column("courses", "archived_at")
    op.drop_column("courses", "invite_enabled")
    op.drop_column("courses", "is_archived")

    op.drop_index(
        "ix_draft_sessions_submitted_session_id",
        table_name="draft_sessions",
    )
    op.drop_constraint(
        "uq_draft_sessions_submitted_session_id",
        "draft_sessions",
        type_="unique",
    )
    op.drop_constraint(
        "fk_draft_sessions_submitted_session_id_typing_sessions",
        "draft_sessions",
        type_="foreignkey",
    )
    op.drop_column("draft_sessions", "submitted_session_id")

    op.drop_index("ix_certificates_document_hash", table_name="certificates")
    op.create_index(
        "ix_certificates_document_hash",
        "certificates",
        ["document_hash"],
        unique=True,
    )

    op.drop_index("ix_typing_sessions_decision_source", table_name="typing_sessions")
    op.drop_constraint(
        "uq_typing_sessions_user_submission_id",
        "typing_sessions",
        type_="unique",
    )
    op.drop_column("typing_sessions", "degraded_analysis")
    op.drop_column("typing_sessions", "model_available")
    op.drop_column("typing_sessions", "decision_source")
    op.drop_column("typing_sessions", "submission_id")
