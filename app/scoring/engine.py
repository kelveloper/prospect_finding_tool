"""Scoring engine.

Two questions, kept as two numbers, then combined:

  Value   (0–100)  "is there money here?"  — three facts that are all true
                    at once, so their points ADD: specialty 45, ownership 25,
                    career stage 30.
  Timing  (0–100)  "did something just happen?" — the single strongest fresh
                    event, never a sum: weight × half-life decay (baked into
                    the signal's strength) × identity confidence.

  Priority = Value × (floor + (1 − floor) × Timing / 100)      floor = 0.6

Timing decides how much of a prospect's own value they keep, 60% to 100%.
It never lifts a poor fit above a strong one: you can wait for a good
prospect, you cannot turn a bad one into a good one by calling at the
right moment.

The licence gate sits outside the arithmetic: an explicitly non-active
licence means Priority 0, sorted last. No licence record at all is not a
verdict, so those prospects stay ranked.

Field names: the stored/wire names `qualification_score` and
`timing_score` predate this formula and are kept (no migration); the UI
prints them as Value and Timing.
"""
from dataclasses import dataclass

from app.scoring.detector import DetectedSignal

# Value components — the points add up to 100
VALUE_WEIGHTS: dict[str, float] = {
    "SPECIALTY": 45,
    "OWNERSHIP": 25,
    "CAREER_STAGE": 30,
}

# Timing events — the strongest one wins; weights are the maximum each kind
# can score with a fresh event and full identity confidence
TIMING_WEIGHTS: dict[str, float] = {
    "CAREER_ADVANCEMENT": 100,
    "PROPERTY_EVENT": 80,
    "NEW_LICENSE": 60,
}

# A prospect with nothing recent keeps this share of their value
TIMING_FLOOR = 0.6

# Wire name of the value category — kept from the old formula so the API,
# the DB columns and the detail page's component list stay stable
VALUE_CATEGORY = "qualification"

VALUE_LABELS: dict[str, str] = {
    "SPECIALTY": "Specialty wealth tier",
    "OWNERSHIP": "Practice ownership",
    "CAREER_STAGE": "Career stage",
}
TIMING_LABELS: dict[str, str] = {
    "CAREER_ADVANCEMENT": "Career advancement",
    "PROPERTY_EVENT": "Property purchase recency",
    "NEW_LICENSE": "License recency",
}

# Bands by standing in the book: top 5% Top Prospect, next 15% Promising,
# next 30% Neutral, next 30% Weak, bottom 20% Poor. Relative on purpose —
# fixed score cuts labelled nobody Top and 829 of 1,179 Weak.
TIER_SHARES: tuple[tuple[str, float], ...] = (
    ("strong", 0.05),
    ("promising", 0.20),
    ("neutral", 0.50),
    ("weak", 0.80),
    ("poor", 1.0),
)


def is_rankable(license_status: str | None) -> bool:
    """The licence gate. No IDFPR record at all is not a verdict — the
    prospect stays ranked. Any explicit status other than an active one
    (NOT RENEWED, INACTIVE, SUSPENDED, PROBATION…) is not ranked.
    'ACTIVE CHAPERONE REQUIRED' counts as active."""
    if license_status is None or not license_status.strip():
        return True
    return license_status.strip().upper().startswith("ACTIVE")


def tier_for_standing(rank: int, book_size: int, rankable: bool = True) -> str:
    """Band from position in the ranked book (1 = best). Each band holds its
    share of the book rounded down, and the top band always holds at least
    #1 — on a three-prospect book 5% is nobody, and #1 is still the best."""
    if not rankable or book_size <= 0 or rank < 1:
        return "poor"
    cutoff = 0
    for tier, upper in TIER_SHARES:
        cutoff = max(cutoff + (1 if tier == "strong" else 0), int(upper * book_size))
        if rank <= cutoff:
            return tier
    return "poor"


@dataclass(frozen=True)
class ScoreBreakdown:
    qualification_score: float   # Value, 0–100
    timing_score: float          # Timing, 0–100
    total_score: float           # Priority; 0.0 when not rankable
    rankable: bool = True


class ScoringEngine:
    def __init__(self, timing_floor: float = TIMING_FLOOR):
        self.timing_floor = timing_floor

    def score(
        self,
        signals: list[DetectedSignal],
        identity_confidence: float = 1.0,
        rankable: bool = True,
    ) -> ScoreBreakdown:
        value = round(self._value(signals), 1)
        timing = round(self._timing(signals, identity_confidence), 1)
        total = (
            round(value * (self.timing_floor + (1 - self.timing_floor) * timing / 100), 1)
            if rankable
            else 0.0
        )
        return ScoreBreakdown(
            qualification_score=value,
            timing_score=timing,
            total_score=total,
            rankable=rankable,
        )

    def components(
        self, signals: list[DetectedSignal], identity_confidence: float = 1.0
    ) -> list[dict]:
        """Per-component contributions for explainability. Works on any
        objects with signal_type/strength (detected or stored Signal rows).
        Zero-strength components are included on purpose — they show what
        a prospect is missing. Timing rows carry the identity-confidence
        multiplier in their points; the strongest of them is the timing
        score, the others are context."""
        out: list[dict] = []
        for signal_type, weight in VALUE_WEIGHTS.items():
            strength = self._max_strength(signals, signal_type)
            out.append({
                "category": VALUE_CATEGORY,
                "label": VALUE_LABELS[signal_type],
                "signal_type": signal_type,
                "max_points": weight,
                "strength": round(strength, 2),
                "points": round(weight * strength, 1),
            })
        for signal_type, weight in TIMING_WEIGHTS.items():
            strength = self._max_strength(signals, signal_type)
            out.append({
                "category": "timing",
                "label": TIMING_LABELS[signal_type],
                "signal_type": signal_type,
                "max_points": weight,
                "strength": round(strength, 2),
                "points": round(weight * strength * identity_confidence, 1),
            })
        return out

    @staticmethod
    def _max_strength(signals: list[DetectedSignal], signal_type: str) -> float:
        matching = [s.strength for s in signals if s.signal_type == signal_type]
        return max(matching, default=0.0)

    def _value(self, signals: list[DetectedSignal]) -> float:
        score = sum(
            weight * self._max_strength(signals, signal_type)
            for signal_type, weight in VALUE_WEIGHTS.items()
        )
        return min(100.0, score)

    def _timing(self, signals: list[DetectedSignal], identity_confidence: float) -> float:
        best = max(
            (
                weight * self._max_strength(signals, signal_type)
                for signal_type, weight in TIMING_WEIGHTS.items()
            ),
            default=0.0,
        )
        return min(100.0, best * identity_confidence)
