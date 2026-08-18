"""Feedback capture. No retraining — history is stored so a future model
can learn from advisor verdicts (spec section 10).
"""
from sqlalchemy.orm import Session

from app.models import Feedback
from app.repositories import FeedbackRepository, ProspectRepository

VALID_VERDICTS = ("good_fit", "revisit_later", "not_fit")


class ProspectNotFoundError(Exception):
    pass


class FeedbackService:
    def __init__(self, db: Session):
        self.db = db
        self.feedback_repo = FeedbackRepository(db)
        self.prospect_repo = ProspectRepository(db)

    def record(self, prospect_id: str, verdict: str, notes: str | None = None) -> Feedback:
        if self.prospect_repo.get(prospect_id) is None:
            raise ProspectNotFoundError(prospect_id)
        feedback = Feedback(prospect_id=prospect_id, verdict=verdict, notes=notes)
        self.feedback_repo.add(feedback)
        self.db.commit()
        return feedback

    def history(self, prospect_id: str) -> list[Feedback]:
        if self.prospect_repo.get(prospect_id) is None:
            raise ProspectNotFoundError(prospect_id)
        return self.feedback_repo.for_prospect(prospect_id)
