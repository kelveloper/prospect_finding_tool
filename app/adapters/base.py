"""Adapter contract: every data source normalizes into RawProviderRecord.

New sources (property records, entity registries, other state boards) are
added by subclassing BaseDataSource — the identity/scoring layers never
change (spec: extensibility NFR).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Iterable


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


@dataclass(frozen=True)
class EnrichmentRecord:
    """A public-record event about a person, matched to prospects by name.

    Drives the OWNERSHIP / PROPERTY_EVENT / CAREER_ADVANCEMENT signals.
    Unlike RawProviderRecord it does not establish identity — it only
    enriches an already-resolved prospect.
    """
    source: str                       # "il_sos" | "cook_county" | "affiliations"
    source_record_id: str
    kind: str                         # "ENTITY" | "PROPERTY" | "CAREER"
    owner_first_name: str
    owner_last_name: str
    state: str | None = None
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
