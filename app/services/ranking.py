from sqlalchemy.orm import Session

from app.models import Prospect
from app.repositories import ProspectRepository


class RankingService:
    def __init__(self, db: Session):
        self.repo = ProspectRepository(db)

    def ranked(
        self,
        limit: int = 50,
        tiers: set[str] | None = None,
        license_matched: bool | None = None,
        name_only_events: bool | None = None,
    ) -> list[Prospect]:
        return self.repo.ranked(
            limit=limit,
            tiers=tiers,
            license_matched=license_matched,
            name_only_events=name_only_events,
        )

    def get(self, prospect_id: str) -> Prospect | None:
        return self.repo.get(prospect_id)
