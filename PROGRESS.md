# Progress & Ranking System

Status as of 2026-08-19. Spec: `PROJECT_SPEC.md` · Mechanics: `HOW_IT_WORKS.md`

## ✅ Completed

**Pipeline & backend**
- [x] Full ingestion pipeline: fetch → resolve → attach → detect → score → explain → persist
- [x] Adapter architecture (`BaseDataSource`) — new sources plug in without touching scoring
- [x] Identity resolution, tiered: license-number join (1.0) → deterministic name+state rules (0.85–0.95); every merge stored with score + reason in `identity_matches`
- [x] Enrichment matching (entities/deeds/promotions → prospects), strict exact-name+state; near-miss traps rejected and tested
- [x] All 6 signal types detected: PHYSICIAN, SPECIALTY, NEW_LICENSE, OWNERSHIP, PROPERTY_EVENT, CAREER_ADVANCEMENT
- [x] Scoring engine with configurable weights (env settings)
- [x] Deterministic plain-English reason summaries (no LLM)
- [x] Feedback capture (`good_fit` / `revisit_later` / `not_fit` + notes + history)
- [x] Practice address + phone capture
- [x] 40 passing tests, Docker + Alembic scaffolding

**Live data (real external APIs, both free, no keys)**
- [x] NPPES NPI Registry — real physicians by specialty/state, physician-only taxonomy filtering, license-number capture (100% on IL pull)
- [x] IDFPR via data.illinois.gov — real license verification queried by license number; live IL run: 194 physicians, 120 license joins, 107 verified ACTIVE

**Frontend (ProspectIQ, Next.js)**
- [x] Ranked scoreboard with featured prospect, tiers, tags, auto-ingest
- [x] Candidate dossier: Career Signal / Ownership / Financial Activity cards (with "None on record" states), Identity Resolution, Score Breakdown, Practice Location, Detected Signals
- [x] Review & Feedback page: signal evidence with strength/confidence bars, live verdict buttons + history

## 🚧 Not completed (next phases)

**Data sources (mock → real)**
- [ ] Ownership — real IL Secretary of State / OpenCorporates integration (mock `il_sos` now)
- [ ] Property — real Cook County recorder / open-data integration; verify buyer-name availability (mock `cook_county` now)
- [ ] Career — real source research; best free lead: NPPES change files (mock `affiliations` now)

**Matching & coverage**
- [ ] Name+state fallback for the ~38% of live physicians whose NPPES license number didn't join IDFPR
- [ ] Ownership match hardening: address cross-check, specialty-in-entity-name corroboration (needed before real entity data)
- [ ] Scale live pull beyond 25/specialty (NPPES pages to ~1,200 per query)

**Product & platform**
- [ ] Live-mode toggle in the UI (today: sample by default, live via API param)
- [ ] Feedback-informed weight calibration (data is being captured; no learning yet)
- [ ] Real Alembic migrations (prototype uses create_all; schema changes need `rm prospects.db`)
- [ ] Lawyers and other professions (future phase per spec)
- [ ] Out of V1 scope by design: auth, compliance workflows, outreach generation, CRM

## How the ranking system works

Two questions, two scores, one weighted total.

### Qualification (0–100) — "Should we care about this person?"

| Component | Max pts | How strength is set |
|---|---|---|
| Physician standing | 40 | active verified license = 1.0 · unverified = 0.7 · inactive = 0.5 |
| Specialty tier | 35 | ortho/neuro/plastic 1.0 · cardio .95 · derm/gastro .9 · anesth .85 · family med/peds 0.4 |
| Practice ownership | 25 | active PLLC/PC 0.9 · generic LLC 0.6 (from business registry) |

### Timing (0–100) — "Why now?"

All recency uses one decay curve: **≤6mo 1.0 · ≤12mo 0.85 · ≤24mo 0.6 · ≤36mo 0.3 · older 0.1**

| Component | Max pts | Driven by |
|---|---|---|
| License recency | 40 | IDFPR original issue date |
| Property purchase | 30 | deed transfer date |
| NPI enumeration | 15 | when they entered practice |
| Career advancement | 15 | recency × role seniority (partner/director 1.0, attending 0.8, other 0.5) |

### Total

```
total = qualification × 0.60 + timing × 0.40     ← weights are env settings
```

Each component takes the **strongest** signal of its type, so duplicate
records never double-count. Every point traces to a stored signal row, and
the reason summary states the evidence in plain English.

### Worked example — Dr. John Smith (89.2, #1 on the showcase board)

```
Qualification: 40 (active license) + 35 (ortho, tier 1.0) + 22.5 (PLLC, 0.9×25) = 97.5
Timing:        34 (licensed 8mo, .85×40) + 30 ($985k property 2mo ago, 1.0×30)
             + 12.75 (enumerated 7mo, .85×15)                                   = 76.8
Total:         97.5 × 0.6  +  76.8 × 0.4                                        = 89.2
```
