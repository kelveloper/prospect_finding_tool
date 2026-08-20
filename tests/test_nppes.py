from app.adapters.npi.live import NPPESDataSource
from app.scoring.detector import specialty_tier


def _result(npi, first, last, tax_state="IL", license_no="036-123456",
            desc="Orthopaedic Surgery", addr_state="IL", primary=True,
            code="207X00000X"):
    return {
        "number": npi,
        "basic": {
            "first_name": first,
            "last_name": last,
            "middle_name": "Q",
            "credential": "MD",
            "enumeration_date": "2026-02-01",
        },
        "taxonomies": [
            {"desc": desc, "license": license_no, "state": tax_state,
             "primary": primary, "code": code}
        ],
        "addresses": [{"state": addr_state, "address_purpose": "LOCATION"}],
    }


def _source(pages, **kwargs):
    calls = []

    def fake_fetch(params):
        calls.append(params)
        page = pages[min(len(calls) - 1, len(pages) - 1)]
        return {"result_count": len(page), "results": page}

    src = NPPESDataSource(
        specialties=["Orthopaedic Surgery"], fetch_json=fake_fetch, **kwargs
    )
    return src, calls


def test_maps_uppercase_nppes_record_with_license():
    src, _ = _source([[_result("1111111111", "WALAA", "ABDELFADEEL")]])
    records = list(src.fetch())

    assert len(records) == 1
    r = records[0]
    assert r.first_name == "Walaa"          # title-cased
    assert r.last_name == "Abdelfadeel"
    assert r.npi == "1111111111"
    assert r.license_number == "036-123456"  # captured for the IDFPR join
    assert r.state == "IL"
    assert r.enumeration_date is not None


def test_filters_out_other_state_physicians():
    rows = [
        _result("1111111111", "IN", "STATE", tax_state="IL"),
        _result("2222222222", "OUT", "OFSTATE", tax_state="MO", addr_state="MO"),
    ]
    src, _ = _source([rows])
    names = [r.last_name for r in src.fetch()]
    assert names == ["State"]


def test_non_physicians_filtered_by_taxonomy_code():
    rows = [
        _result("1111111111", "REAL", "DOCTOR", code="207X00000X"),
        _result("2222222222", "GASTRO", "NURSE", desc="Registered Nurse, Gastroenterology",
                code="163WG0000X"),
    ]
    src, _ = _source([rows])
    names = [r.last_name for r in src.fetch()]
    assert names == ["Doctor"]


def test_deduplicates_across_specialty_queries():
    row = _result("1111111111", "SAME", "PERSON")
    src = NPPESDataSource(
        specialties=["Orthopaedic Surgery", "Plastic Surgery"],
        fetch_json=lambda *_: {"result_count": 1, "results": [row]},
    )
    assert len(list(src.fetch())) == 1


def test_pagination_respects_limit():
    full_page = [_result(f"{i:010d}", "DOC", f"NUM{i}") for i in range(200)]
    src, calls = _source([full_page, full_page[:50]], limit_per_specialty=250)
    records = list(src.fetch())

    assert calls[0]["limit"] == 200 and calls[0]["skip"] == 0
    assert calls[1]["limit"] == 50 and calls[1]["skip"] == 200
    assert len(records) == 200  # dedup collapses the overlapping second page


def test_compound_specialty_maps_to_tier():
    assert specialty_tier(
        "Orthopaedic Surgery, Adult Reconstructive Orthopaedic Surgery"
    ) == 1.0
    assert specialty_tier("Family Medicine") == 0.4
    assert specialty_tier("Something Unrecognized") == 0.4
