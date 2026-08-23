"""CMS PECOS / provider-data API client (free, no key).

Two datasets, both queried BY NPI so we only pull data for physicians we
already track:
- Revalidation Clinic Group Practice Reassignment — who each physician
  bills under (their employer / practice group)
- Facility Affiliation — which hospitals/facilities they're affiliated with
"""
from typing import Callable, Iterable

import httpx

REASSIGNMENT_URL = (
    "https://data.cms.gov/data-api/v1/dataset/"
    "e1f1fa9a-d6b4-417e-948a-c72dead8a41c/data"
)
FACILITY_URL = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/27ea-46a8/0"
)
BATCH_SIZE = 50


def _default_get_json(url: str, params: dict) -> dict | list:
    response = httpx.get(url, params=params, timeout=60)
    response.raise_for_status()
    return response.json()


class PECOSClient:
    def __init__(self, get_json: Callable[[str, dict], dict | list] = _default_get_json):
        self.get_json = get_json

    def group_reassignments(self, npis: Iterable[str]) -> list[dict]:
        """Rows of {npi, group_pac_id, group_name, specialty, employer_count}."""
        npis = sorted(set(npis))
        rows: list[dict] = []
        for start in range(0, len(npis), BATCH_SIZE):
            batch = npis[start : start + BATCH_SIZE]
            params: dict = {
                "filter[n][condition][path]": "Individual NPI",
                "filter[n][condition][operator]": "IN",
                "size": len(batch) * 8,  # physicians can have several groups
            }
            for i, npi in enumerate(batch):
                params[f"filter[n][condition][value][{i}]"] = npi
            data = self.get_json(REASSIGNMENT_URL, params)
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
        rows: list[dict] = []
        for start in range(0, len(npis), BATCH_SIZE):
            batch = npis[start : start + BATCH_SIZE]
            params: dict = {
                "conditions[0][property]": "npi",
                "conditions[0][operator]": "in",
                "limit": len(batch) * 8,
            }
            for i, npi in enumerate(batch):
                params[f"conditions[0][value][{i}]"] = npi
            data = self.get_json(FACILITY_URL, params)
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
