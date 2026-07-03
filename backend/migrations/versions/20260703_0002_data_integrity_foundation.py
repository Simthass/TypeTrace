
"""Add TypeTrace data-integrity foundation

Revision ID: 20260703_0002
Revises: 20260605_0001
Create Date: 2026-07-03

This migration is intentionally additive. It does not drop, truncate, or rewrite
existing typing_sessions/certificates data. Existing submitted sessions remain
valid and existing certificates are marked as legacy unsigned records until the
signed-certificate implementation is added in the next part.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260703_0002"
down_revision: Union[str, None] = "20260605_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Submitted session integrity/model metadata. Nullable by design: old rows are
    # preserved exactly as they are.
    op.add_column("typing_sessions", sa.Column("evidence_hash", sa.String(length=64), nullable=True))
    op.add_column("typing_sessions", sa.Column("model_version", sa.String(length=80), nullable=True))
    op.add_column("typing_sessions", sa.Column("model_score", sa.Float(), nullable=True))
    op.add_column(
        "typing_sessions",
        sa.Column("canonical_stats_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "typing_sessions",
        sa.Column("evidence_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("typing_sessions", sa.Column("active_duration_ms", sa.BigInteger(), nullable=True))
    op.add_column(
        "typing_sessions",
        sa.Column("idle_breaks_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_index("ix_typing_sessions_evidence_hash", "typing_sessions", ["evidence_hash"], unique=False)
    op.create_index("ix_typing_sessions_model_version", "typing_sessions", ["model_version"], unique=False)
    op.create_index(
        "ix_typing_sessions_user_model_created",
        "typing_sessions",
        ["user_id", "model_version", "created_at"],
        unique=False,
    )

    # Certificate signing/revocation foundation. Existing certificates are legacy
    # valid until Part 4 signs new payloads.
    op.add_column("certificates", sa.Column("evidence_hash", sa.String(length=64), nullable=True))
    op.add_column("certificates", sa.Column("signed_payload_hash", sa.String(length=64), nullable=True))
    op.add_column("certificates", sa.Column("signature", sa.Text(), nullable=True))
    op.add_column(
        "certificates",
        sa.Column(
            "signature_algorithm",
            sa.String(length=40),
            server_default="UNSIGNED_LEGACY",
            nullable=False,
        ),
    )
    op.add_column("certificates", sa.Column("signing_key_id", sa.String(length=80), nullable=True))
    op.add_column("certificates", sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "certificates",
        sa.Column(
            "verification_status",
            sa.String(length=30),
            server_default="VALID_LEGACY",
            nullable=False,
        ),
    )
    op.add_column("certificates", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("certificates", sa.Column("revocation_reason", sa.Text(), nullable=True))

    op.create_index("ix_certificates_evidence_hash", "certificates", ["evidence_hash"], unique=False)
    op.create_index("ix_certificates_signed_payload_hash", "certificates", ["signed_payload_hash"], unique=False)
    op.create_index("ix_certificates_signing_key_id", "certificates", ["signing_key_id"], unique=False)
    op.create_index("ix_certificates_signature_status", "certificates", ["verification_status", "generated_at"], unique=False)
    op.create_check_constraint(
        "ck_certificates_signature_algorithm_valid",
        "certificates",
        "signature_algorithm IN ('UNSIGNED_LEGACY', 'HMAC-SHA256', 'Ed25519')",
    )
    op.create_check_constraint(
        "ck_certificates_verification_status_valid",
        "certificates",
        "verification_status IN "
        "('VALID', 'VALID_LEGACY', 'REVIEW_REQUIRED', 'HIGH_RISK', "
        "'REVOKED', 'INVALID_SIGNATURE')",
    )

    # Backend-synced SaaS drafts. This table is new and does not affect already
    # submitted sessions.
    op.create_table(
        "draft_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("local_draft_id", sa.String(length=120), nullable=True),
        sa.Column("title", sa.String(length=255), server_default="Untitled Document", nullable=False),
        sa.Column("text_content", sa.Text(), server_default="", nullable=False),
        sa.Column("keystroke_array", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("active_duration_ms", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("lifecycle_status", sa.String(length=30), server_default="PAUSED", nullable=False),
        sa.Column("sync_status", sa.String(length=30), server_default="SYNCED", nullable=False),
        sa.Column("save_reason", sa.String(length=30), server_default="autosave", nullable=False),
        sa.Column("conflict_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "lifecycle_status IN ('ACTIVE', 'PAUSED', 'SUBMITTED', 'DELETED')",
            name="ck_draft_sessions_lifecycle_status_valid",
        ),
        sa.CheckConstraint(
            "sync_status IN ('LOCAL_ONLY', 'SYNCED', 'PENDING_SYNC', 'CONFLICT')",
            name="ck_draft_sessions_sync_status_valid",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "local_draft_id", name="uq_draft_sessions_user_local_draft"),
    )
    op.create_index("ix_draft_sessions_id", "draft_sessions", ["id"], unique=False)
    op.create_index("ix_draft_sessions_user_id", "draft_sessions", ["user_id"], unique=False)
    op.create_index("ix_draft_sessions_course_id", "draft_sessions", ["course_id"], unique=False)
    op.create_index("ix_draft_sessions_user_updated", "draft_sessions", ["user_id", "updated_at"], unique=False)
    op.create_index(
        "ix_draft_sessions_user_status_updated",
        "draft_sessions",
        ["user_id", "lifecycle_status", "updated_at"],
        unique=False,
    )
    op.create_index("ix_draft_sessions_course_updated", "draft_sessions", ["course_id", "updated_at"], unique=False)

    # Append-only audit trail for professional traceability.
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("target_user_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.String(length=120), nullable=True),
        sa.Column("request_id", sa.String(length=120), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"], unique=False)
    op.create_index("ix_audit_logs_target_user_id", "audit_logs", ["target_user_id"], unique=False)
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"], unique=False)
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"], unique=False)
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"], unique=False)
    op.create_index("ix_audit_logs_request_id", "audit_logs", ["request_id"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)
    op.create_index("ix_audit_logs_actor_created", "audit_logs", ["actor_user_id", "created_at"], unique=False)
    op.create_index("ix_audit_logs_entity_created", "audit_logs", ["entity_type", "entity_id", "created_at"], unique=False)
    op.create_index("ix_audit_logs_event_created", "audit_logs", ["event_type", "created_at"], unique=False)


def downgrade() -> None:
    # Do not run downgrade on a database containing collected project data unless
    # you have intentionally restored from backup. Downgrade removes the new
    # Part 1 foundation tables/columns.
    op.drop_index("ix_audit_logs_event_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_request_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_event_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_target_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_draft_sessions_course_updated", table_name="draft_sessions")
    op.drop_index("ix_draft_sessions_user_status_updated", table_name="draft_sessions")
    op.drop_index("ix_draft_sessions_user_updated", table_name="draft_sessions")
    op.drop_index("ix_draft_sessions_course_id", table_name="draft_sessions")
    op.drop_index("ix_draft_sessions_user_id", table_name="draft_sessions")
    op.drop_index("ix_draft_sessions_id", table_name="draft_sessions")
    op.drop_table("draft_sessions")

    op.drop_constraint("ck_certificates_verification_status_valid", "certificates", type_="check")
    op.drop_constraint("ck_certificates_signature_algorithm_valid", "certificates", type_="check")
    op.drop_index("ix_certificates_signature_status", table_name="certificates")
    op.drop_index("ix_certificates_signing_key_id", table_name="certificates")
    op.drop_index("ix_certificates_signed_payload_hash", table_name="certificates")
    op.drop_index("ix_certificates_evidence_hash", table_name="certificates")
    op.drop_column("certificates", "revocation_reason")
    op.drop_column("certificates", "revoked_at")
    op.drop_column("certificates", "verification_status")
    op.drop_column("certificates", "signed_at")
    op.drop_column("certificates", "signing_key_id")
    op.drop_column("certificates", "signature_algorithm")
    op.drop_column("certificates", "signature")
    op.drop_column("certificates", "signed_payload_hash")
    op.drop_column("certificates", "evidence_hash")

    op.drop_index("ix_typing_sessions_user_model_created", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_model_version", table_name="typing_sessions")
    op.drop_index("ix_typing_sessions_evidence_hash", table_name="typing_sessions")
    op.drop_column("typing_sessions", "idle_breaks_json")
    op.drop_column("typing_sessions", "active_duration_ms")
    op.drop_column("typing_sessions", "evidence_metadata")
    op.drop_column("typing_sessions", "canonical_stats_json")
    op.drop_column("typing_sessions", "model_score")
    op.drop_column("typing_sessions", "model_version")
    op.drop_column("typing_sessions", "evidence_hash")
