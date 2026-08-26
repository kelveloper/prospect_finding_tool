"""Contact kit — the trigger-matched first-touch package.

Key invariants from docs/RESEARCH_CONTACT_OUTREACH.md: letters are written
around the best professional trigger (OWNERSHIP > CAREER > NEW_LICENSE),
and a property purchase is NEVER mentioned — it only raises urgency."""
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


def test_ownership_wins_priority_and_letter_names_the_entity():
    kit = ContactKitService().build(_prospect([LICENSE, CAREER, OWNERSHIP]))

    assert kit.primary_trigger.signal_type == "OWNERSHIP"
    assert kit.letter.salutation == "Dear Dr. Smith,"
    assert "Smith Orthopedics PLLC" in kit.letter.body
    assert "Congratulations" in kit.letter.body


def test_career_letter_names_the_new_group():
    kit = ContactKitService().build(_prospect([LICENSE, CAREER]))

    assert kit.primary_trigger.signal_type == "CAREER_ADVANCEMENT"
    assert "Northwestern Medical Group" in kit.letter.body
    assert "401(k)" in kit.letter.body


def test_new_license_letter_covers_first_attending_topics():
    kit = ContactKitService().build(_prospect([LICENSE]))

    assert kit.primary_trigger.signal_type == "NEW_LICENSE"
    assert "disability" in kit.letter.body


def test_property_is_never_mentioned_and_only_raises_urgency():
    # Property-only prospect: generic letter, elevated urgency, silence rule
    kit = ContactKitService().build(_prospect([PROPERTY]))

    assert kit.primary_trigger is None
    assert kit.urgency == "elevated"
    body = kit.letter.body.lower()
    assert "property" not in body
    assert "purchase" not in body
    assert any("Never reference the property" in r for r in kit.rules)

    # Even with a real trigger present, the letter stays property-silent
    kit = ContactKitService().build(_prospect([OWNERSHIP, PROPERTY]))
    assert kit.urgency == "elevated"
    assert "property" not in kit.letter.body.lower()
    assert "$1,200,000" not in kit.letter.body


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
