# Data Sources: The Four Live Pulls

What each source is, how we query it, and exactly which fields we capture.
All four are free public government APIs, no keys. Every ingest
(`POST /ingest/run`) pulls NPPES first, because the other three are queried
using what NPPES returns — licence numbers, NPI numbers and names. Once it
has finished, those three run **concurrently**: the sweep costs NPPES plus
the slowest single source, not the sum of all four.

| # | Source | Endpoint | Queried by | Feeds |
|---|---|---|---|---|
| 1 | CMS NPPES NPI Registry | `npiregistry.cms.hhs.gov/api/` | specialty + state | identity spine, PHYSICIAN, SPECIALTY, NEW_LICENSE (npi) |
| 2 | IDFPR license roster (IL Socrata) | `data.illinois.gov/resource/pzzh-kp68.json` | license number | PHYSICIAN (verified), NEW_LICENSE (idfpr) |
| 3 | CMS PECOS / provider data | `data.cms.gov` (2 datasets) | NPI | CAREER_ADVANCEMENT, OWNERSHIP (inferred) |
| 4 | Cook County Assessor Parcel Sales | `datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json` | buyer name | PROPERTY_EVENT |

---

## 1. NPPES NPI Registry — the identity spine

**Adapter:** `app/adapters/npi/live.py` · **API:** CMS NPI Registry v2.1, free, no key.

**How we query:** one search per scored specialty (8 by default: Orthopaedic
Surgery, Neurological Surgery, Plastic Surgery, Dermatology, Cardiovascular
Disease, Gastroenterology, Anesthesiology, Family Medicine), individuals only
(`enumeration_type=NPI-1`), state-filtered, paged 200 at a time up to
`limit` per specialty (cap 1,200). Non-physicians are dropped (taxonomy code
must start with `20`), as is anyone neither licensed nor practicing in the
target state.

**Exactly what we capture per physician:**

| Field | From NPPES | Notes |
|---|---|---|
| `npi` | `number` | THE join key for PECOS; unique per person |
| `first/middle/last name` | `basic.*_name` | arrives UPPERCASE, we title-case |
| `credential` | `basic.credential` | e.g. "MD" — parsed but not yet persisted to a column |
| `specialty` | primary taxonomy `desc` | drives the SPECIALTY tier |
| `enumeration_date` | `basic.enumeration_date` | NEW_LICENSE (npi) timing signal |
| `license_number` | taxonomy block `license` (prefer target-state license) | THE join key for IDFPR |
| `address_line`, `city`, `address_state`, `zip_code` | best LOCATION address (prefer target state) | **practice address — a real contact channel** |
| `phone` | LOCATION `telephone_number` | **practice phone — a real contact channel** |

**Limits:** state search matches any address on the record, so we re-filter;
no email anywhere in the search API.

---

## 2. IDFPR license roster — license verification

**Adapter:** `app/adapters/idfpr/live.py` · **API:** State of Illinois Socrata
open data, dataset `pzzh-kp68` (1.2M+ licenses), free, no key.

**How we query:** by the license numbers NPPES surfaced, normalized
(`036.057912` → `036057912`), batches of 50 via
`$where license_number in(...)`. Keeps only individual (`business != Y`)
"PHYSICIAN AND SURGEON" licenses.

**Exactly what we capture per license:**

| Field | From IDFPR | Notes |
|---|---|---|
| `first/middle/last name` | `first_name`, `middle`, `last_name` | second identity witness → 0.95 cluster confidence |
| `license_number` | `license_number` | exact-match merges with the NPPES record (score 1.0) |
| `license_issue_date` | `original_issue_date` | the strongest timing signal — NEW_LICENSE (idfpr), 40 pts |
| `license_status` | `license_status` | ACTIVE → PHYSICIAN strength 1.0 |
| `city`, `address_state`, `zip_code` | `city`, `state`, `zip` | licensee city/zip only — no street address |

**Limits:** Illinois only; ~62% of NPPES license numbers join (the rest have
formatting/state mismatches — name+state fallback is on the roadmap).

---

## 3. CMS PECOS / provider data — career moves + ownership inference

**Adapter/service:** `app/adapters/pecos/client.py` + `app/services/pecos_sync.py`.
Two CMS datasets, both queried **by NPI** in batches of 50 (zero name-match risk):

- **Revalidation Clinic Group Practice Reassignment**
  (`data.cms.gov/data-api/v1/dataset/e1f1fa9a-…/data`) — who each physician
  bills Medicare under (their employer / practice group).
