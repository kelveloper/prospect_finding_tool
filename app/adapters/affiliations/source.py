"""Professional-affiliations adapter (CAREER_ADVANCEMENT signal).

Prototype reads a bundled sample shaped like a feed of appointment /
promotion announcements (hospital news pages, press releases).
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable

from app.adapters.base import BaseDataSource, EnrichmentRecord

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


class AffiliationsDataSource(BaseDataSource):
    name = "affiliations"

    def __init__(self, data_path: Path | str = SAMPLE_PATH):
        self.data_path = Path(data_path)

    def fetch(self) -> Iterable[EnrichmentRecord]:
        for row in json.loads(self.data_path.read_text()):
            yield EnrichmentRecord(
                source=self.name,
                source_record_id=row["announcement_id"],
                kind="CAREER",
                owner_first_name=row["first_name"].strip().title(),
                owner_last_name=row["last_name"].strip().title(),
                state=(row.get("state") or "").upper() or None,
                event_date=date.fromisoformat(row["announced_date"]),
                role_title=row["role_title"],
                organization=row["organization"],
            )
