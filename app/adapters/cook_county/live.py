"""Live Cook County property adapter (free Socrata API, no key).

Assessor – Parcel Sales dataset: real deed transfers with buyer names,
prices, and dates. Queried BY BUYER NAME for the physicians we already
track (same targeted pattern as the IDFPR/PECOS adapters), limited to the
scoring decay window.

Known limits (see docs/RESEARCH_PROPERTY_SIGNAL.md): Cook County only, and the
join is name+state — the strict enrichment matcher plus the price floor
keep false attaches down until a paid, address-keyed source is added.
"""
from datetime import date, timedelta
from typing import Callable, Iterable

from app.adapters.base import BaseDataSource, EnrichmentRecord, polite_get_json

DATASET_URL = "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json"
# Socrata handles large IN() lists fine; 100 names is ~2.5KB of query —
# 4x fewer round-trips than the old 25.
BATCH_SIZE = 100
MIN_SALE_PRICE = 100_000       # ignore token transfers / junk deeds
LOOKBACK_DAYS = int(36.5 * 30.44)  # ~36 months — beyond that, recency ≈ 0


def _default_fetch_json(params: dict) -> list[dict]:
    data = polite_get_json(DATASET_URL, params, timeout=60)
    return data if isinstance(data, list) else []


class CookCountyLiveDataSource(BaseDataSource):
    name = "cook_county"

    def __init__(
        self,
        buyer_names: Iterable[tuple[str, str]],  # (first, last)
        fetch_json: Callable[[dict], list[dict]] = _default_fetch_json,
        today: date | None = None,
    ):
        # Dataset stores names as "FIRST LAST" uppercase
        self.buyer_names = sorted(
            {f"{first} {last}".upper().strip() for first, last in buyer_names if first and last}
        )
        self.today = today or date.today()
        self.fetch_json = fetch_json

    def fetch(self) -> Iterable[EnrichmentRecord]:
        since = (self.today - timedelta(days=LOOKBACK_DAYS)).isoformat()
        seen_docs: set[str] = set()

        for start in range(0, len(self.buyer_names), BATCH_SIZE):
            batch = self.buyer_names[start : start + BATCH_SIZE]
            names_in = ",".join("'" + n.replace("'", "''") + "'" for n in batch)
            rows = self.fetch_json(
                {
                    "$where": (
                        f"buyer_name in({names_in}) "
                        f"AND sale_date >= '{since}T00:00:00' "
                        f"AND sale_price >= {MIN_SALE_PRICE}"
                    ),
                    "$limit": len(batch) * 8,
                }
            )
            for row in rows:
                record = self._to_record(row, seen_docs)
                if record:
                    yield record

    def _to_record(self, row: dict, seen_docs: set[str]) -> EnrichmentRecord | None:
        buyer = (row.get("buyer_name") or "").strip()
        doc_no = row.get("doc_no") or ""
        if not buyer or not doc_no:
            return None
        # Multi-parcel sales repeat per PIN — one event per deed document
        if doc_no in seen_docs:
            return None
        seen_docs.add(doc_no)

        parts = buyer.title().split()
        if len(parts) < 2:
            return None
        try:
            price = int(float(row.get("sale_price", 0)))
        except (TypeError, ValueError):
            price = None
        sale_date = (row.get("sale_date") or "")[:10]

        return EnrichmentRecord(
            source=self.name,
            source_record_id=doc_no,
            kind="PROPERTY",
            owner_first_name=parts[0],
            owner_last_name=parts[-1],
            state="IL",
            event_date=date.fromisoformat(sale_date) if sale_date else None,
            property_address=f"Cook County PIN {row.get('pin', '?')}",
            sale_price=price,
        )
