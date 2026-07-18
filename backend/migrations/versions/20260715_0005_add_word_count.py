"""Add word_count column to bypass regex on encrypted text

Revision ID: 20260715_0005
Revises: 20260714_0004
Create Date: 2026-07-15
"""

from alembic import op
import sqlalchemy as sa

revision = "20260715_0005"
down_revision = "20260714_0004"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add word_count to typing_sessions
    op.add_column("typing_sessions", sa.Column("word_count", sa.Integer(), server_default="0", nullable=False))
    
    # Backfill word_count using existing plaintext data
    op.execute("""
        UPDATE typing_sessions 
        SET word_count = array_length(regexp_split_to_array(trim(text_content), '\\s+'), 1)
        WHERE text_content IS NOT NULL AND text_content != ''
    """)

def downgrade() -> None:
    op.drop_column("typing_sessions", "word_count")