"""API tests drive the real live-mode route with the external sources
monkeypatched at the route boundary — the product has no fixture mode."""
from datetime import date, timedelta

import pytest

import app.api.routes as routes
from app.adapters.base import EnrichmentRecord, RawProviderRecord

TODAY = date.today()


def _nppes(npi, first, last, specialty, license_number=None, enumerated=None):
    return RawProviderRecord(
        source="npi",
        source_record_id=npi,
        first_name=first,
        last_name=last,
        specialty=specialty,
        state="IL",
        npi=npi,
        enumeration_date=enumerated,
        license_number=license_number,
        city="Chicago",
        address_state="IL",
    )


def _idfpr(first, last, license_number, issued):
    return RawProviderRecord(
        source="idfpr",
        source_record_id=license_number,
        first_name=first,
        last_name=last,
        state="IL",
        license_number=license_number,
        license_issue_date=issued,
        license_status="ACTIVE",
    )


NPPES_RECORDS = [
    _nppes("1234567801", "John", "Smith", "Orthopaedic Surgery",
           license_number="036-111111", enumerated=TODAY - timedelta(days=90)),
    _nppes("1234567802", "Maria", "Gonzalez", "Plastic Surgery",
           license_number="036-222222", enumerated=TODAY - timedelta(days=120)),
    _nppes("1234567803", "Michael", "Brooks", "Pediatrics",
           enumerated=date(2017, 5, 1)),
]

IDFPR_RECORDS = [
    _idfpr("John", "Smith", "036-111111", TODAY - timedelta(days=60)),
    _idfpr("Maria", "Gonzalez", "036-222222", TODAY - timedelta(days=75)),
]

PECOS_RECORDS = [
    EnrichmentRecord(
        source="pecos", source_record_id="1234567801-entity", kind="ENTITY",
        owner_first_name="John", owner_last_name="Smith", state="IL",
        npi="1234567801", entity_name="Smith Orthopedics PLLC",
        entity_type="PLLC", entity_status="ACTIVE",
    ),
    # Trap: an NPI we don't track — must never attach to anyone
    EnrichmentRecord(
        source="pecos", source_record_id="9999999999-entity", kind="ENTITY",
        owner_first_name="Gregory", owner_last_name="Palumbo", state="IL",
        npi="9999999999", entity_name="Windy City Landscaping LLC",
        entity_type="LLC", entity_status="ACTIVE",
    ),
]

COOK_RECORDS = [
    EnrichmentRecord(
        source="cook_county", source_record_id="DOC-7001", kind="PROPERTY",
        owner_first_name="Maria", owner_last_name="Gonzalez", state="IL",
        event_date=TODAY - timedelta(days=200),
        property_address="123 W Superior St, Chicago",
        sale_price=1_200_000,
    ),
]


class _FakeSource:
    def __init__(self, records):
        self._records = records

    def fetch(self):
        return iter(self._records)


@pytest.fixture(autouse=True)
def live_stub(monkeypatch):
    calls = {}
    # Mutable per-test copies — a test can append records between ingests to
    # simulate new information arriving (e.g. a fresh property purchase)
    feeds = {
        "nppes": list(NPPES_RECORDS),
        "idfpr": list(IDFPR_RECORDS),
        "pecos": list(PECOS_RECORDS),
        "cook": list(COOK_RECORDS),
    }

    def fake_nppes(**kwargs):
        calls["nppes"] = kwargs
        return _FakeSource(feeds["nppes"])

    def fake_idfpr(**kwargs):
        calls["idfpr"] = kwargs
        return _FakeSource(feeds["idfpr"])

    def fake_cook(**kwargs):
        calls["cook"] = kwargs
        return _FakeSource(feeds["cook"])

    class FakePECOSService:
        def __init__(self, db):
            pass

        def sync(self, npi_names):
            calls["pecos"] = dict(npi_names)
            return list(feeds["pecos"]), 0

    monkeypatch.setattr(routes, "NPPESDataSource", fake_nppes)
    monkeypatch.setattr(routes, "IDFPRLiveDataSource", fake_idfpr)
    monkeypatch.setattr(routes, "CookCountyLiveDataSource", fake_cook)
    monkeypatch.setattr(routes, "PECOSService", FakePECOSService)
    return {"calls": calls, "feeds": feeds}


def _ingest(client):
    response = client.post("/ingest/run")
    assert response.status_code == 200, response.text
    return response.json()


def test_ingest_resolves_and_creates_prospects(client):
    result = _ingest(client)
    assert result["records_ingested"] == 5  # 3 NPPES + 2 IDFPR
    # Smith and Gonzalez each merge across sources; Brooks is NPPES-only
    assert result["prospects_resolved"] == 3
    assert result["prospects_created"] == 3
    # 2 PECOS entities + 1 deed; the Palumbo trap NPI must be rejected
    assert result["enrichment_records"] == 3
    assert result["enrichment_matched"] == 2


