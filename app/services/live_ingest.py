"""The full live sweep as one callable, plus the weekly-cadence gate.

No automation by design: the sweep runs only when a person triggers it.
The weekly gate simply keeps the main Refresh Data button honest — it
unlocks 7 days after the last recorded run (matching NPPES's weekly
update rhythm); the test sweep bypasses the gate explicitly.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.adapters import (
    CookCountyLiveDataSource,
    IDFPRLiveDataSource,
    NPPESDataSource,
)
from app.models import IngestRun
from app.services.pecos_sync import PECOSService
from app.services.pipeline import IngestionPipeline, PipelineResult
from app.services.ranking import RankingService
from app.summaries import apply as apply_summary, compose

# The weekly cadence: matched to NPPES's weekly update rhythm
SWEEP_INTERVAL_DAYS = 7


def run_live_ingest(
    db: Session,
    state: str = "IL",
    limit: int = 200,
    new_within_months: int | None = 6,
) -> PipelineResult:
    """Pull all four sources, upsert the book, record the run, and give
    every summary-less newcomer a composed narrative. Raises httpx errors
    to the caller."""
    # Phase 1: real physicians from NPPES. Phase 2: verify their
    # licenses against real IDFPR data, queried by license number.
    nppes = NPPESDataSource(state=state, limit_per_specialty=limit)
    records = list(nppes.fetch())
    if state.upper() == "IL":
        licenses = [r.license_number for r in records if r.license_number]
        records += list(IDFPRLiveDataSource(license_numbers=licenses).fetch())
    # PECOS: career moves + ownership inference, keyed by NPI
    npi_names = {r.npi: (r.first_name, r.last_name) for r in records if r.npi}
    pecos_records, _ = PECOSService(db).sync(npi_names)
    records += pecos_records
    # Cook County deeds: property purchases by our physicians' names
    if state.upper() == "IL":
        records += list(
            CookCountyLiveDataSource(buyer_names=npi_names.values()).fetch()
        )
    result = IngestionPipeline(sources=[]).run(
        db, records=records, new_within_months=new_within_months
    )

    # Book-level record of the run — powers "Data updated …" in the nav
    db.add(
        IngestRun(
            state=state.upper(),
            records_ingested=result.records_ingested,
            prospects_created=result.prospects_created,
            prospects_updated=result.prospects_updated,
        )
    )

    # Newcomers get a composed narrative immediately so no prospect ever
    # shows the raw pipeline text. Fill-empty-only: an existing (LLM)
    # summary is never overwritten — changed veterans stay flagged stale
    # until the offline LLM refresh upgrades them.
    for prospect in RankingService(db).ranked(limit=100_000):
        if prospect.advisor_summary is None:
            apply_summary(prospect, compose(prospect), source="composed")
    db.commit()
    return result


def next_sweep_due_at(db: Session) -> datetime | None:
    """When the weekly button unlocks; None means no run recorded yet."""
    last = db.query(IngestRun).order_by(IngestRun.ran_at.desc()).first()
    if last is None:
        return None
    ran_at = last.ran_at
    if ran_at.tzinfo is not None:
        ran_at = ran_at.astimezone(timezone.utc).replace(tzinfo=None)
    return ran_at + timedelta(days=SWEEP_INTERVAL_DAYS)


def sweep_is_due(db: Session) -> bool:
    due_at = next_sweep_due_at(db)
    if due_at is None:
        return True
    return datetime.now(timezone.utc).replace(tzinfo=None) >= due_at
