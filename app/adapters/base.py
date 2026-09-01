"""Adapter contract: every data source normalizes into RawProviderRecord.

New sources (property records, entity registries, other state boards) are
added by subclassing BaseDataSource — the identity/scoring layers never
change (spec: extensibility NFR).
"""
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Iterable

import httpx

THROTTLE_SECONDS = 0.25


def polite_get_json(url: str, params: dict, timeout: float) -> dict | list:
    """The shared fetch for every keyless public API: throttled to stay
    polite, and one retry on a timeout or 5xx so a single slow response
    doesn't kill a whole sweep — these free endpoints hiccup routinely."""
    last_exc: Exception | None = None
    for attempt in range(2):
        time.sleep(THROTTLE_SECONDS * (attempt + 1))
        try:
            response = httpx.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last_exc = exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500:
                raise
            last_exc = exc
    raise last_exc  # type: ignore[misc]


@dataclass(frozen=True)
class RawProviderRecord:
    source: str                       # "npi" | "idfpr" | future adapters
    source_record_id: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    credential: str | None = None     # e.g. "MD", "DO"
    specialty: str | None = None
    state: str | None = None
    npi: str | None = None
    enumeration_date: date | None = None
    license_number: str | None = None
    license_issue_date: date | None = None
    license_status: str | None = None
    # Practice address (LOCATION address in NPPES; city/zip in IDFPR)
    address_line: str | None = None
    city: str | None = None
    address_state: str | None = None
    zip_code: str | None = None
    phone: str | None = None


@dataclass(frozen=True)
class EnrichmentRecord:
    """A public-record event about a person, matched to prospects by name.

    Drives the OWNERSHIP / PROPERTY_EVENT / CAREER_ADVANCEMENT signals.
    Unlike RawProviderRecord it does not establish identity — it only
    enriches an already-resolved prospect.
    """
    source: str                       # "il_sos" | "cook_county" | "affiliations" | "pecos"
    source_record_id: str
    kind: str                         # "ENTITY" | "PROPERTY" | "CAREER"
    owner_first_name: str
    owner_last_name: str
    state: str | None = None
    # When the source is NPI-keyed (e.g. PECOS), attach by NPI — no name matching
    npi: str | None = None
    event_date: date | None = None
    # ENTITY fields
    entity_name: str | None = None
    entity_type: str | None = None    # e.g. "PLLC", "LLC"
    entity_status: str | None = None
    # PROPERTY fields
    property_address: str | None = None
    sale_price: int | None = None
    # CAREER fields
    role_title: str | None = None
    organization: str | None = None


class BaseDataSource(ABC):
    name: str

    @abstractmethod
    def fetch(self) -> Iterable[RawProviderRecord | EnrichmentRecord]:
        """Yield normalized records from the underlying source."""
