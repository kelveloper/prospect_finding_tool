from sqlalchemy.orm import Session

from app.models import Prospect
from app.repositories import ProspectRepository
from app.scoring.engine import is_rankable, tier_for_standing


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
        """Best first, each row stamped with its standing in the whole book
        (rank, book_size, tier) before any filter or limit applies — a
        filtered list keeps true ranks and true bands."""
        everyone = self.repo.ranked(limit=1_000_000)
        self._stamp_standing(everyone)
        rows = everyone
        if tiers is not None or license_matched is not None or name_only_events is not None:
            rows = [
                p
                for p in everyone
                if (tiers is None or p.identity_tier in tiers)
                and (license_matched is None or p.license_matched == license_matched)
                and (name_only_events is None or p.has_name_only_events == name_only_events)
            ]
        return rows[:limit]

    def get(self, prospect_id: str) -> Prospect | None:
        """One prospect, stamped with its standing among everyone."""
        prospect = self.repo.get(prospect_id)
        if prospect is None:
            return None
        everyone = self.repo.ranked(limit=1_000_000)
        self._stamp_standing(everyone)
        for p in everyone:
            if p.id == prospect.id:
                prospect.rank, prospect.book_size, prospect.tier = p.rank, p.book_size, p.tier
                break
        else:
            prospect.rank, prospect.book_size, prospect.tier = 0, len(everyone), "poor"
        return prospect

    @staticmethod
    def _stamp_standing(ordered: list[Prospect]) -> None:
        """Bands by standing (app/scoring/engine.py TIER_SHARES). Gated rows
        (Priority 0) sort last and are never counted as ranked."""
        ranked = [p for p in ordered if is_rankable(p.license_status) and p.total_score > 0]
        book_size = len(ranked)
        position = {p.id: i + 1 for i, p in enumerate(ranked)}
        for i, p in enumerate(ordered):
            p.rank = i + 1
            p.book_size = book_size
            rank_among = position.get(p.id)
            p.tier = (
                tier_for_standing(rank_among, book_size)
                if rank_among is not None
                else "poor"
            )
