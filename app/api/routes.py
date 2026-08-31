"""HTTP layer only — all business logic lives in services (clean-architecture NFR)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import httpx

from app.config import get_settings
from app.database import get_db
from app.outreach import ContactKitService, OutreachTrackingService
from app.outreach.tracking import NotTheLatestEventError, ProspectNotFoundError
from app.schemas import (
    IngestResult,
    ProspectDetail,
    RankedProspect,
)
from app.models import IngestRun
from app.services.live_ingest import (
    next_sweep_due_at,
    run_live_ingest,
    sweep_is_due,
)
from app.schemas.api import (
    ContactKitOut,
    FunnelBandOut,
    IngestStatusOut,
    OutreachEventIn,
    OutreachEventOut,
    ScoreComponent,
)
from app.summaries import count_stale
from app.scoring import ScoringEngine
from app.services import RankingService

router = APIRouter()


@router.post("/ingest/run", response_model=IngestResult)
def run_ingestion(
    state: str = Query(default="IL", min_length=2, max_length=2),
    limit: int = Query(default=25, ge=1, le=200, description="per specialty"),
    new_within_months: int | None = Query(
        default=None,
        ge=1,
        le=60,
        description=(
            "Discovery filter: only create unknown physicians whose NPI or "
            "state license is at most this many months old; existing "
            "prospects always update"
        ),
    ),
    force: bool = Query(
        default=False,
        description="Bypass the weekly gate (the nav's test sweep uses this)",
    ),
    db: Session = Depends(get_db),
):
    # Weekly cadence gate — the data sources barely move faster than this,
    # and it keeps a whole team from hammering four public APIs
    if not force and not sweep_is_due(db):
        due = next_sweep_due_at(db)
        raise HTTPException(
            status_code=429,
            detail=f"Weekly sweep already ran; next unlock {due:%Y-%m-%d %H:%M} UTC",
        )
    try:
        result = run_live_ingest(
            db, state=state, limit=limit, new_within_months=new_within_months
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External API error: {exc}")
    return IngestResult(**result.__dict__)


@router.get("/ingest/status", response_model=IngestStatusOut)
def ingest_status(db: Session = Depends(get_db)):
    """Latest ingest run plus how many advisor summaries it left stale."""
    last = db.query(IngestRun).order_by(IngestRun.ran_at.desc()).first()
    stale = count_stale(db)
    return IngestStatusOut(
        next_sweep_at=next_sweep_due_at(db),
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


@router.patch(
    "/prospects/{prospect_id}/outreach/{event_id}",
    response_model=OutreachEventOut,
)
def revise_outreach(
    prospect_id: str,
    event_id: str,
    payload: OutreachEventIn,
    db: Session = Depends(get_db),
):
    """Correct the most recently logged outreach event. Only event_type,
    notes and follow_up_on are revisable — the attempt's date and channel
    stay as first logged."""
    try:
        return OutreachTrackingService(db).revise(
            prospect_id,
            event_id,
            payload.event_type,
            payload.notes,
            payload.follow_up_on,
        )
    except ProspectNotFoundError:
        raise HTTPException(status_code=404, detail="Prospect not found")
    except NotTheLatestEventError:
        raise HTTPException(
            status_code=409,
            detail="Only the most recent outreach event can be revised",
        )


@router.get("/analytics/outreach-funnel", response_model=list[FunnelBandOut])
def outreach_funnel(db: Session = Depends(get_db)):
    """Conversion by score band — the model-recalibration view."""
    return OutreachTrackingService(db).funnel()


