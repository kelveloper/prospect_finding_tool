def _ingest(client):
    # Tests use the fixture cohort explicitly — live mode (the default)
    # calls real external APIs and must never run in the test suite
    response = client.post("/ingest/run?mode=sample")
    assert response.status_code == 200, response.text
    return response.json()


def test_ingest_resolves_and_creates_prospects(client):
    result = _ingest(client)
    assert result["records_ingested"] == 15  # 8 NPI + 7 IDFPR sample records
    # 6 merged pairs + 2 NPI-only + 1 IDFPR-only = 9 people
    assert result["prospects_resolved"] == 9
    assert result["prospects_created"] == 9
    # Mock enrichment: 4 entities + 4 property deeds + 3 career announcements;
    # 9 attach — the Palumbo entity and Smithfield deed have no matching
    # physician and must be rejected
    assert result["enrichment_records"] == 11
    assert result["enrichment_matched"] == 9


def test_ingest_is_idempotent(client):
    _ingest(client)
    second = _ingest(client)
    assert second["prospects_created"] == 0
    assert second["prospects_updated"] == 9


def test_ranked_endpoint_orders_by_score_desc(client):
    _ingest(client)
    response = client.get("/prospects/ranked")
    assert response.status_code == 200
    ranked = response.json()

    assert len(ranked) == 9
    scores = [p["score"] for p in ranked]
    assert scores == sorted(scores, reverse=True)

    top = ranked[0]
    assert {"id", "name", "score", "qualification_score", "timing_score",
            "reason_summary"} <= top.keys()
    # THE OWNERSHIP PROOF in ranking form: John Smith (career signals + his
    # own PLLC found in the business registry) now tops the board
    assert top["name"] == "John A Smith"
    # Recently licensed high-tier specialists should outrank stale primary care
    bottom_names = {p["name"] for p in ranked[-2:]}
    assert "Michael Brooks" in bottom_names  # pediatrics, enumerated 2017


def test_prospect_detail_exposes_signals(client):
    _ingest(client)
    top = client.get("/prospects/ranked").json()[0]
    detail = client.get(f"/prospects/{top['id']}").json()

    assert detail["signals"], "every scored prospect must have signals"
    types = {s["signal_type"] for s in detail["signals"]}
    assert "PHYSICIAN" in types
    assert all(0 <= s["strength"] <= 1 for s in detail["signals"])


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
