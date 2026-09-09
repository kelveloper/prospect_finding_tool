"""score_history: a note on snapshots that did not come from a sweep

Revision ID: 0002_score_history_note
Revises: 0001_ingest_run_telemetry
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_score_history_note"
down_revision = "0001_ingest_run_telemetry"
branch_labels = None
depends_on = None

TABLE = "score_history"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    present = {c["name"] for c in inspector.get_columns(TABLE)}
    if "note" not in present:
        op.add_column(TABLE, sa.Column("note", sa.String(200), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    if "note" in {c["name"] for c in inspector.get_columns(TABLE)}:
        with op.batch_alter_table(TABLE) as batch:
            batch.drop_column("note")
