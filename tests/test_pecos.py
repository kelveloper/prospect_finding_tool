from datetime import date

from app.adapters.base import EnrichmentRecord, RawProviderRecord
from app.adapters.pecos.client import PECOSClient
from app.identity.enrichment import EnrichmentMatcher
from app.identity.resolver import IdentityResolver
from app.scoring import SignalDetector
from app.services.pecos_sync import PECOSService

REF = date(2026, 8, 21)
NPI = "1234567801"
NAMES = {NPI: ("John", "Smith")}


class FakeClient(PECOSClient):
    def __init__(self, groups, facilities=None):
        self.groups = groups
        self.facilities = facilities or []

    def group_reassignments(self, npis):
        return [g for g in self.groups if g["npi"] in set(npis)]

    def facility_affiliations(self, npis):
        return [f for f in self.facilities if f["npi"] in set(npis)]


def _group(name, pac="PAC1", npi=NPI):
    return {"npi": npi, "group_pac_id": pac, "group_name": name,
            "specialty": "Orthopedic Surgery", "employer_count": "1"}


def test_first_sync_seeds_baseline_no_events(db_session):
    svc = PECOSService(db_session, FakeClient([_group("Northwestern Medical Group")]))
    records, result = svc.sync(NAMES, REF)

    assert result.new_events == 0
    assert [r for r in records if r.kind == "CAREER"] == []


def test_group_change_detected_on_second_sync(db_session):
    svc1 = PECOSService(db_session, FakeClient([_group("Northwestern Medical Group")]))
    svc1.sync(NAMES, date(2026, 7, 1))

    svc2 = PECOSService(
        db_session, FakeClient([_group("Smith Orthopedics PLLC", pac="PAC2")])
    )
    records, result = svc2.sync(NAMES, REF)

    assert result.new_events == 1
    career = [r for r in records if r.kind == "CAREER"]
    assert len(career) == 1
    assert "Smith Orthopedics PLLC" in career[0].role_title
    assert career[0].npi == NPI
    assert career[0].event_date == REF
    # The new group carries his surname: he formed his own practice
    assert career[0].career_kind == "OWN_PRACTICE"

    # Third sync with unchanged data: no duplicate events
    svc3 = PECOSService(
        db_session, FakeClient([_group("Smith Orthopedics PLLC", pac="PAC2")])
    )
    records3, result3 = svc3.sync(NAMES, date(2026, 9, 21))
    assert result3.new_events == 0
    # The old event persists with its ORIGINAL detection date
    career3 = [r for r in records3 if r.kind == "CAREER"]
    assert len(career3) == 1
    assert career3[0].event_date == REF


def test_ownership_inference_only_on_name_match(db_session):
    svc = PECOSService(
        db_session,
        FakeClient([
            _group("Smith Orthopedics PLLC", pac="PAC2"),
            _group("Northwestern Medical Group", pac="PAC3"),
        ]),
    )
    records, result = svc.sync(NAMES, REF)

    entities = [r for r in records if r.kind == "ENTITY"]
    assert result.ownership_inferences == 1
    assert len(entities) == 1
    assert entities[0].entity_name == "Smith Orthopedics PLLC"
    assert entities[0].entity_type == "PLLC"
    assert entities[0].npi == NPI


def test_pecos_records_attach_by_npi_not_name(db_session):
    # Even with a different name spelling, the NPI carries the attach
    prospect = IdentityResolver().resolve([
        RawProviderRecord(source="npi", source_record_id=NPI, npi=NPI,
                          first_name="Jonathan", last_name="Smith", state="IL"),
    ])
    record = EnrichmentRecord(
        source="pecos", source_record_id="x", kind="CAREER",
        owner_first_name="John", owner_last_name="Smith", npi=NPI,
        event_date=REF, role_title="Started billing under new group 'X'",
        organization="X",
    )
    matched = EnrichmentMatcher().attach(prospect, [record])
    assert matched == 1
    assert prospect[0].matches[-1].reason == "NPI match"

    # And a different NPI never attaches, name match or not
    wrong = EnrichmentRecord(
        source="pecos", source_record_id="y", kind="CAREER",
        owner_first_name="Jonathan", owner_last_name="Smith", npi="9999999999",
        event_date=REF, role_title="z", organization="z",
    )
    assert EnrichmentMatcher().attach(prospect, [wrong]) == 0


