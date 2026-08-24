# Progress

Status as of 2026-08-23. Spec: `PROJECT_SPEC.md` · Mechanics:
`HOW_IT_WORKS.md` · Ranking: `RANKING.md` · Data-source research:
`RESEARCH_COMMERCIAL_SOURCES.md` (+ career/property deep-dives)

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
- [x] **Career — CMS PECOS reassignment + facility affiliations (LIVE,
      2026-08-21)** — NPI-keyed sync with snapshot diffing: career events
      (new billing group / new facility) accrue from the second monthly
      snapshot; ownership *inference* fires immediately when a physician
      bills under a self-named entity (real IL run: 673 affiliations across
      144 physicians, 7 ownership inferences on first pull)
- [~] Ownership — live via PECOS billing-group inference (7 real owners);
      **the mock IL SoS registry adapter was removed 2026-08-23** — the
      sample showcase now earns ownership through the same PECOS-style
      mechanism live mode uses, so every demo signal mirrors an obtainable
      source. Registry records (formation dates, officers, non-medical
      entities): **no free machine-readable source exists** (IL SoS
      prohibits bulk access; data sold by phone contract). Ready-to-execute
      paid plan + "why we pay" comparison in
      `RESEARCH_COMMERCIAL_SOURCES.md`: Cobalt trial (person-name search;
      20 free lookups validate the 7 PECOS-known entities), then
      `ILSoSLiveDataSource` (~$100–400 one-time).
      (A free Chicago city-license source was also trialed and removed —
      name collisions made it net-negative.)
- [x] **Property — Cook County Assessor Parcel Sales (LIVE, 2026-08-23)** —
      free Socrata API *with buyer names*; targeted name queries over the
      36-month decay window, price floor, dedupe by deed doc. First live IL
      run: 8 real physician purchases matched ($672K–$2.45M). Limits: Cook
      County only, name+state join — paid upgrade path (ATTOM/BatchData)
      documented in `RESEARCH_PROPERTY_SIGNAL.md`
- [ ] Premium wealth tier — CMS "All Owners" facility-ownership files (physician owns a hospital/HHA/SNF)

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

## 🤖 Where AI will help (planned, agreed 2026-08-21)

The scoring pipeline stays deterministic — that's its credibility. AI gets
added around it, in two places, with guardrails:

1. **Match assistant (identity resolution)** — an LLM reviews only the
   *ambiguous middle* of matching: pairs scoring ~0.5–0.8 that rules alone
   can't settle (nicknames "Bill"/"William", hyphenated/maiden names,
   entity names without a first name). It outputs a recommendation + written
   rationale. **Guardrail: LLM proposes, rules + human dispose** — nothing
   auto-attaches on LLM judgment alone; recommendations are logged next to
   the deterministic match evidence.

2. **Advisor-facing summary (UI)** — an LLM writes the natural-language
   prospect narrative shown on the dossier/follow-up pages, generated
   strictly from the stored signals and scores (grounded — the model is
   never asked to "know" anything). The deterministic template summary
   remains underneath as the auditable source of truth and fallback.

Not planned: AI in scoring, ranking, or as the sole basis for any match.

## How the ranking works

```
total = qualification × 0.60 + timing × 0.40
```

Full explanation — component weights, decay curve, worked high/low
examples, and how to tune it — lives in **`RANKING.md`** (the single
source of truth for ranking).
