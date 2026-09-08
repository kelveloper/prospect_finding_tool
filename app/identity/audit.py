"""Identity audit: how good is the evidence holding a profile together?

The resolver's verdict is binary — merged or not, at threshold 0.80 — but
its certainty is not. A profile's `identity_confidence` is the weakest
merge in its cluster (see resolver.py: "confidence = weakest link"): a
licence-number merge is 1.0, exact name + state is 0.95, a first-initial +
specialty merge squeaks by at 0.85, and a single-source profile that never
merged with anything sits at 0.6. This module turns that stored number and
the stored `identity_matches` rows into a tier and a few flags an operator
can filter the board by. Pure: no session, no models — it reads any object
with `score`, `reason`, `source_a`, `source_b`.
"""
from dataclasses import dataclass
from typing import Protocol

# Display order is trust order
TIERS: tuple[str, ...] = ("certain", "strong", "barely", "single_source")

# Merge threshold and the score bands above it (resolver.py)
MERGE_THRESHOLD = 0.80
STRONG_THRESHOLD = 0.95

# Reason strings as resolver.py / enrichment.py write them
LICENSE_REASON = "license number match"
NAME_ONLY_REASON = "exact first and last name, same state"
# A merge on a unique identifier — the only kind that earns "certain"
UNIQUE_ID_MARKERS = ("license number", "NPI")


class MatchLike(Protocol):
    score: float
    reason: str
    source_a: str
    source_b: str


@dataclass(frozen=True)
class WeakestLink:
    score: float
    reason: str
    source_a: str
    source_b: str


@dataclass(frozen=True)
class IdentityAudit:
    tier: str
    confidence: float
    # Any merge on a licence number — the strongest key we have
    license_matched: bool
    # Any event pinned by name alone (deeds at 0.9) — the weakest attach key
    has_name_only_events: bool
    # The minimum-score match, so the UI can say *why* a profile is barely
    weakest_link: WeakestLink | None


def tier_for(confidence: float, matches: list[MatchLike]) -> str:
    """The band the profile's weakest merge falls in. A profile with no
    matches never faced the judge, whatever its stored confidence."""
    if not matches or confidence < MERGE_THRESHOLD:
        return "single_source"
    if confidence < STRONG_THRESHOLD:
        return "barely"
    if confidence >= 1.0 and any(
        marker.casefold() in m.reason.casefold() for m in matches for marker in UNIQUE_ID_MARKERS
    ):
        return "certain"
    return "strong"


def audit_identity(confidence: float, matches: list[MatchLike]) -> IdentityAudit:
    weakest = min(matches, key=lambda m: m.score, default=None)
    return IdentityAudit(
        tier=tier_for(confidence, matches),
        confidence=confidence,
        license_matched=any(LICENSE_REASON in m.reason for m in matches),
        has_name_only_events=any(m.reason == NAME_ONLY_REASON for m in matches),
        weakest_link=(
            WeakestLink(
                score=weakest.score,
                reason=weakest.reason,
                source_a=weakest.source_a,
                source_b=weakest.source_b,
            )
            if weakest is not None
            else None
        ),
    )
