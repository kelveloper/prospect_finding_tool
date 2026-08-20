# How It Works — Backend Mechanics

The pipeline's mental model. Companions: `USER_JOURNEY.md` (demo + setup) ·
`PROGRESS.md` (status + ranking math) · `PROJECT_SPEC.md` (full spec)

## The hypothesis

> Someone showing **career signals** (licensed physician, high-earning
> specialty) who then shows **ownership** (forms their own practice) and a
> **financial event** (buys property) is becoming wealthy — reach them
> *before* they're rich, when they don't have an advisor yet.

The system finds those people in public data and ranks them.

## The flow (what happens on POST /ingest/run)

```
1. FETCH      Each data-source adapter returns normalized records
              ├─ NPI registry ............. who they are, specialty      [LIVE or mock]
              ├─ IL licensing (IDFPR) ..... license date, active status  [LIVE or mock]
              ├─ IL business registry ..... their PLLC/LLC   (OWNERSHIP) [mock]
              ├─ County deeds ............. property buys (PROPERTY_EVENT)[mock]
              └─ Affiliations feed ........ promotions (CAREER_ADVANCEMENT)[mock]

2. RESOLVE    Identity resolution dedupes and merges person records:
              ├─ Tier 1: same license number → same person (score 1.0)
              └─ Tier 2: name+state rules ("John Smith MD" = "John A Smith MD", 0.95)

3. ATTACH     Enrichment records (entities, deeds, promotions) attach to a
              prospect ONLY on exact first+last name + state. Near-misses
              are rejected. Every attach is stored with a score + reason.

4. DETECT     The merged profile becomes signals, each 0–1 strength:
              PHYSICIAN, SPECIALTY, NEW_LICENSE, OWNERSHIP,
              PROPERTY_EVENT, CAREER_ADVANCEMENT

5. SCORE      Qualification (60%) + Timing (40%) → total  (math: PROGRESS.md)

6. EXPLAIN    A plain-English reason summary is generated from the signals
              (deterministic templates — no LLM)

7. PERSIST    Prospect + signals + match evidence + scores → database
```

Then: `GET /prospects/ranked` (highest first) · `GET /prospects/{id}`
(dossier) · `POST /feedback` (advisor verdicts, stored for future calibration).

## Identity resolution — why it's trustworthy

Two different problems, two different strictness levels:

**Person records (NPI ↔ IDFPR):** these describe the same kind of thing
(a licensed person), so matching is tiered — exact license-number join
first (perfect evidence), then deterministic name rules: same last name +
state, first names equal ignoring middle initials (0.95), or first-initial
+ same specialty (0.85). Merge threshold 0.80.

**Enrichment records (entities, deeds, promotions):** attaching someone
else's LLC or house to a prospect would corrupt the score, so the bar is
higher — exact normalized first + last name in the same state, or no
attach. A miss is acceptable; a false match is not.

Every merge and attach writes a row to `identity_matches` with the score
and a human-readable reason ("license number match", "exact first and last
name, same state") — so any claim on a dossier can be audited back to the
records that produced it.

## Sample vs live mode

- **Sample (default):** 8 fictional physicians + mock enrichment — the
  full-signal showcase. Deterministic, offline, drives the demo and tests.
- **Live (`?mode=live&state=IL&limit=25`):** real physicians from NPPES,
  really license-verified against IDFPR. Mock enrichment is deliberately
  excluded — a fake property purchase must never appear on a real person.

## Where things live

```
app/adapters/      one folder per data source (sample + live variants)
app/identity/      resolver (person merging) + enrichment matcher
app/scoring/       signal detector, scoring engine, reason summaries
app/services/      ingestion pipeline, ranking service
app/api/routes.py  HTTP endpoints (no business logic)
app/models/        SQLAlchemy tables: prospects, signals, identity_matches, feedback
frontend/          ProspectIQ UI (Next.js) — src/lib/api.ts is the API client
tests/             40 tests: identity, scoring, reasons, adapters, API, ownership proof
```
