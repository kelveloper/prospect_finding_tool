"""Advisor-summary composer — the deterministic fallback.

Builds the four-beat narrative (hook + rank, why now, money in motion,
watch-outs) from stored facts only. The `python -m app.summaries` CLI
writes its output to Prospect.advisor_summary with source="composed";
imported LLM text uses the same column with source="llm" and wins in
the UI simply by being what's stored.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import OutreachEvent, Prospect

HIGH_EARNING_STRENGTH = 0.75


def _stale(
    summary: str | None,
    generated_at: datetime | None,
    updated_at: datetime | None,
    last_event_at: datetime | None,
) -> bool:
    """No summary yet, facts changed since it was written, or the advisor
    acted on the prospect after it was written.

    Writing the summary itself bumps updated_at (onupdate) a moment after
    summary_generated_at, so the comparison carries a short tolerance —
    only a *later* fact change marks the row stale."""
    if summary is None or generated_at is None:
        return True
    threshold = generated_at + timedelta(seconds=5)
    if updated_at and updated_at > threshold:
        return True
    return last_event_at is not None and last_event_at > threshold


def is_stale(p: Prospect) -> bool:
    last_event_at = max((e.created_at for e in p.outreach_events), default=None)
    return _stale(
        p.advisor_summary, p.summary_generated_at, p.updated_at, last_event_at
    )


def count_stale(db: Session) -> int:
    """Book-wide stale count for /ingest/status. Reads only the three
    timestamp/summary columns plus each prospect's latest outreach event —
    never hydrates Prospect rows, which made the old per-object sweep cost
    half a second at ~1,200 prospects."""
    latest_event_at = dict(
        db.execute(
            select(
                OutreachEvent.prospect_id, func.max(OutreachEvent.created_at)
            ).group_by(OutreachEvent.prospect_id)
        ).all()
    )
    rows = db.execute(
        select(
            Prospect.id,
            Prospect.advisor_summary,
            Prospect.summary_generated_at,
            Prospect.updated_at,
        )
    )
    return sum(
        _stale(summary, generated_at, updated_at, latest_event_at.get(pid))
        for pid, summary, generated_at, updated_at in rows
    )


def _months_ago(d: date | None) -> int | None:
    if d is None:
        return None
    today = date.today()
    return max(0, (today.year - d.year) * 12 + (today.month - d.month))


def _when(d: date | None) -> str:
    months = _months_ago(d)
    if months is None:
        return "recently"
    if months == 0:
        return "this month"
    if months == 1:
        return "last month"
    if months < 12:
        return f"{months} months ago"
    years = months // 12
    return f"{years} year{'s' if years > 1 else ''} ago"


def _strongest(prospect: Prospect, signal_type: str):
    matches = [s for s in prospect.signals if s.signal_type == signal_type]
    return max(matches, key=lambda s: s.strength, default=None)


def compose(prospect: Prospect) -> str:
    """Rank is deliberately never written into the text — the UI computes
    it live, so summaries stay true when new prospects enter the book."""
    sentences: list[str] = []

    # ── Beat 1: hook — who and the most striking fact ──
    specialty = prospect.specialty or "Physician"
    place = prospect.city or prospect.state or "Illinois"
    hook = f"{specialty} in {place}"
    license_months = _months_ago(prospect.license_issue_date)
    if license_months is not None and license_months <= 6:
        hook += f" — newly licensed in Illinois {_when(prospect.license_issue_date)}"
    sentences.append(hook + ".")

    # ── Beat 2: why now — the dated transitions ──
    npi_years = None
    if prospect.enumeration_date:
        npi_years = (date.today() - prospect.enumeration_date).days // 365
    if npi_years and npi_years >= 3 and license_months is not None and license_months <= 6:
        sentences.append(
            f"The NPI dates back {npi_years} years, so this is an established "
            f"physician relocating into Illinois — not a fresh graduate — and "
            f"relocations are when financial relationships get rebuilt."
        )
    ownership = _strongest(prospect, "OWNERSHIP")
    if ownership:
        sentences.append(
            f"Practice ownership detected {_when(ownership.event_date)}: "
            f"{ownership.description.rstrip('.')}."
        )
    career = _strongest(prospect, "CAREER_ADVANCEMENT")
    if career:
        sentences.append(
            f"Career move {_when(career.event_date)}: {career.description.rstrip('.')}."
        )

    # ── Beat 3: money in motion ──
    prop = _strongest(prospect, "PROPERTY_EVENT")
    if prop:
        sentences.append(
            f"A property purchase {_when(prop.event_date)} says money is "
            f"moving now — timing is on your side."
        )

    # ── Beat 4: watch-outs — only when real ──
    if prospect.identity_confidence < 0.9:
        sentences.append(
            "Identity is single-source — verify before reaching out."
        )
    events = list(prospect.outreach_events)
    if events:
        last = events[-1]
        label = last.event_type.replace("_", " ")
        line = f"Your last action: {label} on {last.occurred_at:%b %-d}"
        if last.follow_up_on:
            line += f", follow-up set for {last.follow_up_on:%b %-d}"
        sentences.append(line + ".")

    if len(sentences) == 1 and not prospect.signals:
        sentences.append("No signals captured yet beyond the license record.")

    return " ".join(sentences)


def apply(prospect: Prospect, text: str, source: str) -> None:
    prospect.advisor_summary = text
    prospect.summary_source = source
    prospect.summary_generated_at = datetime.now(timezone.utc)
