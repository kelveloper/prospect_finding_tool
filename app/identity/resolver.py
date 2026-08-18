"""Deterministic identity resolution.

Clusters raw records from all sources into single prospect profiles.
Rules only — no ML (spec section 6). Every merge is recorded as a
MatchEvidence with a score and a human-readable reason.
"""
import re
from dataclasses import dataclass, field
from datetime import date

from app.adapters.base import RawProviderRecord

# Credentials/suffixes stripped before comparing names
_SUFFIXES = {"md", "do", "jr", "sr", "ii", "iii", "iv", "phd", "dds", "dpm"}


def normalize_name_part(part: str) -> str:
    cleaned = re.sub(r"[^a-z\s]", "", part.lower())
    tokens = [t for t in cleaned.split() if t not in _SUFFIXES]
    return " ".join(tokens)


@dataclass(frozen=True)
class MatchEvidence:
    source_a: str
    record_a_id: str
    source_b: str
    record_b_id: str
    score: float
    reason: str


@dataclass
class ResolvedProspect:
    """One deduplicated person, merged from 1+ raw records."""
    first_name: str
    last_name: str
    middle_name: str | None = None
    specialty: str | None = None
    state: str | None = None
    npi: str | None = None
    enumeration_date: date | None = None
    license_number: str | None = None
    license_issue_date: date | None = None
    license_status: str | None = None
    identity_confidence: float = 0.6  # single-source default: no corroboration
    records: list[RawProviderRecord] = field(default_factory=list)
    matches: list[MatchEvidence] = field(default_factory=list)

    @property
    def full_name(self) -> str:
        middle = f" {self.middle_name}" if self.middle_name else ""
        return f"{self.first_name}{middle} {self.last_name}"


def match_score(a: RawProviderRecord, b: RawProviderRecord) -> tuple[float, str]:
    """Score how likely two raw records refer to the same person (0-1)."""
    if a.state and b.state and a.state != b.state:
        return 0.0, "different state"

    last_a = normalize_name_part(a.last_name)
    last_b = normalize_name_part(b.last_name)
    if not last_a or last_a != last_b:
        return 0.0, "different last name"

    first_a = normalize_name_part(a.first_name)
    first_b = normalize_name_part(b.first_name)
    if not first_a or not first_b:
        return 0.0, "missing first name"

    specialty_match = bool(
        a.specialty and b.specialty and a.specialty.lower() == b.specialty.lower()
    )

    reasons = ["same last name", "same state"]

    # Full first-name match (middle names/initials on either side are ignored,
    # so "John Smith" == "John A Smith")
    if first_a == first_b:
        score = 0.95
        reasons.insert(0, "exact first name")
    elif len(first_a) == 1 or len(first_b) == 1:
        # First-initial record, e.g. "D Chen" vs "David Chen"
        if first_a[0] == first_b[0]:
            score = 0.70
            reasons.insert(0, "first initial match")
        else:
            return 0.0, "different first initial"
    else:
        return 0.0, "different first name"

    if specialty_match:
        score += 0.15
        reasons.append("same specialty")

    return min(score, 1.0), ", ".join(reasons)


class IdentityResolver:
    def __init__(self, threshold: float = 0.80):
        self.threshold = threshold

    def resolve(self, records: list[RawProviderRecord]) -> list[ResolvedProspect]:
        """Greedy clustering: each record joins the best-matching existing
        cluster above the threshold, else starts a new one."""
        clusters: list[ResolvedProspect] = []

        # NPI records first so clusters anchor on the richer identity source
        ordered = sorted(records, key=lambda r: 0 if r.source == "npi" else 1)

        for record in ordered:
            best: tuple[float, str, ResolvedProspect] | None = None
            for cluster in clusters:
                anchor = cluster.records[0]
                score, reason = match_score(anchor, record)
                if score >= self.threshold and (best is None or score > best[0]):
                    best = (score, reason, cluster)

            if best is None:
                clusters.append(self._new_cluster(record))
            else:
                score, reason, cluster = best
                self._merge_into(cluster, record, score, reason)

        return clusters

    def _new_cluster(self, record: RawProviderRecord) -> ResolvedProspect:
        return ResolvedProspect(
            first_name=record.first_name,
            last_name=record.last_name,
            middle_name=record.middle_name,
            specialty=record.specialty,
            state=record.state,
            npi=record.npi,
            enumeration_date=record.enumeration_date,
            license_number=record.license_number,
            license_issue_date=record.license_issue_date,
            license_status=record.license_status,
            records=[record],
        )

    def _merge_into(
        self,
        cluster: ResolvedProspect,
        record: RawProviderRecord,
        score: float,
        reason: str,
    ) -> None:
        anchor = cluster.records[0]
        cluster.records.append(record)
        cluster.matches.append(
            MatchEvidence(
                source_a=anchor.source,
                record_a_id=anchor.source_record_id,
                source_b=record.source,
                record_b_id=record.source_record_id,
                score=score,
                reason=reason,
            )
        )
        # Corroborated identity: confidence = weakest link in the cluster
        cluster.identity_confidence = min(m.score for m in cluster.matches)

        # Fill fields the anchor lacked; licensing fields prefer IDFPR,
        # identity fields prefer NPI (already anchored first)
        cluster.middle_name = cluster.middle_name or record.middle_name
        cluster.specialty = cluster.specialty or record.specialty
        cluster.state = cluster.state or record.state
        cluster.npi = cluster.npi or record.npi
        cluster.enumeration_date = cluster.enumeration_date or record.enumeration_date
        cluster.license_number = cluster.license_number or record.license_number
        cluster.license_issue_date = cluster.license_issue_date or record.license_issue_date
        cluster.license_status = cluster.license_status or record.license_status
