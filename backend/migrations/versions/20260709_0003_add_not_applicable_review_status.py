"""Add NOT_APPLICABLE to review status

Revision ID: 20260709_0003
Revises: 20260703_0002
Create Date: 2026-07-09
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260709_0003"
down_revision: Union[str, None] = "20260703_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing check constraint
    op.drop_constraint("ck_typing_sessions_review_status_valid", "typing_sessions", type_="check")
    
    # Recreate with the new NOT_APPLICABLE state
    op.create_check_constraint(
        "ck_typing_sessions_review_status_valid",
        "typing_sessions",
        "review_status IN ('PENDING', 'APPROVED', 'FLAGGED', 'NEEDS_DISCUSSION', 'NOT_APPLICABLE')",
    )


def downgrade() -> None:
    # Revert to the original four states
    op.drop_constraint("ck_typing_sessions_review_status_valid", "typing_sessions", type_="check")
    
    op.create_check_constraint(
        "ck_typing_sessions_review_status_valid",
        "typing_sessions",
        "review_status IN ('PENDING', 'APPROVED', 'FLAGGED', 'NEEDS_DISCUSSION')",
    )