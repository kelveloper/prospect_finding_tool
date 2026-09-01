from datetime import date

from app.adapters.base import RawProviderRecord
from app.adapters.idfpr.live import IDFPRLiveDataSource, normalize_license
from app.identity.resolver import IdentityResolver, match_score


def _row(license_number="036057912", first="RENSLOW", last="SHERER",
         status="ACTIVE", issued="10/23/1978", business="N",
         description="LICENSED PHYSICIAN AND SURGEON"):
    return {
        "license_type": "MEDICAL BOARD",
        "description": description,
        "license_number": license_number,
        "license_status": status,
        "business": business,
        "first_name": first,
        "middle": "D",
        "last_name": last,
        "original_issue_date": issued,
        "city": "EVANSTON",
        "state": "IL",
        "zip": "60202",
    }


def test_normalize_license_formats():
    assert normalize_license("036.057912") == "036057912"
    assert normalize_license("036-057912") == "036057912"
    assert normalize_license("036057912") == "036057912"
    assert normalize_license(None) is None
    assert normalize_license(" . ") is None


def test_maps_idfpr_row():
    src = IDFPRLiveDataSource(["036.057912"], fetch_json=lambda p: [_row()])
    records = list(src.fetch())

    assert len(records) == 1
    r = records[0]
    assert r.first_name == "Renslow"
    assert r.last_name == "Sherer"
    assert r.license_number == "036057912"
    assert r.license_status == "ACTIVE"
    assert r.license_issue_date == date(1978, 10, 23)
    assert r.state == "IL"
    assert r.city == "Evanston"
    assert r.zip_code == "60202"


def test_filters_businesses_and_other_license_types():
    rows = [
        _row(),
        _row(license_number="036099999", business="Y"),
        _row(license_number="036088888", description="LICENSED CHIROPRACTIC PHYSICIAN"),
    ]
    src = IDFPRLiveDataSource(["036057912"], fetch_json=lambda p: rows)
    assert len(list(src.fetch())) == 1


def test_batches_license_numbers():
    calls = []

    def fake_fetch(params):
        calls.append(params["$where"])
        return []

    numbers = [f"0360{i:05d}" for i in range(400)]
    list(IDFPRLiveDataSource(numbers, fetch_json=fake_fetch).fetch())
    assert len(calls) == 3  # 400 numbers / 150 per batch
    assert calls[0].startswith("license_number in(")


def _rec(source, license_number, first="John", last="Smith", **kwargs):
    defaults = dict(
        source=source, source_record_id="x", first_name=first, last_name=last,
        state="IL", license_number=license_number,
    )
    defaults.update(kwargs)
    return RawProviderRecord(**defaults)


def test_license_number_join_beats_name_variation():
    # Same license, very different name spellings → still the same person
    a = _rec("npi", "036.057912", first="Renslow", last="Sherer")
    b = _rec("idfpr", "036057912", first="Ren", last="Scherer")
    score, reason = match_score(a, b)
    assert score == 1.0
    assert reason == "license number match"


def test_same_state_different_license_is_different_person():
    a = _rec("npi", "036111111")
    b = _rec("idfpr", "036222222")  # both John Smith, IL — but different licenses
    score, reason = match_score(a, b)
    assert score == 0.0
    assert reason == "different license number"


def test_resolver_merges_on_license_join():
    a = _rec("npi", "036.057912", npi="1234509876",
             specialty="Orthopaedic Surgery", enumeration_date=date(2026, 1, 1))
    b = _rec("idfpr", "036057912",
             license_issue_date=date(2026, 2, 1), license_status="ACTIVE")
    resolved = IdentityResolver().resolve([a, b])

    assert len(resolved) == 1
    p = resolved[0]
    assert p.identity_confidence == 1.0
    assert p.npi == "1234509876"
    assert p.license_status == "ACTIVE"
    assert p.matches[0].reason == "license number match"
