"""Cook County recorder adapter (PROPERTY_EVENT signal).

Prototype reads a bundled sample shaped like a county deed-transfer
export. A live integration (county recorder API / ATTOM) replaces only
this file.
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable

from app.adapters.base import BaseDataSource, EnrichmentRecord

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


class CookCountyDataSource(BaseDataSource):
    name = "cook_county"

    def __init__(self, data_path: Path | str = SAMPLE_PATH):
        self.data_path = Path(data_path)

    def fetch(self) -> Iterable[EnrichmentRecord]:
        for row in json.loads(self.data_path.read_text()):
            yield EnrichmentRecord(
                source=self.name,
                source_record_id=row["document_number"],
                kind="PROPERTY",
                owner_first_name=row["buyer_first_name"].strip().title(),
                owner_last_name=row["buyer_last_name"].strip().title(),
                state="IL",
                event_date=date.fromisoformat(row["sale_date"]),
                property_address=row["property_address"],
                sale_price=row.get("sale_price"),
            )
