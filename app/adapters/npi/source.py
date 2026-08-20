"""NPI Registry adapter.

For the prototype this reads a bundled sample extract shaped like the real
NPPES API response. Swapping in the live API only changes this file.
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable

from app.adapters.base import BaseDataSource, RawProviderRecord

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


class NPIDataSource(BaseDataSource):
    name = "npi"

    def __init__(self, data_path: Path | str = SAMPLE_PATH):
        self.data_path = Path(data_path)

    def fetch(self) -> Iterable[RawProviderRecord]:
        rows = json.loads(self.data_path.read_text())
        for row in rows:
            yield RawProviderRecord(
                source=self.name,
                source_record_id=row["npi"],
                first_name=row["first_name"].strip().title(),
                last_name=row["last_name"].strip().title(),
                middle_name=(row.get("middle_name") or None),
                credential=(row.get("credential") or None),
                specialty=(row.get("taxonomy_description") or None),
                state=(row.get("state") or "").upper() or None,
                npi=row["npi"],
                enumeration_date=_parse_date(row.get("enumeration_date")),
                city=(row.get("city") or None),
                address_state=(row.get("state") or "").upper() or None,
            )
