"""Harden authentication, OTP, and account lifecycle.

Revision ID: 20260728_0006
Revises: 20260715_0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260728_0006"
down_revision: Union[str, None] = "20260715_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "is_verified",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.false(),
    )
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("registration_id", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_password_reset_id", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("consent_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("consent_policy_version", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("consent_source", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_registration_id",
        "users",
        ["registration_id"],
    )
    op.create_check_constraint(
        "ck_users_token_version_non_negative",
        "users",
        "token_version >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_users_token_version_non_negative",
        "users",
        type_="check",
    )
    op.drop_constraint("uq_users_registration_id", "users", type_="unique")
    op.drop_column("users", "consent_source")
    op.drop_column("users", "consent_policy_version")
    op.drop_column("users", "consent_accepted_at")
    op.drop_column("users", "last_password_reset_id")
    op.drop_column("users", "registration_id")
    op.drop_column("users", "token_version")
    op.alter_column(
        "users",
        "is_verified",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.true(),
    )
