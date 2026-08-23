"""HTTP layer only — all business logic lives in services (clean-architecture NFR)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from typing import Literal

import httpx

from app.adapters import (
    AffiliationsDataSource,
    CookCountyDataSource,
    IDFPRDataSource,
    IDFPRLiveDataSource,
    ILSoSDataSource,
    NPIDataSource,
    NPPESDataSource,
)
from app.config import get_settings
from app.database import get_db
from app.feedback.service import FeedbackService, ProspectNotFoundError
from app.schemas import (
    FeedbackIn,
    FeedbackOut,
    IngestResult,
    ProspectDetail,
    RankedProspect,
)
from app.schemas.api import ScoreComponent
from app.scoring import ScoringEngine
from app.services import IngestionPipeline, RankingService
from app.services.pecos_sync import PECOSService

router = APIRouter()


@router.post("/ingest/run", response_model=IngestResult)
def run_ingestion(
    mode: Literal["sample", "live"] = Query(default="sample"),
    state: str = Query(default="IL", min_length=2, max_length=2),
    limit: int = Query(default=50, ge=1, le=200, description="per specialty, live mode"),
    db: Session = Depends(get_db),
):
    try:
        if mode == "live":
            # Phase 1: real physicians from NPPES. Phase 2: verify their
            # licenses against real IDFPR data, queried by license number.
            # Sample files are excluded — they must never attach to real
            # people who happen to share a sample name.
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
            result = IngestionPipeline(sources=[]).run(db, records=records)
        else:
            # Full showcase pipeline: provider sources + all three
            # enrichment signals (ownership, property, career) on mock data
            pipeline = IngestionPipeline(
                sources=[
                    NPIDataSource(),
                    IDFPRDataSource(),
                    ILSoSDataSource(),
                    CookCountyDataSource(),
                    AffiliationsDataSource(),
                ]
            )
            result = pipeline.run(db)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External API error: {exc}")
    return IngestResult(**result.__dict__)


@router.get("/prospects/ranked", response_model=list[RankedProspect])
def ranked_prospects(
    limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)
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


@router.post("/feedback", response_model=FeedbackOut, status_code=201)
def submit_feedback(payload: FeedbackIn, db: Session = Depends(get_db)):
    try:
        return FeedbackService(db).record(
            payload.prospect_id, payload.verdict, payload.notes
        )
    except ProspectNotFoundError:
        raise HTTPException(status_code=404, detail="Prospect not found")


@router.get("/prospects/{prospect_id}/feedback", response_model=list[FeedbackOut])
def feedback_history(prospect_id: str, db: Session = Depends(get_db)):
    try:
        return FeedbackService(db).history(prospect_id)
    except ProspectNotFoundError:
        raise HTTPException(status_code=404, detail="Prospect not found")
