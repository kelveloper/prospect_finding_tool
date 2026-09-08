"""API tests drive the real live-mode route with the external sources
monkeypatched at the route boundary — the product has no fixture mode."""
from datetime import date, timedelta

import pytest

import app.services.live_ingest as live_ingest
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

    monkeypatch.setattr(live_ingest, "NPPESDataSource", fake_nppes)
    monkeypatch.setattr(live_ingest, "IDFPRLiveDataSource", fake_idfpr)
    monkeypatch.setattr(live_ingest, "CookCountyLiveDataSource", fake_cook)
    monkeypatch.setattr(live_ingest, "PECOSService", FakePECOSService)
    return {"calls": calls, "feeds": feeds}


def _ingest(client):
    # force=true: tests exercise repeat ingests; the weekly gate is
    # covered by its own test below. wait=true: run in-request so the
    # result is returned and the test session's DB is the one written.
    response = client.post("/ingest/run?force=true&wait=true")
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


def test_weekly_gate_blocks_early_reruns_but_not_the_test_sweep(client):
    _ingest(client)
    blocked = client.post("/ingest/run")
    assert blocked.status_code == 429
    assert "next unlock" in blocked.json()["detail"]
    # The test sweep bypasses the gate explicitly
    assert client.post("/ingest/run?force=true&wait=true").status_code == 200


def test_discovery_filter_creates_fresh_entrants_only(client):
    # Smith/Gonzalez enumerated ~3-4 months ago → fresh; Brooks (2017,
    # no license) is an established stranger → skipped, not created
    result = client.post("/ingest/run?new_within_months=6&force=true&wait=true").json()
    assert result["prospects_created"] == 2
    assert result["prospects_skipped"] == 1
    names = {p["name"] for p in client.get("/prospects/ranked").json()}
    assert "Michael Brooks" not in names

    # Known prospects still update on a filtered re-run
    second = client.post("/ingest/run?new_within_months=6&force=true&wait=true").json()
    assert second["prospects_created"] == 0
    assert second["prospects_updated"] == 2
    assert second["prospects_skipped"] == 1


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
    # Scoreboard quick overview: distinct signal types ride on the list
    assert "OWNERSHIP" in top["signal_types"]
    assert "PHYSICIAN" in top["signal_types"]
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

    # Match evidence rides on the detail for the breakdown page
    reasons = {m["reason"] for m in detail["identity_matches"]}
    assert "license number match" in reasons
    assert "NPI match" in reasons


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


def test_field_changes_recorded_with_tiers(client, live_stub):
    _ingest(client)

    # New information: Brooks finished fellowship (specialty change → score
    # tier) and the practice moved (city change → contact tier)
    feeds = live_stub["feeds"]
    feeds["nppes"] = [
        r
        for r in feeds["nppes"]
        if r.last_name != "Brooks"
    ] + [
        RawProviderRecord(
            source="npi", source_record_id="1234567803",
            first_name="Michael", last_name="Brooks",
            specialty="Cardiovascular Disease", state="IL", npi="1234567803",
            enumeration_date=date(2017, 5, 1), city="Evanston", address_state="IL",
        )
    ]
    _ingest(client)

    brooks = next(
        p for p in client.get("/prospects/ranked").json() if p["name"] == "Michael Brooks"
    )
    detail = client.get(f"/prospects/{brooks['id']}").json()
    changes = {c["field"]: c for c in detail["field_changes"]}

    assert changes["specialty"]["old_value"] == "Pediatrics"
    assert changes["specialty"]["new_value"] == "Cardiovascular Disease"
    assert changes["specialty"]["tier"] == "score"
    assert changes["city"]["old_value"] == "Chicago"
    assert changes["city"]["new_value"] == "Evanston"
    assert changes["city"]["tier"] == "contact"
    # The specialty jump moved the score, and the board shows the movement
    assert brooks["score_change"] > 0


