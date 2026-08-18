"""Illinois Secretary of State business-entity adapter (OWNERSHIP signal).

Prototype reads a bundled sample shaped like the IL SoS corporate/LLC
search export. Swapping in the live registry only changes this file.
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable

from app.adapters.base import BaseDataSource, EnrichmentRecord

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


class ILSoSDataSource(BaseDataSource):
    name = "il_sos"

    def __init__(self, data_path: Path | str = SAMPLE_PATH):
        self.data_path = Path(data_path)

    def fetch(self) -> Iterable[EnrichmentRecord]:
        for row in json.loads(self.data_path.read_text()):
            yield EnrichmentRecord(
                source=self.name,
                source_record_id=row["file_number"],
                kind="ENTITY",
                owner_first_name=row["officer_first_name"].strip().title(),
                owner_last_name=row["officer_last_name"].strip().title(),
                state="IL",
                event_date=date.fromisoformat(row["formation_date"]),
                entity_name=row["entity_name"],
                entity_type=row["entity_type"],
                entity_status=row["status"],
            )
