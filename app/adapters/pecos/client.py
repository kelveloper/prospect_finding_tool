"""CMS PECOS / provider-data API client (free, no key).

Two datasets, both queried BY NPI so we only pull data for physicians we
already track:
- Revalidation Clinic Group Practice Reassignment — who each physician
  bills under (their employer / practice group)
- Facility Affiliation — which hospitals/facilities they're affiliated with
"""
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Iterable

from app.adapters.base import polite_get_json

# data.cms.gov is the slowest source in the sweep; a few requests in
# flight (each still throttled) keeps us polite while not serializing
# ~30 batches end to end.
MAX_CONCURRENT_BATCHES = 4

REASSIGNMENT_URL = (
    "https://data.cms.gov/data-api/v1/dataset/"
    "e1f1fa9a-d6b4-417e-948a-c72dead8a41c/data"
)
FACILITY_URL = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/27ea-46a8/0"
)
BATCH_SIZE = 50


def _default_get_json(url: str, params: dict) -> dict | list:
    return polite_get_json(url, params, timeout=60)


class PECOSClient:
    def __init__(self, get_json: Callable[[str, dict], dict | list] = _default_get_json):
        self.get_json = get_json

    def _fetch_batches(self, url: str, all_params: list[dict]) -> list[dict | list]:
        """Run one request per batch, a few concurrently, results in order."""
        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_BATCHES) as pool:
            return list(pool.map(lambda p: self.get_json(url, p), all_params))

    def group_reassignments(self, npis: Iterable[str]) -> list[dict]:
        """Rows of {npi, group_pac_id, group_name, specialty, employer_count}."""
        npis = sorted(set(npis))
        all_params: list[dict] = []
        for start in range(0, len(npis), BATCH_SIZE):
            batch = npis[start : start + BATCH_SIZE]
            params: dict = {
                "filter[n][condition][path]": "Individual NPI",
                "filter[n][condition][operator]": "IN",
                "size": len(batch) * 8,  # physicians can have several groups
            }
            for i, npi in enumerate(batch):
                params[f"filter[n][condition][value][{i}]"] = npi
            all_params.append(params)
        rows: list[dict] = []
        for data in self._fetch_batches(REASSIGNMENT_URL, all_params):
            for row in data if isinstance(data, list) else []:
                if row.get("Record Type") != "Reassignment":
                    continue
                rows.append(
                    {
                        "npi": row.get("Individual NPI"),
                        "group_pac_id": row.get("Group PAC ID"),
                        "group_name": (row.get("Group Legal Business Name") or "").strip(),
                        "specialty": row.get("Individual Specialty Description"),
                        "employer_count": row.get("Individual Total Employer Associations"),
                    }
                )
        return rows

    def facility_affiliations(self, npis: Iterable[str]) -> list[dict]:
        """Rows of {npi, facility_type, cert_number}."""
        npis = sorted(set(npis))
        all_params: list[dict] = []
        for start in range(0, len(npis), BATCH_SIZE):
            batch = npis[start : start + BATCH_SIZE]
            params: dict = {
                "conditions[0][property]": "npi",
                "conditions[0][operator]": "in",
                "limit": len(batch) * 8,
            }
            for i, npi in enumerate(batch):
                params[f"conditions[0][value][{i}]"] = npi
            all_params.append(params)
        rows: list[dict] = []
        for data in self._fetch_batches(FACILITY_URL, all_params):
            results = data.get("results", []) if isinstance(data, dict) else []
            for row in results:
                cert = row.get("facility_affiliations_certification_number") or ""
                if not cert:
                    continue
                rows.append(
                    {
                        "npi": row.get("npi"),
                        "facility_type": row.get("facility_type") or "Facility",
                        "cert_number": cert,
                    }
                )
        return rows
