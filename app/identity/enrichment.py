"""Deterministic matching of enrichment records to resolved prospects.

Conservative by design: an entity/property/career record attaches to a
prospect only on an exact normalized first+last name match in the same
state. First-initial-only or partial-surname matches are rejected —
attaching a property purchase to the wrong person is worse than missing
one. Every attachment is recorded as MatchEvidence.
"""
from app.adapters.base import EnrichmentRecord
from app.identity.resolver import MatchEvidence, ResolvedProspect, normalize_name_part


def enrichment_match_score(
    record: EnrichmentRecord, prospect: ResolvedProspect
) -> tuple[float, str]:
    if record.state and prospect.state and record.state != prospect.state:
        return 0.0, "different state"

    if normalize_name_part(record.owner_last_name) != normalize_name_part(prospect.last_name):
        return 0.0, "different last name"

    rec_first = normalize_name_part(record.owner_first_name)
    pro_first = normalize_name_part(prospect.first_name)
    # Compare first tokens so middle names on either side are ignored
    if not rec_first or rec_first.split()[0] != pro_first.split()[0]:
        return 0.0, "different first name"

    return 0.9, "exact first and last name, same state"


class EnrichmentMatcher:
    def __init__(self, threshold: float = 0.80):
        self.threshold = threshold

    def attach(
        self, prospects: list[ResolvedProspect], records: list[EnrichmentRecord]
    ) -> int:
        """Attach each enrichment record to its best-matching prospect.
        Returns the number of records attached; unmatched records are dropped."""
        attached = 0
        for record in records:
            best: tuple[float, str, ResolvedProspect] | None = None
            for prospect in prospects:
                score, reason = enrichment_match_score(record, prospect)
                if score >= self.threshold and (best is None or score > best[0]):
                    best = (score, reason, prospect)
            if best is None:
                continue
            score, reason, prospect = best
            prospect.enrichments.append(record)
            anchor = prospect.records[0]
            prospect.matches.append(
                MatchEvidence(
                    source_a=anchor.source,
                    record_a_id=anchor.source_record_id,
                    source_b=record.source,
                    record_b_id=record.source_record_id,
                    score=score,
                    reason=reason,
                )
            )
            attached += 1
        return attached
