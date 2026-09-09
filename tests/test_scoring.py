from datetime import date

import pytest

from app.identity.resolver import ResolvedProspect
from app.adapters.base import EnrichmentRecord, RawProviderRecord
from app.scoring import ScoringEngine, SignalDetector, is_rankable, tier_for_standing
from app.scoring.detector import (
    career_stage,
    entity_strength,
    recency_strength,
    tenure_factor,
)

REF = date(2026, 8, 18)


def profile(**kwargs) -> ResolvedProspect:
    defaults = dict(first_name="Test", last_name="Doc", state="IL")
    defaults.update(kwargs)
    p = ResolvedProspect(**defaults)
    p.records = [
        RawProviderRecord(
            source="npi", source_record_id="1",
            first_name=p.first_name, last_name=p.last_name, state=p.state,
        )
    ]
    return p


def _entity(entity_type="PLLC", status="ACTIVE") -> EnrichmentRecord:
    return EnrichmentRecord(
        source="pecos", source_record_id="e", kind="ENTITY",
        owner_first_name="Test", owner_last_name="Doc", npi="1",
        entity_name="Doc Medical " + entity_type, entity_type=entity_type,
        entity_status=status,
    )


def _property(event_date: date) -> EnrichmentRecord:
    return EnrichmentRecord(
        source="cook_county", source_record_id="d", kind="PROPERTY",
        owner_first_name="Test", owner_last_name="Doc", state="IL",
        event_date=event_date, property_address="1 Main St", sale_price=900_000,
    )


# ── The curves ──────────────────────────────────────────────
def test_recency_is_a_half_life():
    fresh = recency_strength(date(2026, 6, 1), REF)      # ~2.5 months
    year_old = recency_strength(REF.replace(year=2025), REF)
    stale = recency_strength(date(2020, 1, 1), REF)      # ~6.5 years
    assert fresh == pytest.approx(0.5 ** (2.5 / 12), abs=0.02)
    assert year_old == pytest.approx(0.5, abs=0.01)
    assert fresh > year_old > stale > 0
    assert recency_strength(None, REF) == 0.0
    assert recency_strength(date(2027, 1, 1), REF) == 0.0  # the future is not fresh


def test_career_stage_is_a_hump():
    assert career_stage(0.5) == (5, "first attending years")
    assert career_stage(4) == (15, "early attending")
    assert career_stage(10) == (30, "peak accumulation years")
    assert career_stage(17) == (20, "established")
    assert career_stage(25) == (10, "late career")
    assert career_stage(None)[0] == 15


def test_ownership_tenure_factor_discounts_the_established():
    assert tenure_factor(5) == 1.0
    assert tenure_factor(15) == 0.6
    assert tenure_factor(25) == 0.3
    assert tenure_factor(None) == 0.6
    assert entity_strength("PLLC", "ACTIVE") == 1.0
    assert entity_strength("LLC", "ACTIVE") == 0.6
    assert entity_strength("PLLC", "INACTIVE") == pytest.approx(0.6)


# ── Value ───────────────────────────────────────────────────
def test_high_tier_specialty_outscores_primary_care():
    engine = ScoringEngine()
    detector = SignalDetector()

    surgeon = detector.detect(
        profile(specialty="Orthopaedic Surgery", license_status="ACTIVE"), REF
    )
    family = detector.detect(
        profile(specialty="Family Medicine", license_status="ACTIVE"), REF
    )
    assert engine.score(surgeon).qualification_score > engine.score(family).qualification_score


def test_value_adds_specialty_ownership_and_career_stage():
    detector = SignalDetector()
    p = profile(
        specialty="Orthopaedic Surgery",
        license_status="ACTIVE",
        enumeration_date=date(2018, 6, 1),   # ~8 years in → peak band, tenure 1.0
    )
    p.enrichments = [_entity("PLLC", "ACTIVE")]
    b = ScoringEngine().score(detector.detect(p, REF))
    # 45 × 1.0 + 25 × 1.0 × 1.0 + 30 = 100: the ceiling is reachable
    assert b.qualification_score == 100.0

    late = profile(specialty="Orthopaedic Surgery", enumeration_date=date(2001, 6, 1))
    late.enrichments = [_entity("PLLC", "ACTIVE")]
    b_late = ScoringEngine().score(detector.detect(late, REF))
    # 45 + 25 × 0.3 + 10 = 62.5: same doctor twenty-five years in
    assert b_late.qualification_score == 62.5