def test_live_sources_are_chained(client, live_stub):
    _ingest(client)
    calls = live_stub["calls"]
    # IDFPR is queried by the license numbers NPPES surfaced
    assert set(calls["idfpr"]["license_numbers"]) == {"036-111111", "036-222222"}
    # PECOS is keyed by every NPI in the pull
    assert set(calls["pecos"]) == {"1234567801", "1234567802", "1234567803"}
    # Cook County deeds are searched by the physicians' names
    assert ("Maria", "Gonzalez") in set(calls["cook"]["buyer_names"])


def test_ingest_is_idempotent(client):
    _ingest(client)
    second = _ingest(client)
    assert second["prospects_created"] == 0
    assert second["prospects_updated"] == 3


def test_ranked_endpoint_orders_by_score_desc(client):
    _ingest(client)
    response = client.get("/prospects/ranked")
    assert response.status_code == 200
    ranked = response.json()

    assert len(ranked) == 3
    scores = [p["score"] for p in ranked]
    assert scores == sorted(scores, reverse=True)

    top = ranked[0]
    assert {"id", "name", "score", "qualification_score", "timing_score",
            "reason_summary"} <= top.keys()
    # Fresh ortho license + his own PLLC in the billing data tops the board
    assert top["name"] == "John Smith"
    # Stale primary care with no license join lands at the bottom
    assert ranked[-1]["name"] == "Michael Brooks"


def test_prospect_detail_exposes_signals(client):
    _ingest(client)
    top = client.get("/prospects/ranked").json()[0]
    detail = client.get(f"/prospects/{top['id']}").json()

    assert detail["signals"], "every scored prospect must have signals"
    types = {s["signal_type"] for s in detail["signals"]}
    assert "PHYSICIAN" in types
    assert "OWNERSHIP" in types
    assert all(0 <= s["strength"] <= 1 for s in detail["signals"])


def test_score_history_appends_every_ingest(client):
    _ingest(client)
    _ingest(client)
    top = client.get("/prospects/ranked").json()[0]
    detail = client.get(f"/prospects/{top['id']}").json()

    history = detail["score_history"]
    assert len(history) == 2
    # Same inputs, same score — flat trajectory, zero movement
    assert history[0]["total_score"] == history[1]["total_score"]
    assert top["score_change"] == 0.0


def test_new_property_raises_score_and_shows_movement(client, live_stub):
    _ingest(client)
    ranked_before = client.get("/prospects/ranked").json()
    smith_before = next(p for p in ranked_before if p["name"] == "John Smith")
    assert smith_before["score_change"] is None  # only one snapshot so far

    # New information arrives: Smith buys a $2M property
    live_stub["feeds"]["cook"].append(
        EnrichmentRecord(
            source="cook_county", source_record_id="DOC-7002", kind="PROPERTY",
            owner_first_name="John", owner_last_name="Smith", state="IL",
            event_date=TODAY - timedelta(days=10),
            property_address="456 N Lake Shore Dr, Chicago",
            sale_price=2_000_000,
        )
    )
    _ingest(client)

    smith_after = next(
        p for p in client.get("/prospects/ranked").json() if p["name"] == "John Smith"
    )
    assert smith_after["score"] > smith_before["score"]
    assert smith_after["score_change"] > 0

    detail = client.get(f"/prospects/{smith_after['id']}").json()
    totals = [s["total_score"] for s in detail["score_history"]]
    assert len(totals) == 2 and totals[1] > totals[0]


def test_contact_kit_endpoint(client):
    _ingest(client)
    smith = next(
        p for p in client.get("/prospects/ranked").json() if p["name"] == "John Smith"
    )
    kit = client.get(f"/prospects/{smith['id']}/contact-kit").json()

    assert kit["primary_trigger"]["signal_type"] == "OWNERSHIP"
    assert "Smith Orthopedics PLLC" in kit["letter"]["body"]
    assert kit["mail"]["city"] == "Chicago"
    assert kit["rules"]

    assert client.get("/prospects/nope/contact-kit").status_code == 404


def test_feedback_roundtrip(client):
    _ingest(client)
    prospect_id = client.get("/prospects/ranked").json()[0]["id"]

    post = client.post(
        "/feedback",
        json={"prospect_id": prospect_id, "verdict": "good_fit", "notes": "Met at event"},
    )
    assert post.status_code == 201
    assert post.json()["verdict"] == "good_fit"

    history = client.get(f"/prospects/{prospect_id}/feedback").json()
    assert len(history) == 1
    assert history[0]["notes"] == "Met at event"


def test_feedback_rejects_invalid_verdict(client):
    _ingest(client)
    prospect_id = client.get("/prospects/ranked").json()[0]["id"]
    response = client.post(
        "/feedback", json={"prospect_id": prospect_id, "verdict": "maybe"}
    )
    assert response.status_code == 422


def test_feedback_unknown_prospect_404(client):
    response = client.post(
        "/feedback", json={"prospect_id": "nope", "verdict": "good_fit"}
    )
    assert response.status_code == 404