def test_detector_renders_pecos_signals(db_session):
    svc1 = PECOSService(db_session, FakeClient([_group("Old Group")]))
    svc1.sync(NAMES, date(2026, 7, 21))
    svc2 = PECOSService(db_session, FakeClient([_group("Smith Orthopedics PLLC", pac="P2")]))
    records, _ = svc2.sync(NAMES, REF)

    prospects = IdentityResolver().resolve([
        RawProviderRecord(source="npi", source_record_id=NPI, npi=NPI,
                          first_name="John", last_name="Smith", state="IL",
                          enumeration_date=date(2024, 1, 1)),
    ])
    EnrichmentMatcher().attach(prospects, records)
    signals = SignalDetector().detect(prospects[0], REF)

    career = [s for s in signals if s.signal_type == "CAREER_ADVANCEMENT"]
    ownership = [s for s in signals if s.signal_type == "OWNERSHIP"]
    assert career and "Formed own practice" in career[0].description
    assert career[0].strength == 1.0  # own practice × detected today
    assert ownership and "Bills Medicare under own entity" in ownership[0].description
    assert ownership[0].strength == 1.0  # active PLLC, under ten years in


def test_own_llc_is_a_discounted_trigger(db_session):
    """A surname-carrying LLC is the doctor's company, not a medical practice:
    0.6 of the career weight, the same discount the ownership value uses."""
    svc1 = PECOSService(db_session, FakeClient([_group("Old Group")]))
    svc1.sync(NAMES, date(2026, 7, 21))
    svc2 = PECOSService(db_session, FakeClient([_group("Smith Holdings LLC", pac="P2")]))
    records, _ = svc2.sync(NAMES, REF)
    career = [r for r in records if r.kind == "CAREER"]
    assert career[0].career_kind == "OWN_ENTITY"

    prospects = IdentityResolver().resolve([
        RawProviderRecord(source="npi", source_record_id=NPI, npi=NPI,
                          first_name="John", last_name="Smith", state="IL"),
    ])
    EnrichmentMatcher().attach(prospects, records)
    signals = SignalDetector().detect(prospects[0], REF)
    move = [s for s in signals if s.signal_type == "CAREER_ADVANCEMENT"][0]
    assert move.strength == 0.6
    assert "Formed own company (not a medical practice)" in move.description


def test_employer_group_change_is_a_weak_trigger(db_session):
    """A move between groups that are not the doctor's own is worth 0.3 of
    the career weight — the employer's paperwork, not a wealth event."""
    svc1 = PECOSService(db_session, FakeClient([_group("Old Group")]))
    svc1.sync(NAMES, date(2026, 7, 21))
    svc2 = PECOSService(db_session, FakeClient([_group("Northwestern Medical Group", pac="P2")]))
    records, _ = svc2.sync(NAMES, REF)
    career = [r for r in records if r.kind == "CAREER"]
    assert career[0].career_kind == "GROUP_CHANGE"

    prospects = IdentityResolver().resolve([
        RawProviderRecord(source="npi", source_record_id=NPI, npi=NPI,
                          first_name="John", last_name="Smith", state="IL"),
    ])
    EnrichmentMatcher().attach(prospects, records)
    signals = SignalDetector().detect(prospects[0], REF)
    move = [s for s in signals if s.signal_type == "CAREER_ADVANCEMENT"][0]
    assert move.strength == 0.3
    assert "Started billing under new group" in move.description


def test_client_batches_and_filters():
    calls = []

    def fake_get(url, params):
        calls.append((url, params))
        if "provider-data" in url:
            return {"results": []}
        return [
            {"Record Type": "Reassignment", "Individual NPI": "0000000001",
             "Group PAC ID": "P", "Group Legal Business Name": "G",
             "Individual Specialty Description": "S",
             "Individual Total Employer Associations": "1"},
            {"Record Type": "Physician Assistant", "Individual NPI": "0000000001"},
        ]

    client = PECOSClient(get_json=fake_get)
    npis = [f"{i:010d}" for i in range(120)]
    rows = client.group_reassignments(npis)

    reass_calls = [c for c in calls if "data-api" in c[0]]
    assert len(reass_calls) == 3  # 120 / 50 per batch
    # Non-reassignment record types are filtered out
    assert all(r["group_pac_id"] == "P" for r in rows)
    assert len(rows) == 3  # one kept row per batch call
