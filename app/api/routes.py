"""HTTP layer only — all business logic lives in services (clean-architecture NFR)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import httpx

from app.adapters import (
    CookCountyLiveDataSource,
    IDFPRLiveDataSource,
    NPPESDataSource,
)
from app.config import get_settings
from app.database import get_db
from app.outreach import ContactKitService, OutreachTrackingService
from app.outreach.tracking import ProspectNotFoundError
from app.schemas import (
    IngestResult,
    ProspectDetail,
    RankedProspect,
)
from app.models import IngestRun
from app.schemas.api import (
    ContactKitOut,
    FunnelBandOut,
    IngestStatusOut,
    OutreachEventIn,
    OutreachEventOut,
    ScoreComponent,
)
from app.summaries import apply as apply_summary, compose, is_stale
from app.scoring import ScoringEngine
from app.services import IngestionPipeline, RankingService
from app.services.pecos_sync import PECOSService

router = APIRouter()


@router.post("/ingest/run", response_model=IngestResult)
def run_ingestion(
    state: str = Query(default="IL", min_length=2, max_length=2),
    limit: int = Query(default=25, ge=1, le=200, description="per specialty"),
    db: Session = Depends(get_db),
):
    try:
        # Phase 1: real physicians from NPPES. Phase 2: verify their
        # licenses against real IDFPR data, queried by license number.
        nppes = NPPESDataSource(state=state, limit_per_specialty=limit)
        records = list(nppes.fetch())
        if state.upper() == "IL":
            licenses = [r.license_number for r in records if r.license_number]
            records += list(IDFPRLiveDataSource(license_numbers=licenses).fetch())
        # PECOS: career moves + ownership inference, keyed by NPI
        npi_names = {
            r.npi: (r.first_name, r.last_name) for r in records if r.npi
        }
        pecos_records, _ = PECOSService(db).sync(npi_names)
        records += pecos_records
        # Cook County deeds: property purchases by our physicians' names
        if state.upper() == "IL":
            records += list(
                CookCountyLiveDataSource(buyer_names=npi_names.values()).fetch()
            )
        result = IngestionPipeline(sources=[]).run(db, records=records)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External API error: {exc}")

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
    # summary is never overwritten here — changed veterans stay flagged
    # stale until the offline LLM refresh upgrades them.
    for prospect in RankingService(db).ranked(limit=100_000):
        if prospect.advisor_summary is None:
            apply_summary(prospect, compose(prospect), source="composed")
    db.commit()
    return IngestResult(**result.__dict__)


@router.get("/ingest/status", response_model=IngestStatusOut)
def ingest_status(db: Session = Depends(get_db)):
    """Latest ingest run plus how many advisor summaries it left stale."""
    last = db.query(IngestRun).order_by(IngestRun.ran_at.desc()).first()
    stale = sum(1 for p in RankingService(db).ranked(limit=100_000) if is_stale(p))
    return IngestStatusOut(
        last_run_at=last.ran_at if last else None,
        state=last.state if last else None,
        prospects_created=last.prospects_created if last else None,
        prospects_updated=last.prospects_updated if last else None,
        stale_summaries=stale,
    )


@router.get("/prospects/ranked", response_model=list[RankedProspect])
def ranked_prospects(
    limit: int = Query(default=50, ge=1, le=5000), db: Session = Depends(get_db)
):
    return RankingService(db).ranked(limit=limit)


@router.get("/prospects/{prospect_id}", response_model=ProspectDetail)
def prospect_detail(prospect_id: str, db: Session = Depends(get_db)):
    prospect = RankingService(db).get(prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Recompute per-component contributions from the stored signals so the
    # UI can show exactly where each point came from
    settings = get_settings()
    engine = ScoringEngine(settings.qualification_weight, settings.timing_weight)
    detail = ProspectDetail.model_validate(prospect)
    detail.score_components = [
        ScoreComponent(**c) for c in engine.components(prospect.signals)
    ]
    return detail


@router.get("/prospects/{prospect_id}/contact-kit", response_model=ContactKitOut)
def contact_kit(prospect_id: str, db: Session = Depends(get_db)):
    prospect = RankingService(db).get(prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return ContactKitOut.model_validate(ContactKitService().build(prospect))


@router.post(
    "/prospects/{prospect_id}/outreach",
    response_model=OutreachEventOut,
    status_code=201,
)
def log_outreach(
    prospect_id: str, payload: OutreachEventIn, db: Session = Depends(get_db)
):
    try:
        return OutreachTrackingService(db).record(
            prospect_id,
            payload.event_type,
            payload.channel,
            payload.notes,
            payload.occurred_at,
            payload.follow_up_on,
        )
    except ProspectNotFoundError:
        raise HTTPException(status_code=404, detail="Prospect not found")


@router.get(
    "/prospects/{prospect_id}/outreach", response_model=list[OutreachEventOut]
)
def outreach_history(prospect_id: str, db: Session = Depends(get_db)):
    try:
        return OutreachTrackingService(db).history(prospect_id)
    except ProspectNotFoundError:
        raise HTTPException(status_code=404, detail="Prospect not found")


@router.get("/analytics/outreach-funnel", response_model=list[FunnelBandOut])
def outreach_funnel(db: Session = Depends(get_db)):
    """Conversion by score band — the model-recalibration view."""
    return OutreachTrackingService(db).funnel()


