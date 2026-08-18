from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    signal_type: str
    source: str
    description: str
    strength: float
    event_date: date | None
    confidence: float


class RankedProspect(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str = Field(validation_alias="full_name")
    specialty: str | None
    state: str | None
    score: float = Field(validation_alias="total_score")
    qualification_score: float
    timing_score: float
    reason_summary: str | None


class ProspectDetail(RankedProspect):
    profession: str
    npi: str | None
    enumeration_date: date | None
    license_number: str | None
    license_issue_date: date | None
    license_status: str | None
    identity_confidence: float
    signals: list[SignalOut]


class FeedbackIn(BaseModel):
    prospect_id: str
    verdict: Literal["good_fit", "revisit_later", "not_fit"]
    notes: str | None = None


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prospect_id: str
    verdict: str
    notes: str | None
    created_at: datetime


class IngestResult(BaseModel):
    records_ingested: int
    prospects_resolved: int
    prospects_created: int
    prospects_updated: int
