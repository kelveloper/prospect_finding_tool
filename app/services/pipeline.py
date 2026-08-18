"""End-to-end ingestion pipeline (spec section 3):

sources -> normalize -> identity resolution -> signal detection
        -> scoring -> reason summary -> persisted Prospect records

Re-running is idempotent: existing prospects (matched by NPI, else by
name+state) are updated in place with fresh signals and scores.
"""
from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.adapters.base import BaseDataSource
from app.config import get_settings
from app.identity.resolver import IdentityResolver, ResolvedProspect
from app.models import IdentityMatch, Prospect, Signal
from app.repositories import ProspectRepository
from app.scoring import ScoringEngine, SignalDetector, build_reason_summary


@dataclass(frozen=True)
class PipelineResult:
    records_ingested: int
    prospects_resolved: int
    prospects_created: int
    prospects_updated: int


class IngestionPipeline:
    def __init__(
        self,
        sources: list[BaseDataSource],
        resolver: IdentityResolver | None = None,
        detector: SignalDetector | None = None,
        engine: ScoringEngine | None = None,
    ):
        settings = get_settings()
        self.sources = sources
        self.resolver = resolver or IdentityResolver(settings.identity_match_threshold)
        self.detector = detector or SignalDetector()
        self.engine = engine or ScoringEngine(
            settings.qualification_weight, settings.timing_weight
        )

    def run(self, db: Session, reference_date: date | None = None) -> PipelineResult:
        reference_date = reference_date or date.today()
        repo = ProspectRepository(db)

        records = [r for source in self.sources for r in source.fetch()]
        resolved = self.resolver.resolve(records)

        created = updated = 0
        for profile in resolved:
            existing = self._find_existing(repo, profile)
            if existing:
                self._apply(existing, profile, reference_date)
                updated += 1
            else:
                prospect = Prospect()
                self._apply(prospect, profile, reference_date)
                repo.add(prospect)
                created += 1

        db.commit()
        return PipelineResult(
            records_ingested=len(records),
            prospects_resolved=len(resolved),
            prospects_created=created,
            prospects_updated=updated,
        )

    @staticmethod
    def _find_existing(
        repo: ProspectRepository, profile: ResolvedProspect
    ) -> Prospect | None:
        if profile.npi:
            found = repo.find_by_npi(profile.npi)
            if found:
                return found
        return repo.find_by_name_state(profile.full_name, profile.state)

    def _apply(
        self, prospect: Prospect, profile: ResolvedProspect, reference_date: date
    ) -> None:
        signals = self.detector.detect(profile, reference_date)
        breakdown = self.engine.score(signals)
        summary, _confidence = build_reason_summary(signals, breakdown)

        prospect.first_name = profile.first_name
        prospect.last_name = profile.last_name
        prospect.full_name = profile.full_name
        prospect.profession = "physician"
        prospect.specialty = profile.specialty
        prospect.state = profile.state
        prospect.npi = profile.npi
        prospect.enumeration_date = profile.enumeration_date
        prospect.license_number = profile.license_number
        prospect.license_issue_date = profile.license_issue_date
        prospect.license_status = profile.license_status
        prospect.qualification_score = breakdown.qualification_score
        prospect.timing_score = breakdown.timing_score
        prospect.total_score = breakdown.total_score
        prospect.reason_summary = summary
        prospect.identity_confidence = profile.identity_confidence

        prospect.signals = [
            Signal(
                signal_type=s.signal_type,
                source=s.source,
                description=s.description,
                strength=s.strength,
                event_date=s.event_date,
                confidence=s.confidence,
            )
            for s in signals
        ]
        prospect.identity_matches = [
            IdentityMatch(
                source_a=m.source_a,
                record_a_id=m.record_a_id,
                source_b=m.source_b,
                record_b_id=m.record_b_id,
                score=m.score,
                reason=m.reason,
            )
            for m in profile.matches
        ]
