from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Feedback


class FeedbackRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, feedback: Feedback) -> Feedback:
        self.db.add(feedback)
        return feedback

    def for_prospect(self, prospect_id: str) -> list[Feedback]:
        stmt = (
            select(Feedback)
            .where(Feedback.prospect_id == prospect_id)
            .order_by(Feedback.created_at.desc())
        )
        return list(self.db.scalars(stmt))
