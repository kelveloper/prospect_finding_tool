"""Contact kit — the trigger-matched first-touch package.

Key invariants from docs/RESEARCH_CONTACT_OUTREACH.md: the kit leads with
the best professional trigger (OWNERSHIP > CAREER > NEW_LICENSE), and a
property purchase is NEVER a trigger — it only raises urgency."""
from datetime import date

from app.models import Prospect, Signal
from app.outreach import ContactKitService


def _prospect(signals, **overrides):
    fields = dict(
        id="p-1",
        first_name="John",
        last_name="Smith",
        full_name="John Smith",
        specialty="Orthopaedic Surgery",
        state="IL",
        address_line="233 E Erie St",
        city="Chicago",
        address_state="IL",
        zip_code="60611",
        phone="312-555-0000",
    )
    fields.update(overrides)
    prospect = Prospect(**fields)
    prospect.signals = signals
    return prospect


def _signal(signal_type, description, event_date=None):
    return Signal(
        signal_type=signal_type,
        source="test",
        description=description,
        strength=0.8,
        confidence=0.9,
        event_date=event_date,
    )


OWNERSHIP = _signal(
    "OWNERSHIP",
    "Bills Medicare under own entity 'Smith Orthopedics PLLC' (name-matched billing group)",
    date(2026, 6, 1),
)
CAREER = _signal(
    "CAREER_ADVANCEMENT",
    "Started billing under new group 'Northwestern Medical Group', 2 month(s) ago",
    date(2026, 7, 1),
)
LICENSE = _signal("NEW_LICENSE", "License issued 3 month(s) ago", date(2026, 5, 20))
PROPERTY = _signal(
    "PROPERTY_EVENT",
    "Purchased property at Cook County PIN 123 for $1,200,000, 2 month(s) ago",
    date(2026, 6, 15),
)


def test_ownership_wins_trigger_priority():
    kit = ContactKitService().build(_prospect([LICENSE, CAREER, OWNERSHIP]))

    assert kit.primary_trigger.signal_type == "OWNERSHIP"
    assert "Smith Orthopedics PLLC" in kit.primary_trigger.description


def test_career_beats_new_license():
    kit = ContactKitService().build(_prospect([LICENSE, CAREER]))

    assert kit.primary_trigger.signal_type == "CAREER_ADVANCEMENT"


def test_new_license_is_last_resort_trigger():
    kit = ContactKitService().build(_prospect([LICENSE]))

    assert kit.primary_trigger.signal_type == "NEW_LICENSE"


def test_property_is_never_a_trigger_and_only_raises_urgency():
    # Property-only prospect: no trigger, elevated urgency, silence rule
    kit = ContactKitService().build(_prospect([PROPERTY]))

    assert kit.primary_trigger is None
    assert kit.urgency == "elevated"
    assert any("Never reference the property" in r for r in kit.rules)

    # Even with a real trigger present, property only raises urgency
    kit = ContactKitService().build(_prospect([OWNERSHIP, PROPERTY]))
    assert kit.urgency == "elevated"
    assert kit.primary_trigger.signal_type == "OWNERSHIP"


def test_missing_address_flags_incomplete_mail_channel():
    kit = ContactKitService().build(
        _prospect([OWNERSHIP], address_line=None, phone=None)
    )

    assert kit.mail.complete is False
    assert kit.phone.number is None
    # No phone → no phone-handling rule
    assert not any("gatekeeper" in r for r in kit.rules)


def test_practice_only_rules_always_present():
    kit = ContactKitService().build(_prospect([OWNERSHIP]))

    assert any("never a home address" in r for r in kit.rules)
    assert any("gatekeeper" in r for r in kit.rules)
    assert kit.mail.complete is True
    assert kit.phone.number == "312-555-0000"
