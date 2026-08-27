import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    full_name: Mapped[str] = mapped_column(String(200), index=True)
    profession: Mapped[str] = mapped_column(String(50), default="physician")
    specialty: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(2), index=True)

    npi: Mapped[str | None] = mapped_column(String(10), unique=True, index=True)
    enumeration_date: Mapped[date | None] = mapped_column(Date)
    license_number: Mapped[str | None] = mapped_column(String(30))
    license_issue_date: Mapped[date | None] = mapped_column(Date)
    license_status: Mapped[str | None] = mapped_column(String(30))
    address_line: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    address_state: Mapped[str | None] = mapped_column(String(2))
    zip_code: Mapped[str | None] = mapped_column(String(10))
    phone: Mapped[str | None] = mapped_column(String(20))

    qualification_score: Mapped[float] = mapped_column(Float, default=0.0)
    timing_score: Mapped[float] = mapped_column(Float, default=0.0)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    reason_summary: Mapped[str | None] = mapped_column(Text)
    identity_confidence: Mapped[float] = mapped_column(Float, default=1.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    signals: Mapped[list["Signal"]] = relationship(
        back_populates="prospect", cascade="all, delete-orphan"
    )
    identity_matches: Mapped[list["IdentityMatch"]] = relationship(
        back_populates="prospect", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["Feedback"]] = relationship(
        back_populates="prospect", cascade="all, delete-orphan"
    )
    score_history: Mapped[list["ScoreSnapshot"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
        order_by="ScoreSnapshot.recorded_at",
    )
    field_changes: Mapped[list["FieldChange"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
        order_by="FieldChange.changed_at",
    )

    @property
    def signal_types(self) -> list[str]:
        """Distinct detected signal types — the scoreboard's quick overview."""
        return sorted({s.signal_type for s in self.signals})

    @property
    def score_change(self) -> float | None:
        """Movement since the previous ingest; None until two snapshots exist."""
        if len(self.score_history) < 2:
            return None
        return round(
            self.score_history[-1].total_score - self.score_history[-2].total_score, 1
        )


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    signal_type: Mapped[str] = mapped_column(String(40), index=True)
    source: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    strength: Mapped[float] = mapped_column(Float)  # 0.0 - 1.0
    event_date: Mapped[date | None] = mapped_column(Date)
    confidence: Mapped[float] = mapped_column(Float)  # 0.0 - 1.0
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="signals")


class ScoreSnapshot(Base):
    """One row per prospect per ingest run — the score trajectory over time.

    The prospect row always holds the *current* score; this table keeps the
    history so movement is visible: a new property purchase pushes a prospect
    up, an aging license decays them down, and both survive re-ingests."""

    __tablename__ = "score_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    qualification_score: Mapped[float] = mapped_column(Float)
    timing_score: Mapped[float] = mapped_column(Float)
    total_score: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="score_history")


class FieldChange(Base):
    """Append-only 'changed from → to' record for captured fields.

    Written by the pipeline upsert when a re-ingested value differs from the
    stored one (cosmetic case/format-only diffs are skipped). Tier drives
    display: 'score' fields move points, 'contact' fields change where the
    advisor reaches out, 'identity' fields should rarely change and get a
    caution flag."""

    __tablename__ = "field_changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    field: Mapped[str] = mapped_column(String(40))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(String(10))  # score | contact | identity
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="field_changes")


class IdentityMatch(Base):
    __tablename__ = "identity_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    source_a: Mapped[str] = mapped_column(String(40))
    record_a_id: Mapped[str] = mapped_column(String(60))
    source_b: Mapped[str] = mapped_column(String(40))
    record_b_id: Mapped[str] = mapped_column(String(60))
    score: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="identity_matches")


class AffiliationSnapshot(Base):
    """Point-in-time record of a physician's PECOS group/facility links.
    Career-move events are detected by diffing successive snapshots."""

    __tablename__ = "affiliation_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    npi: Mapped[str] = mapped_column(String(10), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # "group" | "facility"
    item_key: Mapped[str] = mapped_column(String(60))   # group PAC id / facility cert #
    item_name: Mapped[str] = mapped_column(String(200))  # group legal name / facility type
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class CareerEvent(Base):
    """A detected career move (new group, new facility). Persisted so the
    event keeps its detection date across re-ingests."""

    __tablename__ = "career_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    npi: Mapped[str] = mapped_column(String(10), index=True)
    event_kind: Mapped[str] = mapped_column(String(30))  # NEW_GROUP | NEW_FACILITY
    organization: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    detected_at: Mapped[date] = mapped_column(Date)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    verdict: Mapped[str] = mapped_column(String(20))  # good_fit | revisit_later | not_fit
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="feedback")
