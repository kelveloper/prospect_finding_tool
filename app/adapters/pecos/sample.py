"""Sample PECOS-style ownership records for the offline showcase.

The mock IL SoS registry adapter was removed (no obtainable API exists for
that data — see RESEARCH_COMMERCIAL_SOURCES.md). The demo now shows the
OWNERSHIP signal exactly the way live mode earns it: Medicare
billing-group inference, NPI-keyed. Records mirror the live PECOSService
output shape one-for-one.
"""
from typing import Iterable

from app.adapters.base import BaseDataSource, EnrichmentRecord

SAMPLE_ENTITIES = [
    # (npi, first, last, entity_name, entity_type)
    ("1234567801", "John", "Smith", "Smith Orthopedics PLLC", "PLLC"),
    ("1234567802", "Maria", "Gonzalez", "Gonzalez Heart & Vascular PLLC", "PLLC"),
    ("1234567804", "Sarah", "Okafor", "Okafor Family Care LLC", "LLC"),
    # Trap: an NPI we don't track — must never attach to anyone
    ("9999999999", "Gregory", "Palumbo", "Windy City Landscaping LLC", "LLC"),
]


class PECOSSampleDataSource(BaseDataSource):
    name = "pecos"

    def fetch(self) -> Iterable[EnrichmentRecord]:
        for npi, first, last, entity_name, entity_type in SAMPLE_ENTITIES:
            yield EnrichmentRecord(
                source=self.name,
                source_record_id=f"{npi}-sample",
                kind="ENTITY",
                owner_first_name=first,
                owner_last_name=last,
                state="IL",
                npi=npi,
                entity_name=entity_name,
                entity_type=entity_type,
                entity_status="ACTIVE",
            )
