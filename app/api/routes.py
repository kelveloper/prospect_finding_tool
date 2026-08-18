"""HTTP layer only — all business logic lives in services (clean-architecture NFR)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.adapters import IDFPRDataSource, ILSoSDataSource, NPIDataSource
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
def run_ingestion(db: Session = Depends(get_db)):
    pipeline = IngestionPipeline(
        sources=[NPIDataSource(), IDFPRDataSource(), ILSoSDataSource()]
    )
    result = pipeline.run(db)
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
