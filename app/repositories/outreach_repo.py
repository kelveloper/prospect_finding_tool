from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import OutreachEvent, Prospect


class OutreachRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, event: OutreachEvent) -> OutreachEvent:
        self.db.add(event)
        return event

    def for_prospect(self, prospect_id: str) -> list[OutreachEvent]:
        stmt = (
            select(OutreachEvent)
            .where(OutreachEvent.prospect_id == prospect_id)
            .order_by(OutreachEvent.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def latest(self, prospect_id: str) -> OutreachEvent | None:
        return next(iter(self.for_prospect(prospect_id)), None)

    def events_with_scores(self) -> list[tuple[str, str, float]]:
        """(prospect_id, event_type, current total_score) for every event —
        the raw material the conversion funnel aggregates."""
        stmt = select(
            OutreachEvent.prospect_id, OutreachEvent.event_type, Prospect.total_score
        ).join(Prospect, Prospect.id == OutreachEvent.prospect_id)
        return [tuple(row) for row in self.db.execute(stmt)]
