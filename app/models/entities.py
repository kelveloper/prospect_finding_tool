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


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    verdict: Mapped[str] = mapped_column(String(20))  # good_fit | revisit_later | not_fit
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    prospect: Mapped[Prospect] = relationship(back_populates="feedback")
