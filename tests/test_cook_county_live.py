from datetime import date

from app.adapters.cook_county.live import CookCountyLiveDataSource

TODAY = date(2026, 8, 23)


def _row(buyer="JOHN SMITH", doc="DOC1", price="985000",
         sale_date="2026-06-12T00:00:00", pin="14-29-100-001"):
    return {"buyer_name": buyer, "doc_no": doc, "sale_price": price,
            "sale_date": sale_date, "pin": pin, "deed_type": "Warranty"}


def _source(rows, names=(("John", "Smith"),), **kwargs):
    calls = []

    def fake_fetch(params):
        calls.append(params)
        return rows

    src = CookCountyLiveDataSource(
        buyer_names=names, fetch_json=fake_fetch, today=TODAY, **kwargs
    )
    return src, calls


def test_maps_sale_to_property_record():
    src, calls = _source([_row()])
    records = list(src.fetch())

    assert len(records) == 1
    r = records[0]
    assert r.kind == "PROPERTY"
    assert r.owner_first_name == "John"
    assert r.owner_last_name == "Smith"
    assert r.sale_price == 985000
    assert r.event_date == date(2026, 6, 12)
    assert r.state == "IL"
    # Query is targeted: uppercase name + recency window + price floor
    where = calls[0]["$where"]
    assert "'JOHN SMITH'" in where
    assert "sale_price >= 100000" in where
    assert "sale_date >=" in where


def test_dedupes_multiparcel_rows_by_doc_no():
    rows = [_row(doc="DOC1", pin="PIN-A"), _row(doc="DOC1", pin="PIN-B"),
            _row(doc="DOC2", pin="PIN-C")]
    src, _ = _source(rows)
    assert len(list(src.fetch())) == 2


def test_skips_blank_buyers_and_mononyms():
    rows = [_row(buyer=""), _row(buyer="CHER", doc="DOC9"), _row(doc="DOC2")]
    src, _ = _source(rows)
    records = list(src.fetch())
    assert len(records) == 1
    assert records[0].source_record_id == "DOC2"


def test_batches_names():
    src, calls = _source([], names=[(f"F{i}", f"L{i}") for i in range(250)])
    list(src.fetch())
    assert len(calls) == 3  # 250 names / 100 per batch
