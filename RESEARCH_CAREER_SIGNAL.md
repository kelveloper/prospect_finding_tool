# Research: Real Data Sources for CAREER_ADVANCEMENT

Researched 2026-08-21. Goal: replace the mock `affiliations` adapter with a
real source for career moves (new job, promotion, new practice). All
candidate sources probed live where possible.

## TL;DR — the winner

**CMS PECOS Reassignment + Facility Affiliation data (data.cms.gov).**
Free, no API key, **keyed by NPI** (joins to our prospects with zero
name-matching risk), refreshed monthly, and it names the physician's
employer. Diffing monthly snapshots yields real career-move events:
changed group practice, new facility affiliation, went independent.

---

## What we're trying to detect

"Career advancement" for the emerging-affluent hypothesis =
**income-changing job events**: finished training and took an attending
job, changed employers, made partner, opened own practice, added a
hospital appointment.

## Candidates evaluated

### 1. CMS PECOS enrollment + reassignment files ✅ WINNER

- **What:** Medicare's system of record for who bills under whom.
  Three datasets on data.cms.gov, all probed live and working:
  - *Revalidation Clinic Group Practice Reassignment* — physician NPI ↔
    **Group Legal Business Name** + specialty + total employer
    associations (updated 2026-08-05)
  - *Public Provider Enrollment* — NPI, specialty, state (2026-07-27)
  - *Facility Affiliation* (provider-data catalog) — NPI ↔ hospital
    certification numbers, 2.25M rows, monthly refresh
- **Access:** free JSON APIs, no key, e.g.
  `data.cms.gov/data-api/v1/dataset/e1f1fa9a-…/data?size=…`
- **Signal quality:** high. A monthly diff detects: new employer
  association (job change), first-ever reassignment (entered practice),
  new hospital affiliation (appointment), reassignment to an entity whose
  name matches the physician (**went independent — corroborates the
  OWNERSHIP signal!**).
- **Joins on NPI** — no name matching, no misattribution risk.
- **Limits:** monthly granularity (fine — decay curve buckets are 6-month);
  Medicare-enrolled providers only (nearly all practicing physicians);
  detecting *changes* requires storing snapshots and diffing — a new
  `affiliation_snapshots` table.

### 2. NPPES weekly change files ◻ good complement, later

- CMS publishes weekly incremental + monthly full NPI files (free bulk
  downloads). Practice-address or taxonomy changes ≈ job moves.
- NPI-keyed, free — but bulk-file plumbing (multi-GB monthly full file),
  and an address change is a weaker/noisier event than a named employer
  change. **Verdict:** add later as a freshness booster, not the backbone.

### 3. GDELT news API ◻ niche complement

- Free global news monitoring (probed: works, but rate-limited to ~1
  request/5s and research-grade reliability). Could catch "Dr. X named
  Chief of Surgery" press stories PECOS never sees (titles like
  "partner"/"chief").
- **Problem:** joins by *name in news text* — exactly the fragile,
  misattribution-prone matching we avoid. **Verdict:** possible later
  phase with strict corroboration; not the foundation.

### 4. LinkedIn-derived commercial data ✖ not now

- The scraping route is legally dead: **Proxycurl was shut down July 2025
  after a LinkedIn/Microsoft lawsuit.** Survivors that claim compliance
  (Coresignal, People Data Labs, Bright Data) are paid, per-record
  enrichment services.
- Richest job-title data anywhere, but: cost, ToS/legal diligence burden,
  and name-based matching. **Verdict:** revisit only if PECOS-based
  signals prove insufficient — and budget for it.

### 5. ABMS board certification ✖ skip

- New board certification = career milestone, but data access is a paid
  product routed through credentialing platforms (Axuall, symplr, etc.),
  minimum query packages, credentialing-use oriented. Not built for
  prospecting; poor fit for a prototype.

### 6. Doximity ✖ skip

- No official third-party API; only ToS-gray scrapers. Not worth the risk
  for a signal we can get from CMS legitimately.

### Bonus finding: CMS "All Owners" facility-ownership files

data.cms.gov also publishes **real ownership records** (owner names, roles)
— but only for *facilities*: Hospitals, Home Health Agencies, Hospices,
Skilled Nursing Facilities, Rural Health Clinics, FQHCs (all probed, all
free APIs, refreshed monthly). There is **no group-practice owners file**,
so ordinary practice ownership still comes from the state business
registry. Value here: a physician appearing as a facility owner is a
*premium* wealth signal (already-affluent tier) — worth a later phase.

Clarity on what each source proves:

| Question | Source | Evidence type |
|---|---|---|
| Who employs them / job changes? | PECOS reassignment | Direct (career) |
| Bill under their own entity? | PECOS group-name match | Inference (ownership corroboration) |
| Legally own a practice entity? | State business registry (IL SoS) | Direct (ownership) |
| Own a hospital/facility? | CMS All Owners | Direct (premium, rare) |

## Comparison

| Source | Cost | Key | Join | Freshness | Signal quality | Verdict |
|---|---|---|---|---|---|---|
| CMS PECOS/affiliations | Free | none | **NPI** | monthly | High (employer names) | **Build now** |
| NPPES change files | Free | none | NPI | weekly | Medium (addresses) | Later |
| GDELT news | Free | none | name-in-text | real-time | Spotty | Maybe later |
| Coresignal / PDL / Bright Data | $$$ | account | name | varies | Rich titles | If needed |
| ABMS | $$$ | contract | name/ID | on-demand | Narrow | Skip |
| Doximity | n/a | none | — | — | — | Skip |

## Implementation sketch (next iteration)

1. `app/adapters/pecos/` — `PECOSDataSource` hitting the reassignment +
   facility-affiliation APIs **by our prospects' NPIs** (same targeted
   pattern as the IDFPR license join).
2. New table `affiliation_snapshots` (npi, group_pac_id, group_name,
   facility_ids, captured_at) — the diff baseline.
3. Detector: snapshot diff → CAREER_ADVANCEMENT signals ("Joined
   Northwestern Medical Group, 1 month ago"), plus OWNERSHIP corroboration
   when the group name matches the physician's own entity.
4. First run seeds the baseline (no events yet); real events accrue from
   the second monthly snapshot on. For demo continuity, current-state
   facts ("affiliated with 2 hospitals") can signal immediately.

## Sources

- [CMS Provider Data Catalog — Facility Affiliation](https://data.cms.gov/provider-data/dataset/27ea-46a8)
- [CMS Revalidation Clinic Group Practice Reassignment](https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/revalidation-clinic-group-practice-reassignment)
- [Medicare FFS Public Provider Enrollment (NBER overview)](https://www.nber.org/research/data/medicare-fee-service-public-provider-enrollment-data)
- [CMS NPPES Data Dissemination](https://www.cms.gov/medicare/regulations-guidance/administrative-simplification/data-dissemination)
- [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
- [Proxycurl shutdown & alternatives](https://brightdata.com/blog/web-data/proxycurl-alternatives)
- [ABMS certification data access](https://www.abms.org/abms-board-certification-data/)
