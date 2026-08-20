"""Scoring engine.

Qualification (0-100): "should we care about this person?"
Timing (0-100): "why now?"
total = qualification * w_q + timing * w_t   (weights from settings)

Component weights are per-signal-type maps; each component contributes
weight × strongest matching signal. Deterministic and fully traceable.
"""
from dataclasses import dataclass

from app.scoring.detector import DetectedSignal

# Qualification components (points sum to 100).
# Ownership of a practice entity marks the "ownership" step of the
# emerging-affluent hypothesis chain.
QUAL_WEIGHTS: dict[str, float] = {
    "PHYSICIAN": 40,
    "SPECIALTY": 35,
    "OWNERSHIP": 25,
}

# Timing components (points sum to 100), keyed by (signal_type, source);
# source None matches any source. A recent property purchase is the
# "financial event" step; a fresh appointment is a career inflection.
TIMING_WEIGHTS: dict[tuple[str, str | None], float] = {
    ("NEW_LICENSE", "idfpr"): 40,
    ("NEW_LICENSE", "npi"): 15,
    ("PROPERTY_EVENT", None): 30,
    ("CAREER_ADVANCEMENT", None): 15,
}


# Human-readable component names for the score-breakdown API
QUAL_LABELS: dict[str, str] = {
    "PHYSICIAN": "Physician standing",
    "SPECIALTY": "Specialty earning tier",
    "OWNERSHIP": "Practice ownership",
}
TIMING_LABELS: dict[tuple[str, str | None], str] = {
    ("NEW_LICENSE", "idfpr"): "License recency",
    ("NEW_LICENSE", "npi"): "Practice entry (NPI enumeration)",
    ("PROPERTY_EVENT", None): "Property purchase recency",
    ("CAREER_ADVANCEMENT", None): "Career advancement",
}


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

    def components(self, signals: list[DetectedSignal]) -> list[dict]:
        """Per-component contributions for explainability. Works on any
        objects with signal_type/source/strength (detected or stored
        Signal rows). Zero-strength components are included on purpose —
        they show what a prospect is missing."""
        out: list[dict] = []
        for signal_type, weight in QUAL_WEIGHTS.items():
            strength = self._max_strength(signals, signal_type)
            out.append({
                "category": "qualification",
                "label": QUAL_LABELS[signal_type],
                "signal_type": signal_type,
                "max_points": weight,
                "strength": round(strength, 2),
                "points": round(weight * strength, 1),
            })
        for (signal_type, source), weight in TIMING_WEIGHTS.items():
            strength = self._max_strength(signals, signal_type, source)
            out.append({
                "category": "timing",
                "label": TIMING_LABELS[(signal_type, source)],
                "signal_type": signal_type,
                "max_points": weight,
                "strength": round(strength, 2),
                "points": round(weight * strength, 1),
            })
        return out

    @staticmethod
    def _max_strength(
        signals: list[DetectedSignal], signal_type: str, source: str | None = None
    ) -> float:
        matching = [
            s.strength
            for s in signals
            if s.signal_type == signal_type and (source is None or s.source == source)
        ]
        return max(matching, default=0.0)

    def _qualification(self, signals: list[DetectedSignal]) -> float:
        score = sum(
            weight * self._max_strength(signals, signal_type)
            for signal_type, weight in QUAL_WEIGHTS.items()
        )
        return min(100.0, score)

    def _timing(self, signals: list[DetectedSignal]) -> float:
        score = sum(
            weight * self._max_strength(signals, signal_type, source)
            for (signal_type, source), weight in TIMING_WEIGHTS.items()
        )
        return min(100.0, score)