# ── Timing ──────────────────────────────────────────────────
def test_recent_license_drives_timing_score():
    engine = ScoringEngine()
    detector = SignalDetector()
    # Enumerated in 2015: a 2026 licence is a relocation (60), not a first licence
    recent = detector.detect(
        profile(license_status="ACTIVE", enumeration_date=date(2015, 1, 1),
                license_issue_date=date(2026, 5, 1)), REF
    )
    old = detector.detect(
        profile(license_status="ACTIVE", enumeration_date=date(2015, 1, 1),
                license_issue_date=date(2018, 5, 1)), REF
    )
    assert engine.score(recent).timing_score > engine.score(old).timing_score
    assert engine.score(recent).timing_score >= 40


def test_first_license_is_worth_half_a_relocation():
    engine = ScoringEngine()
    detector = SignalDetector()
    grad = detector.detect(
        profile(enumeration_date=date(2026, 1, 1), license_issue_date=date(2026, 5, 1)), REF
    )
    mover = detector.detect(
        profile(enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 5, 1)), REF
    )
    assert engine.score(grad).timing_score == pytest.approx(
        engine.score(mover).timing_score / 2, abs=0.1
    )


def test_timing_is_the_strongest_event_not_a_sum():
    detector = SignalDetector()
    p = profile(enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 6, 1))
    p.enrichments = [_property(date(2026, 7, 1))]
    signals = detector.detect(p, REF)
    engine = ScoringEngine()
    parts = {c["signal_type"]: c["points"] for c in engine.components(signals) if c["category"] == "timing"}
    assert parts["PROPERTY_EVENT"] > 0 and parts["NEW_LICENSE"] > 0
    assert engine.score(signals).timing_score == max(parts.values())


def test_identity_confidence_scales_timing_not_value():
    detector = SignalDetector()
    p = profile(specialty="Orthopaedic Surgery", enumeration_date=date(2015, 1, 1))
    p.enrichments = [_property(REF)]
    signals = detector.detect(p, REF)
    sure = ScoringEngine().score(signals, identity_confidence=1.0)
    unsure = ScoringEngine().score(signals, identity_confidence=0.6)
    assert unsure.qualification_score == sure.qualification_score
    assert unsure.timing_score == pytest.approx(sure.timing_score * 0.6, abs=0.1)
    assert unsure.total_score < sure.total_score


# ── The blend ───────────────────────────────────────────────
def test_priority_is_value_times_timing_multiplier():
    detector = SignalDetector()
    signals = detector.detect(
        profile(specialty="Dermatology", license_status="ACTIVE",
                enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 6, 1)),
        REF,
    )
    b = ScoringEngine().score(signals)
    expected = round(b.qualification_score * (0.6 + 0.4 * b.timing_score / 100), 1)
    assert b.total_score == expected


def test_timing_floor_is_configurable():
    detector = SignalDetector()
    signals = detector.detect(
        profile(specialty="Family Medicine", license_status="ACTIVE",
                enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 7, 1)),
        REF,
    )
    value_only = ScoringEngine(timing_floor=1.0).score(signals)
    no_floor = ScoringEngine(timing_floor=0.0).score(signals)
    assert value_only.total_score == value_only.qualification_score
    assert no_floor.total_score == round(
        no_floor.qualification_score * no_floor.timing_score / 100, 1
    )


def test_a_fresh_event_never_lifts_a_poor_fit_above_a_quiet_strong_one():
    detector = SignalDetector()
    busy = profile(specialty="Pediatrics", enumeration_date=date(2016, 1, 1))
    busy.enrichments = [_property(REF)]
    quiet = profile(specialty="Orthopaedic Surgery", enumeration_date=date(2016, 1, 1))
    engine = ScoringEngine()
    assert engine.score(detector.detect(quiet, REF)).total_score > engine.score(
        detector.detect(busy, REF)
    ).total_score


def test_scores_bounded_0_100():
    detector = SignalDetector()
    p = profile(
        specialty="Orthopaedic Surgery",
        license_status="ACTIVE",
        license_issue_date=date(2026, 8, 1),
        enumeration_date=date(2016, 8, 1),
    )
    p.enrichments = [_entity("PLLC", "ACTIVE"), _property(REF)]
    for confidence in (1.0, 0.6):
        breakdown = ScoringEngine().score(detector.detect(p, REF), identity_confidence=confidence)
        assert 0 <= breakdown.qualification_score <= 100
        assert 0 <= breakdown.timing_score <= 100
        assert 0 <= breakdown.total_score <= 100


