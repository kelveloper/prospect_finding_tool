"""Outreach + conversion tracking — what the advisor *did* and what
came of it.

The capture is deliberately two-click (spec: advisors act from the
profile, next to the contact info — no separate logging page):
    connected       — reached the prospect
    not_connected   — tried and couldn't (reason goes in notes)
    follow_up_later — connected; the prospect asked to reconnect on a date
    converted       — became a client
    not_converted   — reached but it went nowhere (reason goes in notes)

The score-band funnel built from these rows is the recalibration loop:
if 20-point prospects convert as often as 80-point ones, the weights
are wrong (spec section 10).
"""
from datetime import date

from sqlalchemy.orm import Session

from app.models import OutreachEvent
from app.repositories import OutreachRepository, ProspectRepository

VALID_EVENT_TYPES = (
    "connected",
    "not_connected",
    "follow_up_later",
    "converted",
    "not_converted",
)
VALID_CHANNELS = ("mail", "phone", "email", "other")


class ProspectNotFoundError(Exception):
    pass

# Score bands the funnel aggregates over: [0-20) ... [80-100]
BAND_WIDTH = 20.0


class OutreachTrackingService:
    def __init__(self, db: Session):
        self.db = db
        self.outreach_repo = OutreachRepository(db)
        self.prospect_repo = ProspectRepository(db)

    def record(
        self,
        prospect_id: str,
        event_type: str,
        channel: str | None = None,
        notes: str | None = None,
        occurred_at: date | None = None,
        follow_up_on: date | None = None,
    ) -> OutreachEvent:
        if self.prospect_repo.get(prospect_id) is None:
            raise ProspectNotFoundError(prospect_id)
        event = OutreachEvent(
            prospect_id=prospect_id,
            event_type=event_type,
            channel=channel,
            notes=notes,
            occurred_at=occurred_at or date.today(),
            follow_up_on=follow_up_on,
        )
        self.outreach_repo.add(event)
        self.db.commit()
        return event

    def history(self, prospect_id: str) -> list[OutreachEvent]:
        if self.prospect_repo.get(prospect_id) is None:
            raise ProspectNotFoundError(prospect_id)
        return self.outreach_repo.for_prospect(prospect_id)

    def funnel(self) -> list[dict]:
        """Conversion funnel per score band, highest band first.

        A prospect counts once per stage no matter how many events of that
        type were logged. 'attempted' is any logged event at all — clicking
        either quick button proves the advisor acted on the prospect."""
        stages: dict[str, dict[str, set[str]]] = {}
        for prospect_id, event_type, total_score in (
            self.outreach_repo.events_with_scores()
        ):
            band = self._band(total_score)
            band_stages = stages.setdefault(
                band, {t: set() for t in (*VALID_EVENT_TYPES, "attempted")}
            )
            band_stages[event_type].add(prospect_id)
            band_stages["attempted"].add(prospect_id)

        bands = []
        for band in sorted(stages, reverse=True):
            by_stage = stages[band]
            attempted = len(by_stage["attempted"])
            converted = len(by_stage["converted"])
            bands.append(
                {
                    "band": band,
                    "attempted": attempted,
                    "connected": len(by_stage["connected"]),
                    "not_connected": len(by_stage["not_connected"]),
                    "follow_up_later": len(by_stage["follow_up_later"]),
                    "converted": converted,
                    "not_converted": len(by_stage["not_converted"]),
                    "conversion_rate": (
                        round(converted / attempted, 3) if attempted else 0.0
                    ),
                }
            )
        return bands

    @staticmethod
    def _band(total_score: float) -> str:
        low = min(int(total_score // BAND_WIDTH), 4) * int(BAND_WIDTH)
        return f"{low}-{low + int(BAND_WIDTH)}"
