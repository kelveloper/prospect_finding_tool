"""HTTP layer only — all business logic lives in services (clean-architecture NFR)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from typing import Literal

import httpx

from app.adapters import (
    IDFPRDataSource,
    IDFPRLiveDataSource,
    ILSoSDataSource,
    NPIDataSource,
    NPPESDataSource,
)
from app.database import get_db
from app.feedback.service import FeedbackService, ProspectNotFoundError
from app.schemas import (
    FeedbackIn,
    FeedbackOut,
    IngestResult,
    ProspectDetail,
    RankedProspect,
)
from app.services import IngestionPipeline, RankingService

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
            result = IngestionPipeline(sources=[]).run(db, records=records)
        else:
            pipeline = IngestionPipeline(
                sources=[NPIDataSource(), IDFPRDataSource(), ILSoSDataSource()]
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
    return prospect


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
