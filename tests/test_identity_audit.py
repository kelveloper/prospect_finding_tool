"""The identity audit classifier — every tier boundary, and the flags."""
from dataclasses import dataclass

from app.identity.audit import audit_identity, tier_for


@dataclass(frozen=True)
class M:
    score: float
    reason: str
    source_a: str = "npi"
    source_b: str = "idfpr"


LICENSE = M(1.0, "license number match")
NPI = M(1.0, "NPI match", "npi", "pecos")
EXACT_NAME = M(0.95, "exact first name, same last name, same state")
INITIAL = M(0.85, "first initial match, same last name, same state, same specialty")
DEED_BY_NAME = M(0.9, "exact first and last name, same state", "npi", "cook_county")


def test_no_matches_is_single_source_whatever_the_confidence():
    assert tier_for(0.6, []) == "single_source"
    assert tier_for(1.0, []) == "single_source"


def test_threshold_boundary_079_vs_080():
    assert tier_for(0.79, [INITIAL]) == "single_source"
    assert tier_for(0.80, [INITIAL]) == "barely"


def test_strong_boundary_094_vs_095():
    assert tier_for(0.94, [EXACT_NAME]) == "barely"
    assert tier_for(0.95, [EXACT_NAME]) == "strong"


def test_certain_needs_a_unique_identifier():
    assert tier_for(1.0, [LICENSE]) == "certain"
    assert tier_for(1.0, [NPI]) == "certain"
    # 1.0 without a licence/NPI merge is still only "strong"
    assert tier_for(1.0, [EXACT_NAME]) == "strong"


def test_weakest_link_and_flags():
    audit = audit_identity(0.85, [LICENSE, INITIAL, DEED_BY_NAME])
    assert audit.tier == "barely"
    assert audit.license_matched is True
    assert audit.has_name_only_events is True
    assert audit.weakest_link is not None
    assert audit.weakest_link.score == 0.85
    assert audit.weakest_link.reason == INITIAL.reason
    assert (audit.weakest_link.source_a, audit.weakest_link.source_b) == ("npi", "idfpr")


def test_flags_are_independent_of_tier():
    # A licence-certain profile can still carry a name-only deed attach
    audit = audit_identity(1.0, [LICENSE, DEED_BY_NAME])
    assert audit.tier == "certain"
    assert audit.has_name_only_events is True
    # The deed attach is the weakest link even though the tier is certain
    assert audit.weakest_link and audit.weakest_link.score == 0.9

    lonely = audit_identity(0.6, [])
    assert lonely.tier == "single_source"
    assert lonely.license_matched is False
    assert lonely.has_name_only_events is False
    assert lonely.weakest_link is None
