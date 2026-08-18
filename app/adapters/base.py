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


class BaseDataSource(ABC):
    name: str

    @abstractmethod
    def fetch(self) -> Iterable[RawProviderRecord]:
        """Yield normalized records from the underlying source."""
