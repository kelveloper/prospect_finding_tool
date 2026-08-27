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


class ScoreSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    qualification_score: float
    timing_score: float
    total_score: float
    recorded_at: datetime


class RankedProspect(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str = Field(validation_alias="full_name")
    specialty: str | None
    state: str | None
    city: str | None
    score: float = Field(validation_alias="total_score")
    qualification_score: float
    timing_score: float
    reason_summary: str | None
    # Movement since the previous ingest; None until two snapshots exist
    score_change: float | None = None
    # Distinct detected signal types — powers the scoreboard category chips
    signal_types: list[str] = []


class ScoreComponent(BaseModel):
    category: Literal["qualification", "timing"]
    label: str
    signal_type: str
    max_points: float
    strength: float
    points: float


class FieldChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    field: str
    old_value: str | None
    new_value: str | None
    tier: Literal["score", "contact", "identity"]
    changed_at: datetime


class IdentityMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_a: str
    source_b: str
    score: float
    reason: str


class ProspectDetail(RankedProspect):
    profession: str
    npi: str | None
    enumeration_date: date | None
    license_number: str | None
    license_issue_date: date | None
    license_status: str | None
    address_line: str | None
    address_state: str | None
    zip_code: str | None
    phone: str | None
    identity_confidence: float
    signals: list[SignalOut]
    score_components: list[ScoreComponent] = []
    score_history: list[ScoreSnapshotOut] = []
    # The audit trail: every merge/attach decision with its tier and score
    identity_matches: list[IdentityMatchOut] = []
    # Captured-field changes across ingests, oldest first
    field_changes: list[FieldChangeOut] = []


class MailChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_line: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    complete: bool


class PhoneChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    number: str | None
    note: str


class TriggerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    signal_type: str
    description: str
    event_date: date | None


class LetterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    salutation: str
    body: str


class ContactKitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prospect_id: str
    name: str
    mail: MailChannelOut
    phone: PhoneChannelOut
    primary_trigger: TriggerOut | None
    letter: LetterOut
    urgency: Literal["standard", "elevated"]
    rules: list[str]


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
    enrichment_records: int
    enrichment_matched: int
