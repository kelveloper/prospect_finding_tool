from datetime import date

from app.identity.resolver import ResolvedProspect
from app.adapters.base import RawProviderRecord
from app.scoring import ScoringEngine, SignalDetector
from app.scoring.detector import recency_strength

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


def test_recency_decay_is_monotonic():
    fresh = recency_strength(date(2026, 6, 1), REF)      # ~2.5 months
    year_old = recency_strength(date(2025, 7, 1), REF)   # ~13 months
    stale = recency_strength(date(2020, 1, 1), REF)      # ~6.5 years
    assert fresh == 1.0
    assert fresh > year_old > stale
    assert recency_strength(None, REF) == 0.0


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


def test_recent_license_drives_timing_score():
    engine = ScoringEngine()
    detector = SignalDetector()

    recent = detector.detect(
        profile(license_status="ACTIVE", license_issue_date=date(2026, 5, 1)), REF
    )
    old = detector.detect(
        profile(license_status="ACTIVE", license_issue_date=date(2018, 5, 1)), REF
    )
    assert engine.score(recent).timing_score > engine.score(old).timing_score
    assert engine.score(recent).timing_score >= 40


def test_scores_bounded_0_100():
    detector = SignalDetector()
    signals = detector.detect(
        profile(
            specialty="Orthopaedic Surgery",
            license_status="ACTIVE",
            license_issue_date=date(2026, 8, 1),
            enumeration_date=date(2026, 8, 1),
        ),
        REF,
    )
    breakdown = ScoringEngine().score(signals)
    assert 0 <= breakdown.qualification_score <= 100
    assert 0 <= breakdown.timing_score <= 100
    assert 0 <= breakdown.total_score <= 100


def test_weights_are_configurable():
    detector = SignalDetector()
    signals = detector.detect(
        profile(
            specialty="Family Medicine",
            license_status="ACTIVE",
            license_issue_date=date(2026, 7, 1),
        ),
        REF,
    )
    qual_only = ScoringEngine(qualification_weight=1.0, timing_weight=0.0).score(signals)
    timing_only = ScoringEngine(qualification_weight=0.0, timing_weight=1.0).score(signals)
    assert qual_only.total_score == qual_only.qualification_score
    assert timing_only.total_score == timing_only.timing_score


def test_default_formula_60_40():
    detector = SignalDetector()
    signals = detector.detect(
        profile(specialty="Dermatology", license_status="ACTIVE",
                license_issue_date=date(2026, 6, 1)),
        REF,
    )
    b = ScoringEngine().score(signals)
    expected = round(b.qualification_score * 0.6 + b.timing_score * 0.4, 1)
    assert b.total_score == expected
