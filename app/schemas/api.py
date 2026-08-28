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
    # Advisor-facing narrative (python -m app.summaries); UI prefers this
    # over reason_summary when present
    advisor_summary: str | None = None
    summary_source: str | None = None
    # Movement since the previous ingest; None until two snapshots exist
    score_change: float | None = None
    # Distinct detected signal types — powers the scoreboard category chips
    signal_types: list[str] = []
    # Latest logged outreach event type; None until the advisor acts
    outreach_status: str | None = None
    # Arrived in the book within the last 48 hours — NEW badge + alert
    is_new: bool = False


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


class ContactKitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prospect_id: str
    name: str
    mail: MailChannelOut
    phone: PhoneChannelOut
    primary_trigger: TriggerOut | None
    urgency: Literal["standard", "elevated"]
    rules: list[str]


class OutreachEventIn(BaseModel):
    # The quick buttons next to the contact info. Reasons ride in notes;
    # follow_up_on only applies to follow_up_later.
    event_type: Literal[
        "connected",
        "not_connected",
        "follow_up_later",
        "converted",
        "not_converted",
    ]
    channel: Literal["mail", "phone", "email", "other"] | None = None
    notes: str | None = None
    # Defaults to today server-side; advisors can back-date a logged call
    occurred_at: date | None = None
    follow_up_on: date | None = None


class OutreachEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prospect_id: str
    event_type: str
    channel: str | None
    notes: str | None
    occurred_at: date
    follow_up_on: date | None
    created_at: datetime


class FunnelBandOut(BaseModel):
    band: str  # e.g. "60-80"
    attempted: int  # distinct prospects with any outreach logged
    connected: int
    not_connected: int
    follow_up_later: int
    converted: int
    not_converted: int
    conversion_rate: float  # converted / attempted


class IngestStatusOut(BaseModel):
    # All None until the first recorded run
    last_run_at: datetime | None
    state: str | None
    prospects_created: int | None
    prospects_updated: int | None
    # Advisor summaries needing a refresh (python -m app.summaries --stale)
    stale_summaries: int


class IngestResult(BaseModel):
    records_ingested: int
    prospects_resolved: int
    prospects_created: int
    prospects_updated: int
    enrichment_records: int
    enrichment_matched: int
