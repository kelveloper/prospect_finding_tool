"""PECOS sync: snapshot → diff → career events + ownership inference.

Called during live ingestion with the NPIs we already resolved. Produces
EnrichmentRecords (NPI-keyed, attach at confidence 1.0):

- CAREER records for detected changes (new billing group, new facility
  affiliation) — events persist in `career_events` so their detection date
  survives re-ingests and the recency decay works over time.
- ENTITY records (ownership *inference*) when a physician bills Medicare
  under a group whose legal name contains their own last name, e.g.
  "Smith Orthopedics PLLC" — corroborates the business-registry signal.
"""
import re
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.base import EnrichmentRecord
from app.adapters.pecos.client import PECOSClient
from app.identity.resolver import normalize_name_part
from app.models import AffiliationSnapshot, CareerEvent

ENTITY_SUFFIXES = ("PLLC", "PC", "SC", "LLC", "LTD")


@dataclass(frozen=True)
class PECOSSyncResult:
    groups_seen: int
    facilities_seen: int
    new_events: int
    ownership_inferences: int


class PECOSService:
    def __init__(self, db: Session, client: PECOSClient | None = None):
        self.db = db
        self.client = client or PECOSClient()

    def sync(
        self,
        npi_names: dict[str, tuple[str, str]],  # npi -> (first, last)
        reference_date: date | None = None,
    ) -> tuple[list[EnrichmentRecord], PECOSSyncResult]:
        reference_date = reference_date or date.today()
        npis = list(npi_names)
        if not npis:
            return [], PECOSSyncResult(0, 0, 0, 0)

        groups = self.client.group_reassignments(npis)
        facilities = self.client.facility_affiliations(npis)

        current: dict[str, list[tuple[str, str, str]]] = {}  # npi -> [(kind, key, name)]
        for g in groups:
            if g["npi"] in npi_names and g["group_pac_id"]:
                current.setdefault(g["npi"], []).append(
                    ("group", g["group_pac_id"], g["group_name"])
                )
        for f in facilities:
            if f["npi"] in npi_names:
                current.setdefault(f["npi"], []).append(
                    ("facility", f["cert_number"], f["facility_type"])
                )

        new_events = self._diff_and_store(current, reference_date)
        self.db.flush()  # session has autoflush=False; make new events queryable
        records = self._career_records(npi_names)
        ownership = self._ownership_inferences(current, npi_names)

        self.db.commit()
        return records + ownership, PECOSSyncResult(
            groups_seen=len(groups),
            facilities_seen=len(facilities),
            new_events=new_events,
            ownership_inferences=len(ownership),
        )

    # ── internals ────────────────────────────────────────────

    def _previous_keys(self, npi: str) -> set[tuple[str, str]] | None:
        """Keys from the stored snapshot; None if this NPI was never synced."""
        rows = list(
            self.db.scalars(
                select(AffiliationSnapshot).where(AffiliationSnapshot.npi == npi)
            )
        )
        if not rows:
            return None
        return {(r.kind, r.item_key) for r in rows}

    def _diff_and_store(
        self, current: dict[str, list[tuple[str, str, str]]], reference_date: date
    ) -> int:
        new_events = 0
        for npi, items in current.items():
            previous = self._previous_keys(npi)
            current_keys = {(kind, key) for kind, key, _ in items}

            if previous is not None:
                for kind, key, name in items:
                    if (kind, key) not in previous:
                        # A genuinely new association since the last snapshot
                        if kind == "group":
                            desc = f"Started billing under new group '{name}'"
                            event_kind = "NEW_GROUP"
                        else:
                            desc = f"New {name.lower()} affiliation (facility #{key})"
                            event_kind = "NEW_FACILITY"
                        self.db.add(
                            CareerEvent(
                                npi=npi,
                                event_kind=event_kind,
                                organization=name,
                                description=desc,
                                detected_at=reference_date,
                            )
                        )
                        new_events += 1

                if previous != current_keys:
                    self._replace_snapshot(npi, items)
            else:
                # First sync for this NPI: seed the baseline, no events
                self._replace_snapshot(npi, items)
        return new_events

    def _replace_snapshot(self, npi: str, items: list[tuple[str, str, str]]) -> None:
        for row in self.db.scalars(
            select(AffiliationSnapshot).where(AffiliationSnapshot.npi == npi)
        ):
            self.db.delete(row)
        for kind, key, name in items:
            self.db.add(
                AffiliationSnapshot(npi=npi, kind=kind, item_key=key, item_name=name)
            )

    def _career_records(
        self, npi_names: dict[str, tuple[str, str]]
    ) -> list[EnrichmentRecord]:
        """All stored career events (old + new) as CAREER enrichment records."""
        records = []
        events = self.db.scalars(
            select(CareerEvent).where(CareerEvent.npi.in_(list(npi_names)))
        )
        for e in events:
            first, last = npi_names[e.npi]
            records.append(
                EnrichmentRecord(
                    source="pecos",
                    source_record_id=e.id,
                    kind="CAREER",
                    owner_first_name=first,
                    owner_last_name=last,
                    npi=e.npi,
                    event_date=e.detected_at,
                    role_title=e.description,
                    organization=e.organization,
                )
            )
        return records

    def _ownership_inferences(
        self,
        current: dict[str, list[tuple[str, str, str]]],
        npi_names: dict[str, tuple[str, str]],
    ) -> list[EnrichmentRecord]:
        """Billing under a group named after yourself ≈ you own the practice."""
        records = []
        for npi, items in current.items():
            first, last = npi_names[npi]
            last_norm = normalize_name_part(last)
            for kind, key, name in items:
                if kind != "group" or not name:
                    continue
                name_norm = normalize_name_part(name)
                if last_norm and re.search(rf"\b{re.escape(last_norm)}\b", name_norm):
                    suffix = next(
                        (s for s in ENTITY_SUFFIXES if name.upper().rstrip(".").endswith(s)),
                        None,
                    )
                    records.append(
                        EnrichmentRecord(
                            source="pecos",
                            source_record_id=f"{npi}-{key}",
                            kind="ENTITY",
                            owner_first_name=first,
                            owner_last_name=last,
                            npi=npi,
                            entity_name=name,
                            entity_type=suffix or "LLC",
                            entity_status="ACTIVE",  # they are actively billing under it
                        )
                    )
        return records
