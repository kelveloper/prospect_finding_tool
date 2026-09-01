# Presenting the Platform — Emerging Affluent Prospecting

**Audience:** wealth-management / banking advisors and the internal product
stakeholders who would own this.
**Purpose of this document:** everything you need to *present* the current
build — what it does today, what is proven versus inferred, how an advisor
would actually use it, and the exact math behind every number on screen.

**The one-sentence pitch:**

> We find people in public data who are *becoming* wealthy — not people who
> already are — rank them by a transparent, auditable score, and hand an
> advisor a short list with the evidence and the first letter attached.

**Status as of 2026-08-27:** working end-to-end prototype, **running entirely
on live data**. Four free government APIs, a deterministic scoring engine,
full explainability down to the gate that admitted each fact, a four-screen
advisor UI, and a deterministic contact kit. **60 automated tests, all
passing.** No mock adapters remain in the codebase — they were deleted on
2026-08-23.

---

## Table of contents

1. [The thesis you're selling](#1-the-thesis-youre-selling)
2. [How the app works](#2-how-the-app-works)
3. [The four data sources — all live](#3-the-four-data-sources--all-live)
4. [The ranking formula](#4-the-ranking-formula)
5. [Data structures — what is persisted](#5-data-structures--what-is-persisted)
6. [What a real run actually produces](#6-what-a-real-run-actually-produces)
7. [Why it's trustworthy: gates, identity, traceability](#7-why-its-trustworthy-gates-identity-traceability)
8. [The advisor experience — four screens](#8-the-advisor-experience--four-screens)
9. [The contact kit — from score to first touch](#9-the-contact-kit--from-score-to-first-touch)
10. [How it fits internal products](#10-how-it-fits-internal-products)
11. [The live demo script](#11-the-live-demo-script)
12. [Proof points and numbers to quote](#12-proof-points-and-numbers-to-quote)
13. [Anticipated questions and answers](#13-anticipated-questions-and-answers)
14. [The roadmap: data, AI, production](#14-the-roadmap-data-ai-production)
15. [Appendix: file map for technical audiences](#15-appendix-file-map-for-technical-audiences)

---

## 1. The thesis you're selling

Advisors compete hardest for clients who are *already* wealthy — by which
point those clients already have an advisor. The opportunity is one step
earlier.

```
Career Signal          →  Ownership Signal      →  Financial Event       →  Emerging Affluent
(licensed physician,      (bills under their       (buys property,           Candidate
 high-earning specialty)   own practice entity)     takes on a mortgage)
```

A physician who was licensed 8 months ago, started billing Medicare under
their own PLLC 5 months ago, and bought a $985k home 2 months ago is
*visibly* in the middle of that chain — and almost certainly does not have a
wealth advisor yet.

Every part of that chain is observable in **public records**. The product's
job is to detect the chain, score it, rank it, and explain it.

**Why physicians first:** physician data is the cleanest structured public
data available in the U.S. — a national provider registry, state licensing
boards, and a federal Medicare enrollment database that names who each
physician bills under. Lawyers, dentists, and other licensed professions are
the same pattern with a different adapter.

**Frame this for the room:** this is not a lead list you buy. It's a
*repeatable pipeline* — new sources plug in, the scoring engine doesn't
change, and every number is explainable to a compliance officer.

---

## 2. How the app works

### 2.1 The engine in one line

```
sources → three gate layers → signals → strength × weight → 60/40 blend
        → score history → contact kit
```

**Gates reject; scoring weighs.** This is the single most useful sentence in
the whole system, and the UI is now built around it.

Everything before the scoreboard is a **gate** — binary, about *trust*, each
decision auditable. Everything from the scoreboard on is **continuous** —
about *value*. Nothing is ever rejected after gating; by then a prospect can
only be worth more or less.

| Gate layer | Where it lives | The question it answers |
|---|---|---|
| **1. Entry** | inside each adapter | *Are you even eligible?* Physician taxonomy (code starts `20`), target state, individual (not business) license, deed ≥ $100k and ≤ 36 months old, PECOS `Reassignment` rows only |
| **2. Identity** | `resolver.py` + `enrichment.py` | *Do these records belong to the same person?* License-number match = 1.0; name tiers must reach ≥ 0.80 to merge. Enrichment attaches on exact NPI, or exact first + last name + state — else it is dropped |
| **3. Derivation** | `detector.py` | *What is this fact allowed to claim?* Own-name-in-entity for OWNERSHIP; snapshot diff for a career move; strength ≥ 0.3 to appear in the narrated summary |

Two consequences worth saying out loud:

- **A fact that fails any gate doesn't exist downstream.** A failed IDFPR
  merge isn't a penalty — it's a missing row, and license recency scores
  0 / 40 because there is no license date, not because we docked anyone.
- **A match score opens a door; it never adds a point.** Identity confidence
  is reported *beside* the score, never multiplied into it. The score says
  how good the prospect is; confidence says how sure we are it's the right
  person.

### 2.2 The system in one picture

```
Data Sources — all live, free, no API keys
   ├─ NPI Registry (NPPES)      ─ who they are, specialty, NPI date, license #
   ├─ IL licensing (IDFPR)      ─ license issue date, ACTIVE status
   ├─ CMS PECOS                 ─ billing group + facility affiliations
   └─ Cook County Assessor      ─ deed transfers with buyer names & prices
        │
        ▼
1. INGEST & NORMALIZE   every adapter emits one of two record shapes
        ▼
2. RESOLVE IDENTITY     dedupe + merge; "John Smith MD" ≡ "John A Smith MD"
        ▼
3. ATTACH ENRICHMENT    billing entities / deeds / career events bind to a
                        person, on exact NPI or exact-name-and-state only
        ▼
4. DETECT SIGNALS       six signal types, each with a strength and a confidence
        ▼
5. SCORE                Qualification (60%) + Timing (40%)
        ▼
6. EXPLAIN              plain-English summary, generated deterministically
        ▼
7. PERSIST              prospects + signals + match evidence + score history
        ▼
   Ranking API  →  Advisor UI  →  Contact kit  →  Feedback back into the DB
```

### 2.3 What actually happens when you press the button

Everything above is triggered by a single call — `POST /ingest/run`. The
sources are chained, not parallel: each one is queried *using the output of
the one before it*, so we only ever pull data about physicians we already
have.

| Step | What it does | Where |
|---|---|---|
| **1. NPPES** | Pull physicians by state and specialty (8 specialty sweeps by default). Non-physician taxonomies and out-of-state records are dropped at the adapter | `app/adapters/npi/live.py` |
| **2. IDFPR** | Take the license numbers NPPES returned, normalize them (`036.057912` → `036057912`), and query the Illinois open-data portal *by those numbers*. Verifies exactly the physicians we found | `app/adapters/idfpr/live.py` |
| **3. PECOS** | Query CMS by NPI for billing-group reassignments and facility affiliations. Diff against the stored snapshot → career events; detect self-named billing groups → ownership inference | `app/services/pecos_sync.py` |
| **4. Cook County** | Query the Assessor's parcel-sales dataset *by buyer name* for the physicians we now hold, within the 36-month decay window and above a $100k price floor | `app/adapters/cook_county/live.py` |
| **5. Resolve** | Records describing the same human are clustered. Tier 1: identical license number → confidence 1.0. Tier 2: deterministic name + state rules → 0.85–0.95. Merge threshold 0.80 | `app/identity/resolver.py` |
| **6. Attach** | A billing entity, a deed, or a career event attaches only on exact NPI or exact normalized first + last name in the same state. Near-misses are rejected on purpose | `app/identity/enrichment.py` |
| **7. Detect** | The merged profile becomes signals: `PHYSICIAN`, `SPECIALTY`, `NEW_LICENSE`, `OWNERSHIP`, `PROPERTY_EVENT`, `CAREER_ADVANCEMENT` — each with a strength (0–1) and a confidence (0–1) | `app/scoring/detector.py` |
| **8. Score** | Signals become points; points become the two sub-scores and the total | `app/scoring/engine.py` |
| **9. Explain** | A summary sentence is assembled from signals at strength ≥ 0.3 — template-based, no LLM, so the same input always yields the same words | `app/scoring/reasons.py` |
| **10. Persist** | Prospect row + signals + identity-match evidence + a new score-history snapshot | `app/services/pipeline.py` |

**Re-running is idempotent.** An existing prospect (matched by NPI, else by
name + state) is updated in place with fresh signals and a fresh score, not
duplicated. Score history *appends* — so what changes across nightly runs is
scores, not row counts, and movement becomes visible.

### 2.4 The API surface today

| Method | Endpoint | What an advisor product would use it for |
|---|---|---|
| `POST` | `/ingest/run?state=IL&limit=25` | Refresh the prospect pool. `limit` is per specialty, max 200 |
| `GET` | `/prospects/ranked?limit=50` | The lead list — highest score first, with `score_change` since the previous run |
| `GET` | `/prospects/{id}` | Full dossier: scores, per-component breakdown, every signal, identity match evidence, practice address |
| `GET` | `/prospects/{id}/contact-kit` | Mail address, practice phone, the primary trigger, and a trigger-matched letter draft |
| `POST` | `/feedback` | Advisor verdict: `good_fit` \| `revisit_later` \| `not_fit`, plus notes |
| `GET` | `/prospects/{id}/feedback` | Verdict history for that prospect |
| `GET` | `/health` | Liveness |

Interactive docs ship with it at `/docs`.

> **Note the absent parameter.** There is no `mode=sample`. Sample mode and
> every fixture adapter were removed on 2026-08-23. If it's on the screen, it
> came from a government API.

### 2.5 The deliberate design constraints

State these out loud — they are the reason a bank could adopt this.

- **Deterministic.** No LLM, no ML model, no vector database anywhere in the
  scoring path. Same data in → same score out, every time.
- **Traceable.** Every point on a score maps to a stored signal row; every
  signal maps to a source record; every identity merge and every attach
  stores its score and a human-readable reason.
- **Tunable without code changes.** The 60/40 weights and the merge threshold
  are environment settings, not constants buried in logic.
- **Targeted, not scraped.** Every source after NPPES is queried *by key* —
  license number, NPI, buyer name — so we never bulk-download data about
  people we aren't already tracking.
- **Extensible.** A new data source is a new adapter class emitting one of two
  record shapes. The identity resolver and scoring engine do not change.
- **Clean architecture.** HTTP handlers contain no business logic — services
  do. That is what lets the same engine sit behind a batch job, a CRM
  integration, or a different UI.

---

## 3. The four data sources — all live

| Source | What it contributes | Access | Signals it feeds |
|---|---|---|---|
| **NPPES NPI Registry** (CMS) | Identity, specialty, NPI enumeration date, state license number, practice address and phone | Free public API, no key | `PHYSICIAN`, `SPECIALTY`, `NEW_LICENSE` (npi) |
| **IDFPR** via data.illinois.gov (Socrata) | Original license issue date, license status, city/zip — 1.2M+ Illinois licenses | Free open data, no key | `PHYSICIAN`, `NEW_LICENSE` (idfpr) |
| **CMS PECOS** — group reassignment + facility affiliation | Who each physician bills under, and which facilities they're affiliated with | Free public API, no key | `OWNERSHIP` (inference), `CAREER_ADVANCEMENT` |
| **Cook County Assessor — Parcel Sales** (Socrata) | Real deed transfers **with buyer names**, prices, and dates | Free open data, no key | `PROPERTY_EVENT` |

**Total cost of the current data foundation: zero.**

### 3.1 How the records connect (the join map)

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

| Connection | Key | Rule | Certainty |
|---|---|---|---|
| NPPES ↔ IDFPR | **state license number**, normalized | exact match = 1.0 merge; else name + state tiers ≥ 0.80 | strongest — a shared government ID |
| NPPES ↔ PECOS | **NPI** | exact NPI = attach; no NPI = no attach | zero name-match risk |
| NPPES ↔ Cook County | **buyer name** "FIRST LAST" + state IL | exact normalized first + last + state = 0.9 attach; anything less is dropped | weakest link — mitigated by the $100k floor and drop-don't-guess matching |
| PECOS ↔ itself over time | **NPI** | current pull diffed against `affiliation_snapshots` → `career_events` | exact |

### 3.2 The two clever bits worth calling out

**Ownership without a business registry.** Illinois sells Secretary-of-State
data by phone contract; there is no free machine-readable feed. So ownership
is *inferred* from Medicare: if a physician bills under a group whose legal
name contains their own surname — *"Beth Adams Medical Services PLLC"* — they
almost certainly own it. The inference is scored lower than a registry record
would be (strength 0.8 instead of 0.9, confidence 0.7 instead of 0.85), and
it is labeled in the UI as an inference, not a filing.

**Career moves from snapshot diffing.** PECOS has no "start date" field. So
every sync stores the physician's current billing groups and facility
affiliations, and the *next* sync diffs against it. A new group that wasn't
there last month is a job change, with a real detection date that survives
re-ingests. This is why career advancement cannot fire on a first run — and
why the honest ceiling on day one is 91, not 100 (see §4.5).

---

## 4. The ranking formula

> The single source of truth for scoring detail is
> [`docs/RANKING.md`](RANKING.md). This section is the
> presentation-ready version of it.

### 4.1 Two questions, one number

| Score | The question it answers | Weight |
|---|---|---|
| **Qualification** (0–100) | *Should we care about this person?* | **60%** |
| **Timing** (0–100) | *Why now?* | **40%** |

```
TOTAL = (Qualification × 0.60) + (Timing × 0.40)
```

**Why 60/40:** a great prospect at an okay moment is still a great prospect;
a mediocre prospect at a perfect moment is still mediocre. Both weights are
environment variables (`QUALIFICATION_WEIGHT`, `TIMING_WEIGHT`) — a business
owner can retune them without an engineering ticket.

### 4.2 Qualification — "should we care?" (100 points)

| Component | Max points | How strength (0–1) is decided |
|---|---:|---|
| **Physician standing** | 40 | Active IDFPR-verified license = 1.0 · NPI only, license unverified = 0.7 · license present but not active = 0.5 |
| **Specialty earning tier** | 35 | Orthopedic / neurological / plastic surgery = 1.0 · cardiovascular disease = 0.95 · dermatology, gastroenterology = 0.9 · anesthesiology, radiology = 0.85 · urology = 0.8 · oncology = 0.75 · emergency medicine = 0.6 · internal medicine = 0.45 · family medicine, pediatrics, unknown = 0.4 |
| **Practice ownership** | 25 | Bills under own PLLC / PC / SC = 0.8 · own generic LLC = 0.55 · × 0.6 if the entity is inactive · none found = 0 |

`points = max_points × strength`

The first two components say *high earner*. The third says *business owner,
not employee* — the point in the hypothesis where wealth starts compounding.

> Ownership tops out at 0.8, never 1.0, because today's evidence is a billing
> inference rather than a registry filing. When the paid registry source lands
> (§14), that ceiling lifts to 0.9. **The scoring engine already handles both.**

### 4.3 Timing — "why now?" (100 points)

Timing is entirely about recency. Every date-driven component runs through
one shared decay curve:

| Event happened | ≤ 6 mo | ≤ 12 mo | ≤ 24 mo | ≤ 36 mo | older |
|---|---:|---:|---:|---:|---:|
| **Strength** | 1.0 | 0.85 | 0.6 | 0.3 | 0.1 |

Components, in career chronology:

| Component | Max points | The date that drives it |
|---|---:|---|
| **Practice entry** (NPI enumeration) | 15 | NPPES enumeration date |
| **License recency** | 40 | IDFPR original license issue date |
| **Property purchase** | 30 | Deed transfer date |
| **Career advancement** | 15 | Detection date of a new billing group or facility, × 0.8 role weight |

**Why licenses dominate timing:** a new license is the cleanest public marker
of "this person's physician income starts now." Licensed 8 months ago →
40 × 0.85 = 34 points. Licensed in 2018 → 40 × 0.1 = 4 points.

### 4.4 Worked example — the full chain

**A physician firing every available signal — 87.7.** Put this on a slide as
the *shape* of a perfect prospect, and be explicit that it's a constructed
example, not a name from the board.

```
QUALIFICATION                              TIMING
Physician standing  40 × 1.0  = 40.0       NPI entry (7 mo ago)   15 × 0.85 = 12.8
Ortho surgery       35 × 1.0  = 35.0       License (8 mo ago)     40 × 0.85 = 34.0
Own PLLC (billing)  25 × 0.8  = 20.0       Property (2 mo ago)    30 × 1.00 = 30.0
                              -------      Career advancement     15 × 0    =  0.0
                                 95.0                                       -------
                                                                               76.8

TOTAL = 95.0 × 0.60 + 76.8 × 0.40 = 57.0 + 30.7 = 87.7
```

**A low-signal contrast — 27.6.** Same formula, no chain.

```
QUALIFICATION                              TIMING
Physician (unverified) 40 × 0.7 = 28.0     License date: none     40 × 0    =  0.0
Pediatrics             35 × 0.4 = 14.0     Property: none         30 × 0    =  0.0
Ownership: none        25 × 0   =  0.0     NPI entry (2017)       15 × 0.1  =  1.5
                                -------    Career (old, minor)    15 × 0.15 ≈  2.3
                                  42.0                                      -------
                                                                              ~6.0

TOTAL = 42.0 × 0.60 + 6.0 × 0.40 ≈ 27.6
```

**The point to land:** identical math, a 60-point spread. The spread *is* the
product — it's what turns a registry of 194 physicians into a call list of
five.

### 4.5 The day-one ceiling is 91, and that's a feature

Someone will ask what a 100 looks like. The honest answer is the strongest
thing in this document.

> **"Scores are out of 100, but 91 is the day-one maximum. Points above 91
> can only be earned by monitoring a prospect over time."**

The best possible first-run prospect — newly licensed tier-1 specialist,
billing under their own PLLC, just bought property — reaches **91**. The
missing 9 points are two kinds of honest headroom:

- **6 points of career advancement** can only be *earned over time*. The first
  PECOS sync seeds a baseline; events come from diffing later syncs. A single
  snapshot can never prove "they just changed jobs."
- **3 points of ownership** need registry-grade proof beyond a billing
  inference, which caps at 0.8 strength.

So a score above 91 certifies longitudinal evidence: *we watched this person
move.* That is a far better story than a system that hands out 100s on day one.

### 4.6 Tiers shown in the UI

| Score | Tier label |
|---|---|
| 80–100 | Top Prospect |
| 60–79 | Promising Prospect |
| 50–59 | Neutral Prospect |
| 35–49 | Weak Prospect |
| < 35 | Poor Fit |

### 4.7 Four rules that keep the score honest

- **Strongest signal per component wins** — duplicate records never
  double-count.
- **Zero rows stay visible.** The dossier shows "Career advancement: 0 / 15 —
  no move detected yet." That doubles as *what would raise this score*.
- **No signal → no points.** The system never guesses or imputes.
- **Deterministic and reproducible.** Re-run it a year from now on the same
  snapshot and you get the same number.

---

## 5. Data structures — what is persisted

Seven tables. The first four are the product; the last three are what make it
a *monitoring* system rather than a one-shot report.

| Table | One row per | Why it exists |
|---|---|---|
| **`prospects`** | resolved human | Identity, professional record, contact details, current scores, reason summary, identity confidence |
| **`signals`** | detected fact | The evidence behind every point: type, source, description, strength, confidence, event date |
| **`identity_matches`** | merge or attach | The audit trail for *why we believe two records are the same person* — source pair, record ids, score, human-readable reason |
| **`feedback`** | advisor verdict | `good_fit` / `revisit_later` / `not_fit` plus notes. Full history kept, not just the latest |
| **`score_history`** | prospect per ingest | The score trajectory. The prospect row holds the *current* score; this holds the movement. Exposed as `score_change` on the ranked board |
| **`affiliation_snapshots`** | PECOS group/facility link | Point-in-time state of who a physician bills under. The baseline that career-move detection diffs against |
| **`career_events`** | detected career move | A new billing group or facility, with its detection date — persisted so the event keeps its date across re-ingests and decays correctly |

### 5.1 In-flight structures (not persisted, but fully built)

| Structure | Role |
|---|---|
| `RawProviderRecord` | The universal shape every *person* source normalizes into. Adding a state board means producing this shape — nothing downstream changes |
| `EnrichmentRecord` | The universal shape for an *event about* a person (entity, deed, career move). Explicitly does **not** establish identity — it only enriches someone already resolved |
| `ResolvedProspect` | One deduplicated person: merged field values, the source records behind them, the match evidence, and attached enrichments |
| `MatchEvidence` | A scored, reasoned link between two records — what gets written to `identity_matches` |
| `DetectedSignal` | A signal before persistence: type, source, description, strength, confidence, event date |
| `ScoreBreakdown` / component list | The two sub-scores and total; and the per-component contribution list the UI renders as bars |

### 5.2 The six signal types — all six live

| Signal | Meaning | Source | Confidence |
|---|---|---|---|
| `PHYSICIAN` | Licensed physician; active license strengthens it | NPPES + IDFPR | 0.95 corroborated / 0.75 single-source |
| `SPECIALTY` | How lucrative the specialty is | NPPES | 0.95 / 0.75 |
| `NEW_LICENSE` | How recently licensed / entered practice | IDFPR (0.95) + NPPES (0.9) | 0.9–0.95 |
| `OWNERSHIP` | Bills Medicare under a self-named practice entity | CMS PECOS | 0.7 — labeled as inference |
| `PROPERTY_EVENT` | Bought property ≥ $100k in the last 36 months | Cook County deeds | 0.8 |
| `CAREER_ADVANCEMENT` | New billing group or facility affiliation | CMS PECOS snapshot diff | 0.9 |

---

## 6. What a real run actually produces

**This is the slide that earns credibility. Do not blur it.** These are the
figures from a completed live Illinois run (`prospects_live.db`, 2026-08-25),
at the default `limit=25` per specialty across 8 specialties.

### 6.1 Coverage

| Metric | Value |
|---|---:|
| Physicians resolved | **194** |
| Joined to IDFPR by license number | **130 matches**, giving **121 prospects at identity confidence 1.0** |
| Single-source (NPPES only, confidence 0.6) | **73** — the ~38% gap |
| Licenses verified **ACTIVE** against the state board | **108** |
| Other statuses caught | 8 not renewed · 3 suspended · 1 probation · 1 inactive |
| PECOS affiliations captured | **673** across the cohort |
| Ownership inferences (self-named billing entity) | **7** |
| Real property purchases matched | **8**, $672,500 – $2,450,000 |
| Career events on first run | **0** — by design; the baseline was seeded |

### 6.2 Score distribution

| Band | Count |
|---|---:|
| 60–79 (Promising) | 3 |
| 50–59 (Neutral) | 12 |
| 35–49 (Weak) | 138 |
| < 35 (Poor Fit) | 41 |

Range **22.6 – 61.6**, mean **39.1**. Nobody in this cohort scored above 62.

### 6.3 Three caveats to state before anyone finds them

Presenting these *first* is worth more than the numbers themselves.

1. **Nothing scored above 62, and that is expected.** Missing data, not
   missing logic. Full registry ownership awaits a paid source, and career
   events accrue from the second sync onward. The pipeline is correct; the
   inputs are one purchase order away from complete.
2. **The cohort is an alphabetical slice, not the top of Illinois.** With
   `limit=25` per specialty, NPPES returns its first page — 193 of the 194
   surnames start with "A". This is a demo cap, not a ranking result. NPPES
   pages to ~1,200 per query; lifting the cap is a parameter change, and it is
   on the list.
3. **Ownership here is inference, and property matching is name-based.** Seven
   ownership signals come from Medicare billing patterns, not filings. Eight
   deeds matched on exact name + state within Cook County. Both are labeled as
   such in the UI, and both have a documented paid upgrade path.

### 6.4 What the live signals actually look like

Real rows from that run, worth showing on screen:

```
OWNERSHIP   Beth Ann Adams (57.1)  "Bills Medicare under own entity
                                    'Beth Adams Medical Services PLLC'"     0.80
OWNERSHIP   Otis George Allen (47.2) "…'Otis Allen MD SC'"                  0.80
OWNERSHIP   Tahir A Abbasi (47.6)  "…'Parikh & Abbasi MDSC'"                0.80

PROPERTY    Jamal Ahmad (54.4)     $1,600,000, 15 months ago                0.60
PROPERTY    Yazan Alghalith (52.3) $1,890,000, 13 months ago                0.60
PROPERTY    James M Abraham (45.8) $672,500, 10 months ago                  0.85
PROPERTY    Smita Aggarwal (48.7)  $2,450,000, 26 months ago                0.30
```

Smita Aggarwal is the persuasive one: a **$2.45M purchase** that scores lower
than a **$672k** purchase, because hers was 26 months ago and his was 10. That
single comparison proves the timing dimension is doing real work — and that
the system is not just a rich-list filter.

### 6.5 ⚠️ A word about the local database file

The repository ships two SQLite files, and the demo depends on which one you
point at:

- **`prospects_live.db`** — the completed 194-physician live run described
  above. This is what you want for a presentation.
- **`prospects.db`** — the default path, currently holding **9 rows of
  pre-2026-08-23 sample data** (John A Smith, "Smith Orthopedics PLLC", source
  `il_sos`). Those adapters no longer exist in the codebase; this file is a
  leftover artefact and the code can no longer reproduce it.

**Do not demo from `prospects.db` as-is.** Either point at the live file:

```bash
DATABASE_URL=sqlite:///./prospects_live.db .venv/bin/uvicorn app.main:app --port 8000
```

…or delete it and run a fresh live ingest (§11).

---

## 7. Why it's trustworthy: gates, identity, traceability

A wrong match is worse than a missed one. Attaching someone else's practice
or someone else's house to a prospect corrupts the score *and* embarrasses
the advisor in front of a stranger. So the system uses two different
strictness levels on purpose.

**Person records (NPPES ↔ IDFPR)** — these describe the same *kind* of thing,
so they *merge*, tiered by evidence quality:

1. Exact license-number join → score 1.0. Perfect evidence.
2. Same last name + state, first names equal ignoring middle initials → 0.95.
   ("John Smith MD" ≡ "John A Smith MD".)
3. First initial + same specialty + same state → 0.85.
4. Merge threshold: 0.80. Below that, they stay two people.

Records that share a *typed* license number but differ are treated as
different people, not merged optimistically.

**Enrichment records (billing entities, deeds, career events)** — these would
corrupt a dossier if mis-attached, so they *attach or drop*, never merge and
never fuzzy-match:

- **NPI-keyed (PECOS):** exact NPI = 1.0 attach. A different NPI = 0.0. There
  is no name-matching risk at all on this join.
- **Name-keyed (Cook County):** exact normalized first + last name in the same
  state = 0.9 attach. Near-miss traps ("Jonathan Smithfield" vs. "John
  Smith") are rejected, and there are tests that exist solely to prove those
  rejections still happen.

**A miss is acceptable. A false match is not.**

**Identity confidence** rides along on the prospect and is shown *beside* the
score, never folded into it: a single-source person carries 0.6, a
corroborated one carries 1.0. The UI says "Identity verified across NPI + IL
License" or "Single-source identity — not yet corroborated." The advisor is
never misled about how solid the person is.

**Everything is written down.** Every merge and every attach writes a row to
`identity_matches` with a score and a human-readable reason — *"license
number match"*, *"NPI match"*, *"exact first and last name, same state"*. In
the live run those reasons break down as 130 license-number matches, 8
name+state attaches, and 7 NPI attaches. Any claim on any dossier can be
walked back to the records that produced it.

---

## 8. The advisor experience — four screens

**Screen 1 — The Scoreboard (`/`)**

The ranked lead list, highest fit first. A featured panel holds the selected
prospect: score ring, tier badge, qualification and timing sub-scores, license
tenure, the plain-English summary, and signal tags. Every other candidate sits
in the list beside it, one click to feature.

Each card carries **signal-coverage chips** by category — Profession,
Ownership, Financial — showing *how many of the available signals we
actually captured*, not just on/off. A card reading "Profession 3/4 ·
Ownership 0/1 · Financial 0/1" tells an advisor at a glance what this
prospect is missing.

*The advisor's takeaway:* "Here are my next five calls, in order."

**Screen 2 — The Candidate Dossier (`/prospect/{id}`)**

One card per dimension of evidence:

- **Career Signal** — license status and issue date, license tenure,
  specialty, NPI enumeration date, recent advancement, raw NPI and license
  numbers.
- **Ownership & Practice** — the detected entity, what it was inferred from,
  and signal strength; plus practice address and phone.
- **Financial Activity** — property purchase: address, price, date, source,
  strength.
- **Contact Kit** — mail address, practice phone, the primary trigger, and the
  letter draft behind a Copy button (§9).
- **Score Breakdown** — the 60/40 math, with each group expandable to show
  every tier in the rulebook and which one this prospect landed on.

Cards with no evidence say **"None on record"** rather than hiding. An empty
card is information too — it is simultaneously the reason the score is low and
the list of what would raise it.

*The advisor's takeaway:* "I know why this person is on my list, and I have a
conversation opener."

**Screen 3 — Sources (`/prospect/{id}/sources`)**

The explainability screen, laid out **in pipeline order** with two tabs:

- **Gates** — all three gate layers, labeled, with this prospect's own
  verdicts. Gate 2 renders as four side-by-side columns: the three scored
  connection ladders (NPPES ↔ IDFPR, ↔ PECOS, ↔ Cook County), each showing
  which tier fired and then 🔓 *gate cleared — IDFPR data unlocked* or 🔒 *gate
  not cleared — NPPES stands alone*; plus a fourth column for the *unscored*
  join, PECOS ↔ itself over time, which explains why the career signal can
  never fire on a first ingest. Gate 3 shows what each fact was *allowed to
  claim* — including refusals, e.g. *"Claim refused — bills through a group
  not bearing their name → 0.00 × 25 = 0"* — with a note on the layering:
  Gate 2 attached the billing data, Gate 3 rejected the claim. Below it, the
  identity confidence (the weakest link among this prospect's merges) and the
  full audit trail: every recorded decision, its reason, and its score.
- **Scoring** — every component with its complete rulebook: all five recency
  bands, all nine specialty tiers, every ownership tier, with the row this
  prospect matched highlighted. Clicking a group on the dossier's breakdown
  card deep-links straight into it.

*The advisor's takeaway:* "Nothing here is a black box — I can see what was
admitted, what was refused, and what each fact was worth."

**Screen 4 — Review & Feedback (inline on the profile)**

Every supporting signal with strength and confidence bars, the "Why This
Prospect Ranked Here" stat strip, then the verdict: **Good Fit / Revisit
Later / Not a Fit**, plus free-text notes. History is shown inline.

*The advisor's takeaway:* "My judgment goes back into the system."

### 8.1 The loop that makes it a product, not a report

```
Public data  →  Ranked list  →  Advisor reviews  →  Verdict captured
     ↑                                                     │
     └──────────  weight calibration (future phase)  ◄──────┘
```

The feedback table exists precisely so hand-set weights can eventually be
calibrated against real advisor judgment. **Be precise when presenting:** the
labeled dataset is being *built* today; no learning happens yet, and that was
a deliberate scope decision, not an unfinished feature.

---

## 9. The contact kit — from score to first touch

`GET /prospects/{id}/contact-kit` closes the loop between "here's a ranked
list" and "here's what you send." Everything in it is built from data already
stored, and it is as deterministic as the score.

| Element | What it contains |
|---|---|
| **Mail channel** | Practice street address, city, state, zip from NPPES, with a `complete` flag |
| **Phone channel** | Practice landline from NPPES, labeled as a business line |
| **Primary trigger** | The strongest signal to write around: OWNERSHIP → CAREER_ADVANCEMENT → NEW_LICENSE, most recent first |
| **Letter draft** | Salutation + body, chosen by trigger, with `[bracketed]` placeholders the advisor must fill in |
| **Urgency** | `elevated` when a property purchase exists, otherwise `standard` |
| **Rules** | Explicit outreach guardrails shown alongside the draft |

**The rule that will get the most nods in the room:**

> **`PROPERTY_EVENT` has no letter template — deliberately.** A property
> purchase raises urgency and is never written about. Referencing someone's
> home purchase in a cold letter reads as surveillance. The kit says so
> explicitly: *"Never reference the property purchase — it is a timing signal
> only."*

The other rules it emits: *send to the practice address, never a home
address*, and *the phone is a practice landline — expect a gatekeeper, never
call personal numbers.*

There are four letter templates — ownership (congratulatory, tax and
entity-structure angle), career move (retirement-plan decisions on a
deadline), new license (disability coverage, loans, first contract), and a
generic fallback. **No LLM.** Same signals in, same letter out, auditable like
the score. Direct mail is v1 because it is the top research-ranked channel and
the only one fully powered by data we already capture; an email draft joins
when an email source is ingested.

---

## 10. How it fits internal products

The backend is a clean API with no UI dependency, so the same engine serves
very different surfaces.

**1. A prospecting queue inside the existing advisor workstation.**
`GET /prospects/ranked` becomes a "Suggested Prospects" panel next to the
advisor's book of business. The dossier becomes a slide-over. The verdict
buttons write to `POST /feedback`. No new application for advisors to learn.

**2. CRM enrichment and lead routing.** Push scored prospects into Salesforce
/ Dynamics as leads with the score, tier, and reason summary as fields.
Routing rules assign by geography or specialty. The reason summary is already
plain English — it drops straight into a CRM note field, and the contact kit
drops straight into an outreach task.

**3. A scheduled market-opportunity feed.** Run ingestion nightly or monthly
per state or metro. Because re-ingestion is idempotent and score history
appends, what changes is *scores*, not row counts — so "prospects that crossed
80 this week" is a trivial query against `score_history` and a natural email
digest for regional leadership. This is also the mode in which career
advancement signals start firing.

**4. Book-of-business gap analysis.** Reverse the lens: run the pipeline over
a market, then subtract existing clients. What remains is quantified
addressable opportunity by territory — a planning tool for management rather
than a call list for advisors.

**5. A compliance-reviewable evidence service.** Because every score
decomposes into stored signals and every identity link stores its reason, the
dossier and breakdown endpoints can serve as the audit record behind any
outreach decision. That is the integration that makes the rest of them
approvable.

### 10.1 What integration would actually require

| Need | Why |
|---|---|
| Authentication and role-based access | Not built — explicitly out of V1 scope |
| Audit logging on reads | Who looked at which prospect, and when |
| Compliance review of the outreach use case | Public data is public, but *use* is what gets reviewed |
| Scheduled ingestion with rate limiting and backoff | Today ingestion is manual and single-shot |
| PostgreSQL with real Alembic migrations | Today: SQLite convenience and auto-created tables |
| Data retention and suppression policy | Do-not-contact handling, refresh cadence, deletion |

None of these are research problems. They are known, scoped engineering work.

---

## 11. The live demo script

**Setup — do this before the room is watching.** A live ingest calls four
external APIs and is not instant; it is not a thing to run cold in front of
stakeholders.

```bash
# Terminal 1 — backend on :8000, pointed at the completed live run
DATABASE_URL=sqlite:///./prospects_live.db .venv/bin/uvicorn app.main:app --port 8000

# Terminal 2 — frontend on :3000
cd frontend && npm run dev
```

To demo a genuinely fresh pull instead, delete the default database first and
let the scoreboard trigger ingestion on load, or call it directly:

```bash
rm -f prospects.db
curl -X POST "localhost:8000/ingest/run?state=IL&limit=25"
```

Verify before you present:

```bash
curl localhost:8000/health                  # {"status":"ok"}
.venv/bin/python -m pytest tests/ -q        # expect: 60 passed
```

Open **http://localhost:3000**.

**The eight-minute run:**

| # | Do this | Say this |
|---|---|---|
| 1 | Land on the scoreboard | "194 Illinois physicians, ranked. Every one of them a real, licensed human pulled from federal and state registries this week. This is an advisor's morning." |
| 2 | Point at the featured panel and the coverage chips | "Score ring, tier, and how much of the available evidence we actually captured — three of four profession signals, zero of one on ownership. That's not a gap in the data model, that's what we know about *this person*." |
| 3 | Open a prospect with ownership — **Beth Ann Adams (57.1)** | "She bills Medicare under 'Beth Adams Medical Services PLLC'. We didn't buy that from anyone — we inferred it from a federal billing file, because the entity carries her own name." |
| 4 | Open a prospect with property — **Jamal Ahmad (54.4)** | "A $1.6M deed from the Cook County recorder, matched to him by exact name and state. Real address, real price, real date." |
| 5 | Go to **Score & Match Breakdown → Gates** | "Before anything is scored, it has to get through three gates. Entry: are you eligible. Identity: are these the same person. Derivation: what is this fact allowed to claim. Here's this prospect's own verdicts — including the refusals." |
| 6 | Switch to the **Scoring** tab | "Now, and only now, we weigh. Every component, every tier in the rulebook, and the row this person landed on. Nothing is a black box." |
| 7 | Open the **Contact Kit** on the dossier | "The strongest trigger becomes a letter — to the practice address, congratulating the practice launch. Note what it *doesn't* say: it never mentions the house. Property raises urgency; we never write about it." |
| 8 | Open **Review & Feedback**, cast a verdict | "The advisor's judgment goes back in as a labeled row — which is how these weights eventually get calibrated against real outcomes." |
| 9 | Compare **Smita Aggarwal ($2.45M, 26 mo)** with **James Abraham ($672k, 10 mo)** | "Her purchase was nearly four times his, and she scores lower on that component. This is not a rich list. It's a *timing* engine." |
| 10 | If the room is technical | Show `/docs`, or run the ingest live: `curl -X POST "localhost:8000/ingest/run?state=IL&limit=25"` |

**The single most persuasive moment** is step 9. Everyone assumes the product
is "find people with money." The $2.45M purchase scoring *below* the $672k
purchase is what proves it's actually "find people at the moment money starts
moving."

---

## 12. Proof points and numbers to quote

- **60 automated tests, all passing** — across identity resolution, scoring
  bounds and monotonicity, configurable weights, deterministic reason
  summaries, ranked-order API behavior, idempotent re-ingestion, the
  feedback round-trip, near-miss ownership rejections, the contact kit, and
  all four live adapters stubbed at the source boundary.
- **194 real Illinois physicians** resolved in one run; **130** joined to the
  state licensing board by license number; **108 verified as actively
  licensed**.
- **100% license-number capture** on that NPPES pull — which is what makes the
  license-number join viable as the primary matching tier.
- **673 Medicare affiliations** captured across the cohort, yielding **7
  ownership inferences** on first pull.
- **8 real property purchases** matched, $672,500 – $2,450,000, from a free
  county dataset that publishes buyer names.
- **Four live external APIs, all free, none requiring a key** — the current
  data foundation costs **$0**.
- **Zero LLM calls, zero ML models** anywhere in the scoring path.
- **A ~60-point spread** between the strongest and weakest profile, from
  identical math.
- **91 is the day-one ceiling** — a designed limit that certifies anything
  above it as longitudinal evidence.
- **Under $1,000 for month one** to close the two biggest data gaps (§14).

---

## 13. Anticipated questions and answers

**"Is this legal?"**
Every source is a public government record — a federal provider registry, a
state licensing board, a federal Medicare enrolment file, county deeds. What
requires review is not the *data* but the *use*: outreach, retention, and
suppression policy. That review is explicitly listed as required before any
advisor uses this for real contact.

**"Where does the AI come in?"**
Not in the score, and that's the point. The scoring is arithmetic over
detected facts — every number reproducible and explainable to a compliance
officer without hand-waving. AI is planned in two fenced places (§14.2): an
ambiguous-name match *assistant* that proposes and never disposes, and a
natural-language narrative in the UI written over the deterministic
breakdown. Never inside scoring, never as the sole basis of a match.

**"Who set those weights? Are they right?"**
They're informed starting points, not gospel — which is exactly why they're
configuration rather than code, and exactly why advisor verdicts are being
captured from day one. The honest answer: they're a hypothesis, and the
feedback loop is the instrument for testing it.

**"Why does nobody score above 62?"**
Missing data, not missing logic. Full registry ownership records await a paid
source, and career-move events accrue from the second monthly PECOS snapshot
onward. A physician firing every signal scores 87.7 today. The ceiling on the
board rises the moment either input lands — no code change required.

**"You said ownership is inferred. How confident are you?"**
Confident enough to score it at 0.8 rather than 0.9, and to label it in the UI
as a billing inference rather than a filing. The logic is narrow: the
physician bills Medicare under a group whose legal name contains their own
surname. The upgrade path is priced and documented — Cobalt Intelligence at
roughly $100–400 one-time for this cohort — and its first job would be
validating the 7 inferences we already have.

**"Why are all the names at the top of the alphabet?"**
Because the demo pull is capped at 25 per specialty and NPPES returns its
first page. It's a cap, not a ranking artefact. NPPES pages to roughly 1,200
per query; lifting it is a parameter, and it's on the list.

**"What about the 38% who didn't match the license board?"**
They're still in the system, scored on NPPES evidence alone, flagged at
identity confidence 0.6, and shown as "single-source — not yet corroborated."
They score lower because license recency is worth 40 timing points and we
don't have their license date — not because we penalized them. A name+state
fallback tier for that gap is the next matching change.

**"How many prospects could this actually produce?"**
Illinois physicians alone are a five-figure population before enrichment
filtering. The constraint today is a demo cap, not the source.

**"Why only Illinois? Why only physicians?"**
Because one state and one profession was enough to prove the pipeline, and
proving the pipeline was the goal. Another state is another licensing adapter
— NPPES, PECOS, and the scoring engine are already national. Another
profession is another registry.

**"What if the score is wrong about someone?"**
Then the advisor marks *Not a Fit*, that verdict is stored with notes, and it
becomes evidence for recalibration. The system is designed to be corrected,
which is a very different posture from a black-box lead list.

---

## 14. The roadmap: data, AI, production

### 14.1 Buy the data (the highest-value work, and it's cheap)

The pipeline is ahead of its inputs. Priorities and real prices, from
[`docs/RESEARCH_COMMERCIAL_SOURCES.md`](RESEARCH_COMMERCIAL_SOURCES.md):

| # | Buy | Why first | Rough cost |
|---|---|---|---|
| **1** | **Cobalt Intelligence** (business entities) | Completes ownership with legal filings and formation dates; validates the 7 PECOS inferences we already have; 20 free lookups to pilot | **~$100–400** one-time for this cohort |
| **2** | **ATTOM** (property, nationwide) | Activates the 30 timing points beyond Cook County — the "financial event" step | ~$500+/mo, quote |
| **3** | **People Data Labs** (job titles) | Cheap experiment for career-title lift | $98/mo |
| **4** | **Definitive Healthcare** (procedure volumes) | Claims-based earning proxy — a genuinely unique wealth signal | $30–50K/yr |

**Pilot math: priorities 1–3 come in under $1,000 for month one** on the
current cohort. That is the line to put in front of whoever holds the budget.

### 14.2 Where AI is planned — and where it is fenced out

The scoring pipeline stays deterministic; that's its credibility. AI gets
added *around* it, in two places, with guardrails:

1. **Match assistant.** An LLM reviews only the *ambiguous middle* of identity
   matching — pairs scoring roughly 0.5–0.8 that rules alone can't settle
   (nicknames "Bill"/"William", hyphenated and maiden names) — and returns a
   rationale. **Guardrail: the LLM proposes, rules and humans dispose.**
   Nothing auto-attaches on LLM judgment; recommendations are logged beside
   the rule-based score.
2. **Advisor-facing narrative.** An LLM writes the natural-language summary in
   the UI, grounded strictly in the deterministic breakdown, with the
   template-based summary remaining underneath as the auditable source of
   truth and fallback.

**Not planned: AI in scoring, in ranking, or as the sole basis of any match.**

### 14.3 Matching and coverage

- Name+state fallback tier for the ~38% of physicians whose NPPES license
  number didn't join IDFPR.
- Ownership match hardening — address cross-check and
  specialty-in-entity-name corroboration, needed *before* real registry data
  is trusted.
- Scale the live pull beyond 25 per specialty.
- Premium wealth tier: CMS "All Owners" facility-ownership files — a physician
  who owns a hospital, home-health agency, or skilled-nursing facility.

### 14.4 Production

- Scheduled monthly ingestion — which is also what makes career events fire
  and score history meaningful.
- PostgreSQL with real Alembic migrations and connection pooling. *(Today the
  prototype auto-creates tables at startup, so a schema change means deleting
  the local database file.)*
- Authentication, authorization, and read audit logging.
- Monitoring on source availability and match rates.
- Feedback-informed weight calibration — verdicts are already captured in a
  retraining-ready shape; nothing learns from them yet, by design.
- Additional professions and states.

**Running alongside all of it:** compliance review of the outreach use case,
plus a data retention and suppression policy. That work gates deployment, not
development — start it early.

> Say this plainly when presenting: the scope was *ruthlessly* constrained on
> purpose. The biggest risk in a product like this is building a large data
> estate before proving the ranking hypothesis produces a useful list. Prove
> ranking first. Then buy data.

---

## 15. Appendix: file map for technical audiences

```
app/
├── adapters/        one folder per data source — all live
│   ├── npi/live.py          NPPES registry API
│   ├── idfpr/live.py        data.illinois.gov license dataset
│   ├── cook_county/live.py  Assessor parcel-sales deeds
│   ├── pecos/client.py      CMS reassignment + facility affiliation
│   └── base.py              RawProviderRecord · EnrichmentRecord contracts
├── identity/        resolver.py (person merging) · enrichment.py (strict attach)
├── scoring/         detector.py (signals) · engine.py (math) · reasons.py (summaries)
├── outreach/        service.py (contact kit) · templates.py (letter drafts)
├── services/        pipeline.py (ingestion) · pecos_sync.py (snapshot diff) · ranking.py
├── repositories/    data access
├── models/          7 SQLAlchemy tables
├── schemas/         Pydantic request/response contracts
├── api/routes.py    HTTP endpoints — no business logic
└── config.py        weights and thresholds (environment-overridable)

frontend/            ProspectIQ UI (Next.js 16 · React 19 · Tailwind v4)
├── src/app/                 scoreboard · dossier · sources
├── src/components/          SourcesDocument, MatchEvidencePanel,
│                            OutreachActions, ContactKitCard, ScoreRing, …
└── src/lib/api.ts           the API client and backend→UI mapping

tests/               60 tests across identity, scoring, reasons, all four
                     live adapters, the API, ownership rejections, contact kit
```

**Where to change the things people ask about:**

| What | File |
|---|---|
| Component point values | `app/scoring/engine.py` (`QUAL_WEIGHTS`, `TIMING_WEIGHTS`) |
| Specialty tiers, recency decay curve | `app/scoring/detector.py` (`SPECIALTY_TIERS`, `recency_strength`) |
| The 60/40 top-level weights, merge threshold | `app/config.py` (environment-overridable) |
| Plain-English summary templates | `app/scoring/reasons.py` |
| Outreach letter templates and rules | `app/outreach/templates.py`, `app/outreach/service.py` |
| Match thresholds and rules | `app/identity/resolver.py`, `app/identity/enrichment.py` |
| Which specialties get swept | `app/adapters/npi/live.py` (`DEFAULT_SPECIALTIES`) |
| Property price floor and lookback | `app/adapters/cook_county/live.py` |
| Tier labels shown in the UI | `frontend/src/lib/api.ts` (`tierFromScore`) |
| The rulebook shown in the scoring section | `frontend/src/components/SourcesDocument.tsx` (`RULEBOOK`) |

**To retune and see it move:** edit a tier or weight → `pytest tests/ -q` →
re-run ingestion → reload the board. The ranking reorders in front of you.

---

## Companion documents

| Document | What it's for |
|---|---|
| [`README.md`](README.md) | Setup, API reference, architecture overview |
| [`QUICKSTART.md`](../QUICKSTART.md) | Running it in ~3 minutes (note the Python 3.13 requirement) |
| [`docs/RANKING.md`](RANKING.md) | The single source of truth for scoring math |
| [`docs/HOW_IT_WORKS.md`](HOW_IT_WORKS.md) | Pipeline mechanics and the demo-day FAQ |
| [`docs/PRESENTING_SIGNALS.md`](PRESENTING_SIGNALS.md) | How to talk about signals without tangling the three layers |
| [`docs/DATA_SOURCES.md`](DATA_SOURCES.md) | Every source, its fields, and the join map |
| [`docs/USER_JOURNEY.md`](USER_JOURNEY.md) | Demo script and quick setup |
| [`docs/PROGRESS.md`](PROGRESS.md) | Done / not done / the AI roadmap |
| [`docs/RESEARCH_COMMERCIAL_SOURCES.md`](RESEARCH_COMMERCIAL_SOURCES.md) | Paid vendors, buy order, "why we pay" |
| [`docs/RESEARCH_CAREER_SIGNAL.md`](RESEARCH_CAREER_SIGNAL.md) · [`docs/RESEARCH_PROPERTY_SIGNAL.md`](RESEARCH_PROPERTY_SIGNAL.md) · [`docs/RESEARCH_CONTACT_OUTREACH.md`](RESEARCH_CONTACT_OUTREACH.md) | How those sources and channels were chosen |
| [`docs/PROJECT_SPEC.md`](PROJECT_SPEC.md) | The original build specification |
| [`HANDOVER.md`](HANDOVER.md) | Engineering handover / code analysis |
