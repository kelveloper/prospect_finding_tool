"""ingest_runs: per-source counts and duration for the sweep report

The first revision in this repo. The rest of the schema is still created
by `Base.metadata.create_all()` at app startup, so this migration only
adds what create_all cannot: new columns on an existing table. Every add
is guarded, so it is safe on a database create_all already brought up to
date, and on one that has no ingest_runs table yet.

Revision ID: 0001_ingest_run_telemetry
Revises: None
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_ingest_run_telemetry"
down_revision = None
branch_labels = None
depends_on = None

TABLE = "ingest_runs"
COLUMNS: list[tuple[str, sa.types.TypeEngine]] = [
    ("npi_records", sa.Integer()),
    ("idfpr_records", sa.Integer()),
    ("pecos_records", sa.Integer()),
    ("cook_records", sa.Integer()),
    ("prospects_resolved", sa.Integer()),
    ("prospects_skipped", sa.Integer()),
    ("enrichment_records", sa.Integer()),
    ("enrichment_matched", sa.Integer()),
    ("prospects_moved", sa.Integer()),
    ("duration_seconds", sa.Float()),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return  # create_all will make the table with every column
    present = {column["name"] for column in inspector.get_columns(TABLE)}
    for name, column_type in COLUMNS:
        if name not in present:
            op.add_column(TABLE, sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    present = {column["name"] for column in inspector.get_columns(TABLE)}
    # batch mode: SQLite rebuilds the table to drop a column
    with op.batch_alter_table(TABLE) as batch:
        for name, _ in COLUMNS:
            if name in present:
                batch.drop_column(name)
