from datetime import date

from app.adapters.base import RawProviderRecord
from app.identity.resolver import IdentityResolver, match_score, normalize_name_part


def rec(**kwargs) -> RawProviderRecord:
    defaults = dict(
        source="npi",
        source_record_id="x",
        first_name="John",
        last_name="Smith",
        state="IL",
    )
    defaults.update(kwargs)
    return RawProviderRecord(**defaults)


def test_normalize_strips_credentials_and_punctuation():
    assert normalize_name_part("John A. Smith, MD") == "john a smith"
    assert normalize_name_part("SMITH JR") == "smith"


def test_middle_initial_variant_is_same_person():
    a = rec(source="npi", source_record_id="1", middle_name="A")
    b = rec(source="idfpr", source_record_id="036-1")
    score, reason = match_score(a, b)
    assert score >= 0.95
    assert "exact first name" in reason


def test_different_state_no_match():
    a = rec(state="IL")
    b = rec(state="NY")
    score, _ = match_score(a, b)
    assert score == 0.0


def test_first_initial_needs_specialty_to_merge():
    full = rec(first_name="David", last_name="Chen", specialty="Dermatology")
    initial_same_spec = rec(
        source="idfpr", first_name="D", last_name="Chen", specialty="Dermatology"
    )
    initial_no_spec = rec(source="idfpr", first_name="D", last_name="Chen")

    with_spec, _ = match_score(full, initial_same_spec)
    without_spec, _ = match_score(full, initial_no_spec)
    assert with_spec >= 0.80
    assert without_spec < 0.80


def test_resolver_merges_npi_and_license_records():
    records = [
        rec(
            source="npi",
            source_record_id="1234567801",
            middle_name="A",
            npi="1234567801",
            specialty="Orthopaedic Surgery",
            enumeration_date=date(2026, 1, 15),
        ),
        rec(
            source="idfpr",
            source_record_id="036-201001",
            specialty="Orthopaedic Surgery",
            license_number="036-201001",
            license_issue_date=date(2025, 12, 15),
            license_status="ACTIVE",
        ),
    ]
    resolved = IdentityResolver(threshold=0.80).resolve(records)

    assert len(resolved) == 1
    prospect = resolved[0]
    # Merged profile carries fields from both sources
    assert prospect.npi == "1234567801"
    assert prospect.license_number == "036-201001"
    assert prospect.license_status == "ACTIVE"
    assert prospect.identity_confidence >= 0.95
    assert len(prospect.matches) == 1
    assert prospect.matches[0].reason


def test_resolver_keeps_distinct_people_separate():
    records = [
        rec(source="npi", source_record_id="1", first_name="John", last_name="Smith"),
        rec(source="npi", source_record_id="2", first_name="Jane", last_name="Doe"),
    ]
    resolved = IdentityResolver().resolve(records)
    assert len(resolved) == 2
    assert all(p.identity_confidence == 0.6 for p in resolved)  # uncorroborated
