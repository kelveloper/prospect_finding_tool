"""Scoring engine.

Qualification (0-100): "should we care about this person?"
Timing (0-100): "why now?"
total = qualification * w_q + timing * w_t   (weights from settings)

Deterministic and fully traceable: every component maps to a signal.
"""
from dataclasses import dataclass

from app.scoring.detector import DetectedSignal

# Component weights within each sub-score (sum to 100)
QUAL_PHYSICIAN_POINTS = 55
QUAL_SPECIALTY_POINTS = 45
TIMING_LICENSE_POINTS = 70
TIMING_ENUMERATION_POINTS = 30


@dataclass(frozen=True)
class ScoreBreakdown:
    qualification_score: float
    timing_score: float
    total_score: float


class ScoringEngine:
    def __init__(self, qualification_weight: float = 0.60, timing_weight: float = 0.40):
        self.qualification_weight = qualification_weight
        self.timing_weight = timing_weight

    def score(self, signals: list[DetectedSignal]) -> ScoreBreakdown:
        qualification = self._qualification(signals)
        timing = self._timing(signals)
        total = round(
            qualification * self.qualification_weight + timing * self.timing_weight, 1
        )
        return ScoreBreakdown(
            qualification_score=round(qualification, 1),
            timing_score=round(timing, 1),
            total_score=total,
        )

    @staticmethod
    def _max_strength(signals: list[DetectedSignal], signal_type: str, source: str | None = None) -> float:
        matching = [
            s.strength
            for s in signals
            if s.signal_type == signal_type and (source is None or s.source == source)
        ]
        return max(matching, default=0.0)

    def _qualification(self, signals: list[DetectedSignal]) -> float:
        physician = self._max_strength(signals, "PHYSICIAN")
        specialty = self._max_strength(signals, "SPECIALTY")
        score = QUAL_PHYSICIAN_POINTS * physician + QUAL_SPECIALTY_POINTS * specialty
        return min(100.0, score)

    def _timing(self, signals: list[DetectedSignal]) -> float:
        license_recency = self._max_strength(signals, "NEW_LICENSE", source="idfpr")
        enumeration_recency = self._max_strength(signals, "NEW_LICENSE", source="npi")
        score = (
            TIMING_LICENSE_POINTS * license_recency
            + TIMING_ENUMERATION_POINTS * enumeration_recency
        )
        return min(100.0, score)
