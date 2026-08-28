"""Outreach + conversion tracking (#14): the two-click capture logged from
the profile's contact area, and the score-band funnel recalibration reads."""
from datetime import date

from app.models import Prospect


def _prospect(db, name="Ada Lovelace", score=61.6):
    first, last = name.split(" ", 1)
    p = Prospect(
        first_name=first,
        last_name=last,
        full_name=name,
        specialty="Plastic Surgery",
        state="IL",
        total_score=score,
    )
    db.add(p)
    db.commit()
    return p


def test_log_and_list_outreach(client, db_session):
    prospect = _prospect(db_session)

    resp = client.post(
        f"/prospects/{prospect.id}/outreach",
        json={
            "event_type": "not_connected",
            "channel": "phone",
            "notes": "gatekeeper — front desk would not transfer",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["event_type"] == "not_connected"
    assert body["channel"] == "phone"
    assert body["notes"].startswith("gatekeeper")
    assert body["occurred_at"] == date.today().isoformat()

    client.post(
        f"/prospects/{prospect.id}/outreach", json={"event_type": "connected"}
    )
    history = client.get(f"/prospects/{prospect.id}/outreach").json()
    assert [e["event_type"] for e in history] == ["connected", "not_connected"]


def test_follow_up_later_stores_the_reconnect_date(client, db_session):
    prospect = _prospect(db_session)

    resp = client.post(
        f"/prospects/{prospect.id}/outreach",
        json={
            "event_type": "follow_up_later",
            "notes": "wants to talk after bonus season",
            "follow_up_on": "2026-11-15",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["event_type"] == "follow_up_later"
    assert body["follow_up_on"] == "2026-11-15"

    db_session.expire_all()
    ranked = client.get("/prospects/ranked").json()
    assert ranked[0]["outreach_status"] == "follow_up_later"


def test_outreach_rejects_unknown_prospect_and_bad_event(client, db_session):
    assert (
        client.post(
            "/prospects/nope/outreach", json={"event_type": "connected"}
        ).status_code
        == 404
    )
    prospect = _prospect(db_session)
    assert (
        client.post(
            f"/prospects/{prospect.id}/outreach", json={"event_type": "ghosted"}
        ).status_code
        == 422
    )


def test_ranked_exposes_outreach_status(client, db_session):
    prospect = _prospect(db_session)
    ranked = client.get("/prospects/ranked").json()
    assert ranked[0]["outreach_status"] is None

    client.post(
        f"/prospects/{prospect.id}/outreach", json={"event_type": "connected"}
    )
    client.post(
        f"/prospects/{prospect.id}/outreach", json={"event_type": "converted"}
    )
    db_session.expire_all()
    ranked = client.get("/prospects/ranked").json()
    assert ranked[0]["outreach_status"] == "converted"


def test_ranked_flags_new_prospects(client, db_session):
    from datetime import datetime, timedelta

    fresh = _prospect(db_session, "Fresh Arrival", score=50.0)
    old = _prospect(db_session, "Old Timer", score=40.0)
    old.created_at = datetime.utcnow() - timedelta(days=10)
    db_session.commit()

    by_name = {p["name"]: p for p in client.get("/prospects/ranked").json()}
    assert by_name["Fresh Arrival"]["is_new"] is True
    assert by_name["Old Timer"]["is_new"] is False


def test_funnel_groups_by_score_band(client, db_session):
    high = _prospect(db_session, "High Scorer", score=85.0)
    mid = _prospect(db_session, "Mid Scorer", score=61.6)
    low = _prospect(db_session, "Low Scorer", score=15.0)

    for p in (high, mid, low):
        client.post(f"/prospects/{p.id}/outreach", json={"event_type": "connected"})
    # a second click on the same prospect must not double-count
    client.post(f"/prospects/{high.id}/outreach", json={"event_type": "connected"})
    client.post(f"/prospects/{high.id}/outreach", json={"event_type": "converted"})
    client.post(
        f"/prospects/{mid.id}/outreach",
        json={"event_type": "not_converted", "notes": "already has an advisor"},
    )

    funnel = client.get("/analytics/outreach-funnel").json()
    assert [b["band"] for b in funnel] == ["80-100", "60-80", "0-20"]

    top = funnel[0]
    assert top["attempted"] == 1
    assert top["connected"] == 1
    assert top["converted"] == 1
    assert top["conversion_rate"] == 1.0

    mid_band = funnel[1]
    assert mid_band["not_converted"] == 1
    assert mid_band["conversion_rate"] == 0.0
