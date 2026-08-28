"""Live NPPES NPI Registry adapter — the first real external data source.

API: https://npiregistry.cms.hhs.gov/api/ (CMS; free, no key).
Constraints handled here:
- max 200 results per request; paged via `skip`
- `state` cannot be the only criterion, so we query per specialty
- `state=IL` matches ANY address on the record, so we additionally keep
  only records licensed in (or practicing in) the target state
- names arrive UPPERCASE; license numbers ride on the taxonomy block
"""
from datetime import date
from typing import Callable, Iterable

import time

import httpx

THROTTLE_SECONDS = 0.25

from app.adapters.base import BaseDataSource, RawProviderRecord

BASE_URL = "https://npiregistry.cms.hhs.gov/api/"
PAGE_SIZE = 200

# Default sweep: the specialty tiers the scoring engine knows about
DEFAULT_SPECIALTIES = (
    "Orthopaedic Surgery",
    "Neurological Surgery",
    "Plastic Surgery",
    "Dermatology",
    "Cardiovascular Disease",
    "Gastroenterology",
    "Anesthesiology",
    "Family Medicine",
)


def _default_fetch_json(params: dict) -> dict:
    time.sleep(THROTTLE_SECONDS)  # keyless public API — stay polite
    response = httpx.get(BASE_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


class NPPESDataSource(BaseDataSource):
    name = "npi"

    def __init__(
        self,
        state: str = "IL",
        specialties: Iterable[str] = DEFAULT_SPECIALTIES,
        limit_per_specialty: int = 50,
        fetch_json: Callable[[dict], dict] = _default_fetch_json,
    ):
        self.state = state.upper()
        self.specialties = list(specialties)
        self.limit_per_specialty = min(limit_per_specialty, 1200)
        self.fetch_json = fetch_json

    def fetch(self) -> Iterable[RawProviderRecord]:
        seen: set[str] = set()
        for specialty in self.specialties:
            yield from self._fetch_specialty(specialty, seen)

    def _fetch_specialty(
        self, specialty: str, seen: set[str]
    ) -> Iterable[RawProviderRecord]:
        skip = 0
        fetched = 0
        while fetched < self.limit_per_specialty:
            page_size = min(PAGE_SIZE, self.limit_per_specialty - fetched)
            payload = self.fetch_json(
                {
                    "version": "2.1",
                    "enumeration_type": "NPI-1",
                    "state": self.state,
                    "taxonomy_description": specialty,
                    "limit": page_size,
                    "skip": skip,
                }
            )
            results = payload.get("results", [])
            for result in results:
                record = self._to_record(result)
                if record and record.npi not in seen:
                    seen.add(record.npi)
                    yield record
            fetched += len(results)
            skip += len(results)
            if len(results) < page_size:
                break

    def _to_record(self, result: dict) -> RawProviderRecord | None:
        basic = result.get("basic", {})
        first = (basic.get("first_name") or "").strip()
        last = (basic.get("last_name") or "").strip()
        if not first or not last:
            return None

        # Physician taxonomy codes start with "20" (Allopathic & Osteopathic
        # Physicians). Text search also matches nurses/PAs with e.g. a
        # gastroenterology taxonomy — drop those.
        taxonomies = [
            t
            for t in result.get("taxonomies", [])
            if t.get("desc") and (t.get("code") or "").startswith("20")
        ]
        if not taxonomies:
            return None
        primary = next((t for t in taxonomies if t.get("primary")), taxonomies[0])

        # Keep only physicians tied to the target state: licensed there
        # (any taxonomy) or practicing there (any address)
        licensed_here = [t for t in taxonomies if (t.get("state") or "").upper() == self.state]
        practices_here = any(
            (a.get("state") or "").upper() == self.state
            for a in result.get("addresses", [])
        )
        if not licensed_here and not practices_here:
            return None

        # Prefer the target state's license for the future IDFPR join
        license_taxonomy = next(
            (t for t in licensed_here if t.get("license")),
            primary if primary.get("license") else None,
        )

        # Practice address: prefer a LOCATION address in the target state
        addresses = result.get("addresses", [])
        locations = [a for a in addresses if a.get("address_purpose") == "LOCATION"]
        location = next(
            (a for a in locations if (a.get("state") or "").upper() == self.state),
            locations[0] if locations else None,
        )

        return RawProviderRecord(
            source=self.name,
            source_record_id=result["number"],
            first_name=first.title(),
            last_name=last.title(),
            middle_name=(basic.get("middle_name") or "").strip().title() or None,
            credential=(basic.get("credential") or None),
            specialty=primary.get("desc"),
            state=self.state,
            npi=result["number"],
            enumeration_date=_parse_date(basic.get("enumeration_date")),
            license_number=(license_taxonomy or {}).get("license"),
            address_line=(location or {}).get("address_1", "").title() or None,
            city=(location or {}).get("city", "").title() or None,
            address_state=((location or {}).get("state") or "").upper() or None,
            zip_code=((location or {}).get("postal_code") or "")[:5] or None,
            phone=(location or {}).get("telephone_number") or None,
        )
