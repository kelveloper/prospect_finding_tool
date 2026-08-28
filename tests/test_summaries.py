"""Advisor-summary composer: four-beat narrative from stored facts only."""
from datetime import date, timedelta

from app.models import Prospect, Signal
from app.summaries import apply, compose

TODAY = date.today()


def _prospect(**overrides):
    fields = dict(
        id="p-1",
        first_name="Ada",
        last_name="Lovelace",
        full_name="Ada Lovelace",
        specialty="Plastic Surgery",
        state="IL",
        city="Rockford",
        total_score=61.6,
        identity_confidence=1.0,
        license_issue_date=TODAY - timedelta(days=20),
        enumeration_date=TODAY - timedelta(days=365 * 15),
    )
    fields.update(overrides)
    p = Prospect(**fields)
    p.signals = []
    p.outreach_events = []
    return p


def _signal(signal_type, description, event_date=None, strength=0.8):
    return Signal(
        signal_type=signal_type,
        source="test",
        description=description,
        strength=strength,
        confidence=0.9,
        event_date=event_date,
    )


def test_compose_never_bakes_in_rank_and_infers_relocation():
    text = compose(_prospect())

    assert "#" not in text  # rank lives in the UI, never the text
    assert "newly licensed" in text
    assert "relocating" in text  # old NPI + fresh license


def test_compose_surfaces_money_in_motion_and_watchouts():
    p = _prospect(identity_confidence=0.6)
    p.signals = [
        _signal(
            "PROPERTY_EVENT",
            "Purchased property for $1,200,000",
            TODAY - timedelta(days=60),
        )
    ]
    text = compose(p)

    assert "money is moving" in text
    assert "single-source" in text


def test_apply_stamps_source_and_timestamp():
    p = _prospect()
    apply(p, "Narrative here.", source="llm")

    assert p.advisor_summary == "Narrative here."
    assert p.summary_source == "llm"
    assert p.summary_generated_at is not None
