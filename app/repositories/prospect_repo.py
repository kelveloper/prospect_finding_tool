from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Prospect


class ProspectRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, prospect_id: str) -> Prospect | None:
        return self.db.get(Prospect, prospect_id)

    def find_by_npi(self, npi: str) -> Prospect | None:
        return self.db.scalar(select(Prospect).where(Prospect.npi == npi))

    def find_by_name_state(self, full_name: str, state: str | None) -> Prospect | None:
        stmt = select(Prospect).where(Prospect.full_name == full_name)
        if state:
            stmt = stmt.where(Prospect.state == state)
        return self.db.scalar(stmt)

    def ranked(self, limit: int = 50) -> list[Prospect]:
        stmt = (
            select(Prospect)
            .options(
                selectinload(Prospect.signals),
                selectinload(Prospect.score_history),
                # outreach_status serializes from this relationship; without
                # the eager load every ranked response lazy-loads it per row
                selectinload(Prospect.outreach_events),
            )
            .order_by(Prospect.total_score.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def add(self, prospect: Prospect) -> Prospect:
        self.db.add(prospect)
        return prospect