def test_components_trace_every_point():
    detector = SignalDetector()
    signals = detector.detect(
        profile(specialty="Orthopaedic Surgery", license_status="ACTIVE",
                enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 6, 1)),
        REF,
    )
    engine = ScoringEngine()
    components = engine.components(signals)
    breakdown = engine.score(signals)

    # 3 value + 3 timing rows, zeros included (missing signals stay visible)
    assert len(components) == 6
    assert {c["category"] for c in components} == {"qualification", "timing"}
    ownership = next(c for c in components if c["signal_type"] == "OWNERSHIP")
    assert ownership["points"] == 0.0

    value_points = [c["points"] for c in components if c["category"] == "qualification"]
    timing_points = [c["points"] for c in components if c["category"] == "timing"]
    assert round(min(sum(value_points), 100), 1) == breakdown.qualification_score
    assert max(timing_points) == breakdown.timing_score


# ── The gate and the bands ──────────────────────────────────
def test_is_rankable():
    assert is_rankable(None) and is_rankable("") and is_rankable("ACTIVE")
    assert is_rankable("active") and is_rankable("ACTIVE CHAPERONE REQUIRED")
    for status in ("NOT RENEWED", "INACTIVE", "SUSPENDED", "PROBATION"):
        assert not is_rankable(status)


def test_gated_prospect_keeps_value_and_timing_but_scores_zero():
    detector = SignalDetector()
    signals = detector.detect(
        profile(specialty="Orthopaedic Surgery", license_status="NOT RENEWED",
                enumeration_date=date(2015, 1, 1), license_issue_date=date(2026, 6, 1)),
        REF,
    )
    b = ScoringEngine().score(signals, rankable=is_rankable("NOT RENEWED"))
    assert b.qualification_score > 0 and b.timing_score > 0
    assert b.total_score == 0.0 and b.rankable is False


def test_tier_for_standing_shares():
    n = 1000
    assert tier_for_standing(1, n) == "strong"
    assert tier_for_standing(50, n) == "strong"
    assert tier_for_standing(51, n) == "promising"
    assert tier_for_standing(200, n) == "promising"
    assert tier_for_standing(201, n) == "neutral"
    assert tier_for_standing(500, n) == "neutral"
    assert tier_for_standing(800, n) == "weak"
    assert tier_for_standing(801, n) == "poor"
    assert tier_for_standing(1, n, rankable=False) == "poor"
    assert tier_for_standing(1, 0) == "poor"


# ── Stored-row helpers the board relies on ──────────────────
def test_signal_strengths_expose_recency_not_just_presence():
    """NEW_LICENSE is emitted for anyone holding a license date at all, so the
    board cannot tell a two-month registration from a seventeen-year one by
    presence. The strength map is what the UI gates its recency claims on."""
    from app.models import Prospect, Signal

    prospect = Prospect(first_name="Ada", last_name="Vance", full_name="Ada Vance")
    prospect.signals = [
        Signal(signal_type="NEW_LICENSE", source="idfpr", description="17 years ago",
               strength=0.1, confidence=1.0, event_date=date(2009, 1, 1)),
        Signal(signal_type="PHYSICIAN", source="npi", description="active",
               strength=1.0, confidence=1.0),
    ]

    strengths = prospect.signal_strengths
    assert "NEW_LICENSE" in prospect.signal_types      # present...
    assert strengths["NEW_LICENSE"] == 0.1             # ...but stale
    assert strengths["PHYSICIAN"] == 1.0
    assert prospect.signal_dates["NEW_LICENSE"] == date(2009, 1, 1)
    assert prospect.signal_dates["PHYSICIAN"] is None


def test_signal_strengths_keep_the_strongest_duplicate():
    """Two entities named after the same physician must not weaken ownership."""
    from app.models import Prospect, Signal

    prospect = Prospect(first_name="Ada", last_name="Vance", full_name="Ada Vance")
    prospect.signals = [
        Signal(signal_type="OWNERSHIP", source="pecos", description="generic llc",
               strength=0.6, confidence=0.7),
        Signal(signal_type="OWNERSHIP", source="pecos", description="own pllc",
               strength=1.0, confidence=0.7),
    ]

    assert prospect.signal_strengths["OWNERSHIP"] == 1.0
