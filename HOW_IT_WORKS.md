# How It Works — Backend Mechanics

The pipeline's mental model. Companions: `USER_JOURNEY.md` (demo + setup) ·
`RANKING.md` (scoring math) · `PROGRESS.md` (status) · `PROJECT_SPEC.md` (full spec)

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
              ├─ Cook County deeds ........ property buys (PROPERTY_EVENT)[LIVE or mock]
              ├─ Affiliations feed ........ promotions (CAREER_ADVANCEMENT)[mock]
              └─ CMS PECOS ................ billing groups & facilities  [LIVE or mock]
                                            → career moves (snapshot diff)
                                            → OWNERSHIP inference (self-named group)
              (registry ownership records — formation dates, officers —
               have no free API; paid integration planned, see
               RESEARCH_COMMERCIAL_SOURCES.md)

2. RESOLVE    Identity resolution dedupes and merges person records:
              ├─ Tier 1: same license number → same person (score 1.0)
              └─ Tier 2: name+state rules ("John Smith MD" = "John A Smith MD", 0.95)

3. ATTACH     Enrichment records (entities, deeds, promotions) attach to a
              prospect ONLY on exact first+last name + state. Near-misses
              are rejected. Every attach is stored with a score + reason.

4. DETECT     The merged profile becomes signals, each 0–1 strength:
              PHYSICIAN, SPECIALTY, NEW_LICENSE, OWNERSHIP,
              PROPERTY_EVENT, CAREER_ADVANCEMENT

5. SCORE      Qualification (60%) + Timing (40%) → total  (math: RANKING.md)

6. EXPLAIN    A plain-English reason summary is generated from the signals
              (deterministic templates — no LLM in scoring; a grounded
              LLM-written narrative for the UI is planned, see PROGRESS.md)

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

## FAQ (likely showcase questions)

**Q: What is PECOS, and how does it give you ownership data?**
PECOS is Medicare's enrollment database — before any physician can bill
Medicare, they must declare which legal entity receives their payments
("reassignment of benefits"). It is an *employment/billing* record, not an
ownership record. The ownership trick: **if the entity a physician bills
under is named after them** ("Beth Adams Medical Services PLLC"), they
almost certainly own it — nobody routes their Medicare income through a
stranger's company bearing their name. We emit that as an OWNERSHIP
*inference*: slightly weaker strength (0.8 vs 0.9) and lower confidence
(0.7 vs 0.85) than a registry record, and the description says so
("name-matched billing group"). The *legal proof* of ownership remains the
state business registry (who formed the entity, and when); PECOS adds
behavioral proof (the entity is active and economically theirs). Two
independent government systems agreeing is the strongest ownership claim
public data supports. Bonus: PECOS is NPI-keyed (zero name-matching risk),
and monthly snapshot diffs catch the moment a physician switches from
billing under a hospital to a self-named entity — "just went independent,"
an ownership signal and career event at once.

**Q: Do the datasets share an ID, or are you guessing by name?**
NPI ↔ IDFPR join on the *state license number* (NPPES records carry it —
100% of our live pull). PECOS joins on *NPI*. Only the business registry
and county deeds have no shared ID — there, matching is exact
name + state, conservatively, with near-misses rejected and every attach
logged with a reason.

**Q: Why is the ranking deterministic — where's the AI?**
The score must be auditable: same data in, same score out, every point
traceable to a source record. AI is planned where it's strong and fenced
out of where it's dangerous: an LLM match-assistant for ambiguous name
cases (proposes; rules + human dispose) and a grounded LLM-written
narrative in the UI — never inside scoring or as the sole basis of a
match. See PROGRESS.md.

**Q: Why don't most live prospects score above ~62?**
Missing data, not missing logic: full registry ownership records (25 qual
pts) await the paid business-registry source, and career-move events
accrue from the second monthly PECOS snapshot. The mock showcase
demonstrates the full-signal ceiling (Smith at 87.7).

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
