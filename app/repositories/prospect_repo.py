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

    def ranked(
        self,
        limit: int = 50,
        tiers: set[str] | None = None,
        license_matched: bool | None = None,
        name_only_events: bool | None = None,
    ) -> list[Prospect]:
        """Best first. The identity filters are computed from the loaded
        matches rather than in SQL (a tier is a rule over reason strings),
        so with a filter on, the whole book is read and the limit applies
        after — rank order is preserved either way."""
        filtered = tiers is not None or license_matched is not None or name_only_events is not None
        stmt = (
            select(Prospect)
            .options(
                selectinload(Prospect.signals),
                selectinload(Prospect.score_history),
                # outreach_status serializes from this relationship; without
                # the eager load every ranked response lazy-loads it per row
                selectinload(Prospect.outreach_events),
                # identity_tier and friends read these — one query, not one per row
                selectinload(Prospect.identity_matches),
            )
            .order_by(Prospect.total_score.desc())
        )
        if not filtered:
            return list(self.db.scalars(stmt.limit(limit)))
        rows = [
            p
            for p in self.db.scalars(stmt)
            if (tiers is None or p.identity_tier in tiers)
            and (license_matched is None or p.license_matched == license_matched)
            and (name_only_events is None or p.has_name_only_events == name_only_events)
        ]
        return rows[:limit]

    def add(self, prospect: Prospect) -> Prospect:
        self.db.add(prospect)
        return prospect
