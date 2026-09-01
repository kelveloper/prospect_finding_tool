"""Live IDFPR adapter — Illinois professional licenses via the state's
official open-data portal (Socrata; free, no key).

Dataset: https://data.illinois.gov/resource/pzzh-kp68 (1.2M+ licenses,
refreshed by IDFPR). We query it *by license number* — the numbers come
from the NPPES pull, so this adapter verifies exactly the physicians we
already found and gives them real issue dates and statuses.
"""
import re
from datetime import date, datetime
from typing import Callable, Iterable

import time

import httpx

THROTTLE_SECONDS = 0.25

from app.adapters.base import BaseDataSource, RawProviderRecord

DATASET_URL = "https://data.illinois.gov/resource/pzzh-kp68.json"
BATCH_SIZE = 50


def normalize_license(value: str | None) -> str | None:
    """'036.057912' / '036-057912' / '036057912' → '036057912'."""
    if not value:
        return None
    cleaned = re.sub(r"[^0-9A-Za-z]", "", value).upper()
    return cleaned or None


def _default_fetch_json(params: dict) -> list[dict]:
    time.sleep(THROTTLE_SECONDS)  # keyless public API — stay polite
    response = httpx.get(DATASET_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _parse_us_date(value: str | None) -> date | None:
    try:
        return datetime.strptime(value, "%m/%d/%Y").date() if value else None
    except ValueError:
        return None


class IDFPRLiveDataSource(BaseDataSource):
    name = "idfpr"

    def __init__(
        self,
        license_numbers: Iterable[str],
        fetch_json: Callable[[dict], list[dict]] = _default_fetch_json,
    ):
        normalized = (normalize_license(n) for n in license_numbers)
        self.license_numbers = sorted({n for n in normalized if n})
        self.fetch_json = fetch_json

    def fetch(self) -> Iterable[RawProviderRecord]:
        for start in range(0, len(self.license_numbers), BATCH_SIZE):
            batch = self.license_numbers[start : start + BATCH_SIZE]
            values = ",".join(f"'{n}'" for n in batch)
            rows = self.fetch_json(
                {
                    "$where": f"license_number in({values})",
                    "$limit": len(batch) * 4,  # a number can recur across license types
                }
            )
            for row in rows:
                record = self._to_record(row)
                if record:
                    yield record

    def _to_record(self, row: dict) -> RawProviderRecord | None:
        # Individuals only, and only the physician license itself
        if row.get("business") == "Y":
            return None
        if "PHYSICIAN AND SURGEON" not in (row.get("description") or "").upper():
            return None
        first = (row.get("first_name") or "").strip()
        last = (row.get("last_name") or "").strip()
        if not first or not last:
            return None

        return RawProviderRecord(
            source=self.name,
            source_record_id=row["license_number"],
            first_name=first.title(),
            last_name=last.title(),
            middle_name=(row.get("middle") or "").strip().title() or None,
            state="IL",
            license_number=row["license_number"],
            license_issue_date=_parse_us_date(row.get("original_issue_date")),
            license_status=(row.get("license_status") or None),
            city=(row.get("city") or "").title() or None,
            address_state=((row.get("state") or "").upper() or None),
            zip_code=(row.get("zip") or "")[:5] or None,
        )
