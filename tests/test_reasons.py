from datetime import date

from app.adapters.base import RawProviderRecord
from app.identity.resolver import ResolvedProspect
from app.scoring import ScoringEngine, SignalDetector, build_reason_summary

REF = date(2026, 8, 18)


def _signals_and_breakdown():
    p = ResolvedProspect(
        first_name="John",
        last_name="Smith",
        state="IL",
        specialty="Orthopaedic Surgery",
        license_status="ACTIVE",
        license_issue_date=date(2025, 12, 15),
        enumeration_date=date(2026, 1, 15),
    )
    p.records = [
        RawProviderRecord(source="npi", source_record_id="1",
                          first_name="John", last_name="Smith", state="IL"),
        RawProviderRecord(source="idfpr", source_record_id="036-1",
                          first_name="John", last_name="Smith", state="IL"),
    ]
    signals = SignalDetector().detect(p, REF)
    return signals, ScoringEngine().score(signals)


def test_summary_is_plain_english_and_mentions_key_signals():
    signals, breakdown = _signals_and_breakdown()
    summary, confidence = build_reason_summary(signals, breakdown)

    assert "Licensed physician" in summary
    assert "license issued 8 month(s) ago" in summary
    assert "High qualification score." in summary
    assert "Strong timing signal." in summary
    assert 0 < confidence <= 1


def test_summary_is_deterministic():
    signals, breakdown = _signals_and_breakdown()
    first = build_reason_summary(signals, breakdown)
    second = build_reason_summary(signals, breakdown)
    assert first == second


def test_empty_signals_handled():
    summary, confidence = build_reason_summary([], ScoringEngine().score([]))
    assert summary == "Insufficient signals detected."
    assert confidence == 0.0