- **Facility Affiliation** (`data.cms.gov/provider-data/...27ea-46a8`) — which
  hospitals/facilities they're affiliated with.

**Exactly what we capture:**

| Field | From PECOS | Notes |
|---|---|---|
| `group_pac_id`, `group_name` | reassignment rows | the billing group's legal name, e.g. "Smith Orthopedics PLLC" |
| `specialty`, `employer_count` | reassignment rows | corroboration + multi-employer context |
| `facility_type`, `cert_number` | facility affiliation rows | hospital/facility ties |

**What we derive (stored in our own tables):**
- `affiliation_snapshots` — the current (group, facility) set per NPI, replaced each sync
- `career_events` — a **diff vs. the previous snapshot**: NEW_GROUP / NEW_FACILITY
  rows with detection dates → CAREER_ADVANCEMENT signal (first sync only seeds
  the baseline; events accrue from the second sync)
- **OWNERSHIP inference** — if the physician's last name appears as a word in
  their billing group's legal name ("Smith Orthopedics **PLLC**"), we emit an
  ENTITY record: they almost certainly own that entity. PLLC/PC/SC scores
  higher than generic LLC.

**Limits:** refreshed ~monthly by CMS; ownership is an inference until a paid
registry source (formation dates, officer records) is added.

---

## 4. Cook County Assessor Parcel Sales — property purchases

**Adapter:** `app/adapters/cook_county/live.py` · **API:** Cook County Socrata
open data, dataset `wvhk-k5uv`, free, no key.

**How we query:** by buyer name ("FIRST LAST" uppercase) for the physicians we
already track, batches of 25, filtered to `sale_price >= $100,000` and the
last ~36 months (beyond that, recency strength ≈ 0). Multi-parcel sales are
deduped by deed document number.

**Exactly what we capture per deed:**

| Field | From dataset | Notes |
|---|---|---|
| `source_record_id` | `doc_no` | deed document number (dedupe key) |
| `owner_first/last_name` | `buyer_name` split | join is name+state — strict matcher rejects near-misses |
| `event_date` | `sale_date` | drives PROPERTY_EVENT recency decay |
| `sale_price` | `sale_price` | shown on the dossier |
| `property_address` | `pin` | stored as "Cook County PIN {pin}" — parcel ID, not a street address yet |

**Limits:** Cook County only; name+state join (mitigated by the $100k floor and
the strict enrichment matcher); PIN→street-address resolution not yet built.

---

## How the records connect (the join map)

One person ends up as one prospect because every source is tied back to the
NPPES record by a specific key:

```
                    NPPES record (per physician)
                    npi · name · license_number
                         │
     license_number      │ npi                │ "FIRST LAST"
          ▼              ▼                    ▼
       IDFPR           PECOS             Cook County
   (same person,   (same person,      (same person, by
   by license #)      by NPI)          name + state)
```

| Connection | Key | Rule (where enforced) | Certainty |
|---|---|---|---|
| NPPES ↔ IDFPR | **state license number**, normalized (`036.057912` → `036057912`) | exact match = 1.0 merge; else name+state tiers ≥ 0.80 (`IdentityResolver`) | strongest — a shared government ID |
| NPPES ↔ PECOS | **NPI** | exact NPI = attach; no NPI = no attach (`EnrichmentMatcher`) | zero name-match risk |
| NPPES ↔ Cook County | **buyer name** = "FIRST LAST" + state IL | exact normalized first + last + state = 0.9 attach; anything less is dropped (`EnrichmentMatcher`) | weakest link — mitigated by the $100k floor and drop-don't-guess matching |
| PECOS ↔ itself over time | **NPI** | current pull diffed against `affiliation_snapshots` → `career_events` (`PECOSService`) | exact |

Two different strictness philosophies, on purpose:

- **Person records (NPPES + IDFPR)** describe the same kind of thing, so
  they *merge* into one identity, tiered by evidence quality.
- **Enrichment records (PECOS entities, deeds)** would corrupt a dossier if
  mis-attached (someone else's LLC or house), so they *attach or drop* —
  never merge, never fuzzy-match. A miss is acceptable; a false match is not.

Every merge and every attach writes a row to `identity_matches` with its
score and a human-readable reason, so any claim on a dossier can be audited
back to the records that produced it.

## Contact channels this already gives us

For every prospect we already store, from NPPES: **practice street address,
city, zip, and practice phone number** — enough for a call to the office or a
direct-mail piece today. What no free source above provides: a direct email,
a mobile number, or a LinkedIn profile (see
`RESEARCH_CONTACT_OUTREACH.md` for how to get those).
