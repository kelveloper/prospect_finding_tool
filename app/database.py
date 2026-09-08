from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


engine = _make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_nullable_columns(bind) -> list[str]:
    """Prototype-grade forward migration for the local SQLite file.

    `create_all` never alters a table that already exists, so a nullable
    column added to a model after the database was created would break
    every SELECT on that table until someone ran Alembic. This bolts such
    columns on at startup (ADD COLUMN only — never drops or retypes) and
    returns what it added. Deployments still run `alembic upgrade head`;
    the two agree because the migration is guarded the same way.
    """
    import app.models  # noqa: F401  (registers every table on Base.metadata)

    inspector = inspect(bind)
    added: list[str] = []
    with bind.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            present = {column["name"] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present or not column.nullable:
                    continue
                column_type = column.type.compile(dialect=bind.dialect)
                connection.execute(
                    text(
                        f"ALTER TABLE {table.name} ADD COLUMN {column.name} {column_type}"
                    )
                )
                added.append(f"{table.name}.{column.name}")
    return added