def test_identical_and_cosmetic_reingests_record_nothing(client, live_stub):
    _ingest(client)
    _ingest(client)  # identical

    # Cosmetic-only: same specialty, different casing — must stay silent
    feeds = live_stub["feeds"]
    feeds["nppes"] = [
        r
        for r in feeds["nppes"]
        if r.last_name != "Smith"
    ] + [
        RawProviderRecord(
            source="npi", source_record_id="1234567801",
            first_name="John", last_name="Smith",
            specialty="ORTHOPAEDIC SURGERY", state="IL", npi="1234567801",
            enumeration_date=TODAY - timedelta(days=90),
            license_number="036-111111", city="Chicago", address_state="IL",
        )
    ]
    _ingest(client)

    for p in client.get("/prospects/ranked").json():
        detail = client.get(f"/prospects/{p['id']}").json()
        assert detail["field_changes"] == []


def test_ingest_status_records_runs(client):
    empty = client.get("/ingest/status").json()
    assert empty["last_run_at"] is None

    _ingest(client)
    status = client.get("/ingest/status").json()
    assert status["last_run_at"] is not None
    assert status["state"] == "IL"
    assert status["prospects_created"] > 0
    # Newcomers get composed summaries at ingest time — nothing pending
    assert status["stale_summaries"] == 0
    for p in client.get("/prospects/ranked").json():
        assert p["advisor_summary"]
        assert p["summary_source"] == "composed"


def test_contact_kit_endpoint(client):
    _ingest(client)
    smith = next(
        p for p in client.get("/prospects/ranked").json() if p["name"] == "John Smith"
    )
    kit = client.get(f"/prospects/{smith['id']}/contact-kit").json()

    assert kit["primary_trigger"]["signal_type"] == "OWNERSHIP"
    assert "Smith Orthopedics PLLC" in kit["primary_trigger"]["description"]
    assert kit["mail"]["city"] == "Chicago"
    assert kit["rules"]

    assert client.get("/prospects/nope/contact-kit").status_code == 404




# ── Sweep telemetry: phases while it runs, the report once it lands ──
def test_ingest_status_reports_the_sweep(client, live_stub):
    result = _ingest(client)
    status = client.get("/ingest/status").json()

    # Feature B: per-source counts and the pipeline's tallies are persisted
    feeds = live_stub["feeds"]
    assert status["npi_records"] == len(feeds["nppes"])
    assert status["idfpr_records"] == len(feeds["idfpr"])
    assert status["pecos_records"] == len(feeds["pecos"])
    assert status["cook_records"] == len(feeds["cook"])
    assert status["prospects_resolved"] == result["prospects_resolved"]
    assert status["prospects_skipped"] == result["prospects_skipped"]
    assert status["enrichment_records"] == result["enrichment_records"]
    assert status["enrichment_matched"] == result["enrichment_matched"]
    assert status["duration_seconds"] is not None and status["duration_seconds"] >= 0

    # Feature A: the checklist stays readable after completion — every
    # phase done, in display order, each carrying what it produced
    phases = status["phases"]
    assert [p["key"] for p in phases] == [key for key, _ in live_ingest.PHASES]
    assert all(p["status"] == "done" for p in phases)
    by_key = {p["key"]: p for p in phases}
    assert by_key["nppes"]["records"] == len(feeds["nppes"])
    assert by_key["pecos"]["records"] == len(feeds["pecos"])
    assert by_key["resolve"]["records"] == result["prospects_resolved"]
    assert by_key["resolve"]["created"] == result["prospects_created"]
    assert by_key["resolve"]["updated"] == result["prospects_updated"]
    assert by_key["resolve"]["skipped"] == result["prospects_skipped"]
    # Every newcomer got a composed summary
    assert by_key["summaries"]["records"] == result["prospects_created"]
    assert status["started_at"] is not None
    assert status["running"] is False


