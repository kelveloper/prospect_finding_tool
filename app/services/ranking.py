from sqlalchemy.orm import Session

from app.models import Prospect
from app.repositories import ProspectRepository


class RankingService:
    def __init__(self, db: Session):
        self.repo = ProspectRepository(db)

    def ranked(self, limit: int = 50) -> list[Prospect]:
        return self.repo.ranked(limit=limit)

    def get(self, prospect_id: str) -> Prospect | None:
        return self.repo.get(prospect_id)
