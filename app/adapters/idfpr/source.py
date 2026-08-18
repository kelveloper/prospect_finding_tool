"""Illinois Department of Financial and Professional Regulation adapter.

Reads a bundled sample extract shaped like the IDFPR license lookup export.
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable

from app.adapters.base import BaseDataSource, RawProviderRecord

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


class IDFPRDataSource(BaseDataSource):
    name = "idfpr"

    def __init__(self, data_path: Path | str = SAMPLE_PATH):
        self.data_path = Path(data_path)

    def fetch(self) -> Iterable[RawProviderRecord]:
        rows = json.loads(self.data_path.read_text())
        for row in rows:
            yield RawProviderRecord(
                source=self.name,
                source_record_id=row["license_number"],
                first_name=row["first_name"].strip().title(),
                last_name=row["last_name"].strip().title(),
                middle_name=(row.get("middle_name") or None),
                credential=(row.get("credential") or None),
                specialty=(row.get("specialty") or None),
                state="IL",
                license_number=row["license_number"],
                license_issue_date=_parse_date(row.get("issue_date")),
                license_status=(row.get("status") or None),
            )