def test_failing_source_marks_its_phase_and_saves_nothing(client, monkeypatch):
    import httpx

    class _Broken:
        def __init__(self, **kwargs):
            pass

        def fetch(self):
            raise httpx.ConnectTimeout("timed out after 60s")

    monkeypatch.setattr(live_ingest, "IDFPRLiveDataSource", _Broken)

    response = client.post("/ingest/run?force=true&wait=true")
    assert response.status_code == 502

    status = client.get("/ingest/status").json()
    by_key = {p["key"]: p for p in status["phases"]}
    assert by_key["nppes"]["status"] == "done"
    assert by_key["idfpr"]["status"] == "failed"
    assert "timed out after 60s" in by_key["idfpr"]["detail"]
    # The other parallel sources still finish (the pool waits for them)
    assert by_key["pecos"]["status"] == "done"
    assert by_key["cook"]["status"] == "done"
    # Downstream never ran, and nothing was recorded
    assert by_key["resolve"]["status"] == "pending"
    assert by_key["summaries"]["status"] == "pending"
    assert status["last_run_at"] is None
    assert client.get("/prospects/ranked").json() == []


def test_ingest_status_tolerates_runs_without_a_report(client, db_session):
    """Rows recorded before the report columns existed have them null."""
    from app.models import IngestRun

    db_session.add(IngestRun(state="IL", prospects_created=4, prospects_updated=0))
    db_session.commit()

    status = client.get("/ingest/status").json()
    assert status["prospects_created"] == 4
    assert status["npi_records"] is None
    assert status["duration_seconds"] is None
    assert isinstance(status["phases"], list)


# ── Identity audit on the ranked board ──
def test_ranked_rows_carry_identity_audit(client):
    _ingest(client)
    rows = client.get("/prospects/ranked").json()
    assert rows
    by_name = {r["name"]: r for r in rows}
    # John Smith: NPPES + IDFPR merged on licence number
    smith = by_name["John Smith"]
    assert smith["identity_tier"] == "certain"
    assert smith["license_matched"] is True
    assert smith["identity_confidence"] == 1.0
    assert smith["weakest_link"]["reason"]
    for r in rows:
        assert r["identity_tier"] in {"certain", "strong", "barely", "single_source"}
        assert isinstance(r["license_matched"], bool)
        assert isinstance(r["has_name_only_events"], bool)


def test_ranked_tier_filter_keeps_rank_order(client):
    _ingest(client)
    everyone = client.get("/prospects/ranked").json()
    tiers = {r["identity_tier"] for r in everyone}
    assert "certain" in tiers

    certain = client.get("/prospects/ranked?tier=certain").json()
    assert certain == [r for r in everyone if r["identity_tier"] == "certain"]

    rest = client.get("/prospects/ranked?tier=barely,single_source").json()
    assert rest == [
        r for r in everyone if r["identity_tier"] in {"barely", "single_source"}
    ]

    unmatched = client.get("/prospects/ranked?license_matched=false").json()
    assert unmatched == [r for r in everyone if not r["license_matched"]]

    assert client.get("/prospects/ranked?tier=bogus").status_code == 422


def test_single_source_includes_prospects_with_no_match_rows(client, db_session):
    from app.models import Prospect

    _ingest(client)
    # A profile that predates the audit: one source, no identity_matches rows
    db_session.add(
        Prospect(
            full_name="Solo Practitioner",
            first_name="Solo",
            last_name="Practitioner",
            state="IL",
            identity_confidence=0.6,
            total_score=1.0,
        )
    )
    db_session.commit()
    rows = client.get("/prospects/ranked?tier=single_source").json()
    solo = next(r for r in rows if r["name"] == "Solo Practitioner")
    assert solo["identity_tier"] == "single_source"
    assert solo["weakest_link"] is None


def test_ranked_board_does_not_lazy_load_per_row(client, db_session):
    from sqlalchemy import event

    _ingest(client)
    statements: list[str] = []

    def count(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", count)
    try:
        rows = client.get("/prospects/ranked?limit=5000").json()
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert len(rows) >= 3
    # One SELECT for prospects plus one per eager-loaded relationship —
    # never one per prospect
    assert len(statements) <= 6, statements
