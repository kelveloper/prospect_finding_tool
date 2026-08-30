# APFJP — Engineering Handover / Code Analysis

**Emerging Affluent Prospecting Platform** — a signal-driven prospect-ranking
system for wealth management.

> Analysis date: **2026-08-19**. Everything in the "Verified" sections below was
> actually executed on this machine, not inferred from the README.

---

## 1. TL;DR — what this thing is

A wealth-management firm wants to find **physicians who are about to become
wealthy** — not people who already are. The premise (from `PROJECT_SPEC.md`) is a
causal chain:

```
Career Signal  →  Ownership Signal  →  Financial Event  →  Emerging Affluent Candidate
```

The software pulls **public data** about Illinois physicians, figures out which
records refer to the same human being, converts facts into **weighted signals**,
scores each person on two axes, and serves a **ranked lead list** with a
plain-English explanation for every score. An advisor then marks each lead
`good_fit` / `revisit_later` / `not_fit`, and that verdict is stored for future
model calibration.

Two design constraints are load-bearing and deliberately chosen:

- **No LLM, no ML, no AI anywhere.** Identity matching and reason summaries are
  deterministic rules. This is a stated non-functional requirement, not an
  oversight. Same input → byte-identical output, always.
- **Prove ranking works before building a data estate.** The spec explicitly
  forbids sprawling into property records, CRM, outreach, and auth. The scope
  discipline is the point.

It is a **prototype / proof-of-concept**, and a genuinely well-built one: clean
layering, 27 passing tests, no business logic in controllers.

**One important note:** `PROJECT_SPEC.md` lists "Frontend UI" as explicitly *out
of scope*, but a full Next.js frontend exists and is wired to the live API. The
frontend was added later (commit `cbbe5af`), so the spec is stale on that point,
not the code. Same for "Entity registries" — the IL Secretary of State adapter
was added in `2809a13`. **Treat `PROJECT_SPEC.md` as the original brief, not as
current truth.**

---

## 2. Verified status — I ran all of it

| Check | Result |
|---|---|
| `pip install -r requirements.txt` on **Python 3.14** | ❌ **FAILS** — see §9.1 |
| `pip install -r requirements.txt` on **Python 3.13** | ✅ clean |
| `pytest tests/ -q` | ✅ **27 passed in 0.19s** |
| `uvicorn app.main:app` boots, `/health` | ✅ `{"status":"ok"}` |
| `POST /ingest/run` | ✅ 15 records → 9 prospects, 3 enrichments attached |
| `GET /prospects/ranked` | ✅ 9 prospects, correctly ordered |
| `GET /prospects/{id}` | ✅ full dossier w/ 5 signals |
| `POST /feedback` + history | ✅ round-trips |
| Re-running ingestion (idempotency) | ✅ `created=0, updated=9` |
| `npm install` + `npx tsc --noEmit` | ✅ zero type errors |
| `npm run build` | ✅ compiles, 3 routes |
| `npm run dev` → all 3 pages against live API | ✅ 200s, real data rendered |
| Unknown candidate id in UI | ✅ 404 |
| `docker compose config` | ✅ valid |

**The system works end to end today.** The only thing standing between a fresh
clone and a running demo is the Python version (§9.1).

---

## 3. Architecture

### Backend (repo root) — FastAPI + SQLAlchemy

```
Data Sources (5 adapters, JSON samples)
   ↓  app/adapters/*/source.py      normalize → RawProviderRecord | EnrichmentRecord
Identity Resolution
   ↓  app/identity/resolver.py      cluster provider records into one person
   ↓  app/identity/enrichment.py    attach ownership/property/career records
Signal Detection
   ↓  app/scoring/detector.py       facts → DetectedSignal(strength, confidence)
Scoring
   ↓  app/scoring/engine.py         total = qual*0.60 + timing*0.40
Reason Summary
   ↓  app/scoring/reasons.py        deterministic plain English
Persistence
   ↓  app/repositories/             SQLite (default) or PostgreSQL
Ranking API + Feedback
      app/api/routes.py             HTTP only — zero business logic
```

The layering is strict and worth preserving: `routes.py` does nothing but
dependency-inject a session, call a service, and map errors to HTTP codes.

### Frontend (`frontend/`) — Next.js 16 + React 19 + Tailwind v4

Server Components fetch from FastAPI directly; one Client Component
(`FeedbackPanel`) posts from the browser. No state library, no data-fetching
library — just `fetch` with `cache: "no-store"`.

---

## 4. Data model

Four tables (`app/models/entities.py`), all UUID string PKs:

```
Prospect ──┬─< Signal            (what we found, why it counts)
           ├─< IdentityMatch     (audit trail: why we merged these records)
           └─< Feedback          (advisor verdicts, retraining-ready)
```

`Prospect` carries denormalized identity fields (`npi`, `license_number`,
`specialty`, `state`, dates), the three scores, `reason_summary`, and
`identity_confidence`. `npi` is `unique` + indexed; `total_score` is indexed for
the ranking query.

**The `IdentityMatch` table is the interesting one.** Every merge and every
enrichment attachment is persisted with its numeric score and a human-readable
reason (`"exact first name, same last name, same state, same specialty"`). Any
ownership claim the system makes is auditable back to the rule that produced it —
which matters a lot if this ever touches a compliance review.

---

## 5. The pipeline in detail

### 5.1 Adapters — five exist, three are wired

Every source subclasses `BaseDataSource` and yields one of two frozen
dataclasses:

- **`RawProviderRecord`** — *establishes identity*. Who this person is.
- **`EnrichmentRecord`** — *never establishes identity*. Only decorates a person
  who was already resolved from provider data.

That split is the cleanest idea in the codebase. It means a property deed can
never invent a prospect out of thin air.

| Adapter | Kind | Signal | Wired into `/ingest/run`? |
|---|---|---|---|
| `npi` | Provider | PHYSICIAN, SPECIALTY, NEW_LICENSE | ✅ |
| `idfpr` | Provider | PHYSICIAN, SPECIALTY, NEW_LICENSE | ✅ |
| `il_sos` | Enrichment | OWNERSHIP | ✅ |
| `cook_county` | Enrichment | PROPERTY_EVENT | ❌ **built, tested, not wired** |
| `affiliations` | Enrichment | CAREER_ADVANCEMENT | ❌ **built, tested, not wired** |

All five read bundled `sample_data.json`. Each adapter's docstring notes that
swapping to the live source changes only that one file — and that's accurate;
the parsing is isolated.

> ⚠️ The docstring in `app/scoring/detector.py` claims *"All six spec signal
> types are active."* That is true of the **detector**, but two of them never
> fire because their adapters aren't registered in `routes.py`. See §8.

### 5.2 Identity resolution (`app/identity/resolver.py`)

Greedy clustering. NPI records are sorted first so clusters anchor on the richer
identity source. Each incoming record joins the best-scoring existing cluster
above the threshold (**0.80**, configurable), else starts its own.

`match_score(a, b)` — hard gates first, then scoring:

| Condition | Result |
|---|---|
| States differ | `0.0` — "different state" |
| Last names differ (normalized) | `0.0` — "different last name" |
| **Exact first-name match** | `0.95` |
| First-initial match only (`"D"` vs `"David"`) | `0.70` |
| Different first initial / different first name | `0.0` |
| *+ same specialty* | **+0.15** (capped at 1.0) |

Name normalization strips punctuation, lowercases, and drops credential
suffixes (`md do jr sr ii iii iv phd dds dpm`), so `"John A. Smith, MD"` →
`"john a smith"`.

The consequence worth understanding: **`0.70 + 0.15 = 0.85` means a
first-initial record merges *only if the specialty also matches*.** That's the
`D Chen` / `David Chen` case in the sample data, and it's explicitly tested
(`test_first_initial_needs_specialty_to_merge`).

`identity_confidence` = the weakest link in the cluster (`min` of match scores).
A single-source prospect gets a default of **0.6** — no corroboration.

### 5.3 Enrichment matching (`app/identity/enrichment.py`) — deliberately stricter

Attaching a $1.25M house purchase to the wrong doctor is worse than missing it,
so enrichment matching **rejects everything the provider matcher would accept on
a partial name**: exact normalized first + last name, same state, or no attach.
Score is a flat `0.9`. Unmatched records are silently dropped.

The sample data contains purpose-built adversarial near-misses, and they're all
correctly rejected (`tests/test_ownership.py`):

- `"Jonathan Smithfield"` must **not** attach to `"John Smith"` ✅
- `"Gregory Palumbo"` owns `Windy City Landscaping LLC` but is no physician ✅
- A `NY`-state entity for `"John Smith"` must not attach to the IL doctor ✅

### 5.4 Signal detection (`app/scoring/detector.py`)

Six signal types. Every signal carries `strength` (0–1, how much it counts) and
`confidence` (0–1, how sure we are). Confidence is `0.95` for corroborated
multi-source prospects, `0.75` for single-source.

**Recency decay** drives every timing signal:

| Age | Strength |
|---|---|
| ≤ 6 months | 1.0 |
| ≤ 12 months | 0.85 |
| ≤ 24 months | 0.6 |
| ≤ 36 months | 0.3 |
| > 36 months | 0.1 |

**Specialty tiers** (earning potential) run from `1.0` (orthopaedic /
neurological / plastic surgery) down to `0.4` (family medicine, pediatrics),
with an unknown-specialty fallback of `0.4`.

**Ownership strength** = `(0.9 if PLLC/PC/SC else 0.6) × (1.0 if ACTIVE else 0.6)`.
A professional-practice entity scores higher than a generic LLC — encoding "owns
a medical practice" vs "owns a side business."

### 5.5 Scoring (`app/scoring/engine.py`)

Each component contributes `weight × strongest matching signal of that type`.

**Qualification — "should we care?"** (100 pts)

| Signal | Points |
|---|---|
| PHYSICIAN | 40 |
| SPECIALTY | 35 |
| OWNERSHIP | 25 |

**Timing — "why now?"** (100 pts, keyed by *(type, source)*)

| Signal | Points | Status |
|---|---|---|
| NEW_LICENSE (idfpr) | 40 | ✅ active |
| NEW_LICENSE (npi) | 15 | ✅ active |
| PROPERTY_EVENT | 30 | ❌ **dark — adapter unwired** |
| CAREER_ADVANCEMENT | 15 | ❌ **dark — adapter unwired** |

`total = qualification × 0.60 + timing × 0.40`, weights from settings.

**Worked example — John A Smith (verified live output):**

```
qualification = 40×1.0 (active licence)
              + 35×1.0 (orthopaedic surgery, top tier)
              + 25×0.9 (active PLLC)          = 97.5
timing        = 40×0.85 (IL licence, 8 mo)
              + 15×0.85 (NPI, 7 mo)            = 46.8
total         = 97.5×0.60 + 46.75×0.40         = 77.2
```

### 5.6 Reason summaries (`app/scoring/reasons.py`)

Signals with `strength ≥ 0.3`, sorted strongest-first, each rendered as a
sentence, then score-level statements appended. Real generated output:

> Licensed physician with an active state license. Specialty: Orthopaedic
> Surgery (high earning potential). Registered PLLC 'Smith Orthopedics PLLC'
> formed 5 month(s) ago. Illinois license issued 8 month(s) ago. NPI enumerated
> 7 month(s) ago (recently entered professional practice). High qualification
> score.

No LLM. Fully reproducible.

### 5.7 Idempotency

Re-ingestion matches existing prospects by NPI, falling back to name+state, and
overwrites scores/signals in place. Verified: second run reports
`created=0, updated=9`.

---

## 6. API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness |
| `POST` | `/ingest/run` | Run the full pipeline over all registered sources |
| `GET` | `/prospects/ranked?limit=50` | Ranked leads, highest first (1–500) |
| `GET` | `/prospects/{id}` | Full dossier: scores, signals, identity confidence |
| `POST` | `/feedback` | `{prospect_id, verdict, notes?}` → 201 |
| `GET` | `/prospects/{id}/feedback` | Verdict history, newest first |

Interactive docs at `http://localhost:8000/docs`.

`verdict` is a Pydantic `Literal` — an invalid value returns **422**, an unknown
prospect returns **404**. Both are tested.

### Live ranked board (current sample data, 2026-08-19)

```
 1.  77.2  q= 97.5 t= 46.8  John A Smith          Orthopaedic Surgery
 2.  76.1  q= 95.8 t= 46.8  Maria Elena Gonzalez  Cardiovascular Disease
 3.  67.0  q= 75.0 t= 55.0  Robert J Kaplan       Neurological Surgery
 4.  64.9  q= 71.5 t= 55.0  David Chen            Dermatology
 5.  61.0  q= 75.0 t= 40.0  Priya Raman           Plastic Surgery
 6.  43.6  q= 69.0 t=  5.5  Sarah Okafor          Family Medicine
 7.  41.7  q= 59.5 t= 15.0  Anita Desai           Gastroenterology
 8.  36.4  q= 49.8 t= 16.5  Emily Tran            Anesthesiology
 9.  25.8  q= 42.0 t=  1.5  Michael Brooks        Pediatrics
```

This ranking *is* the product thesis, working: the recently-licensed surgeon who
just formed his own PLLC tops the board; the pediatrician enumerated in 2017
sits last.

The 9 people come from 15 provider records — 6 merged NPI+IDFPR pairs, 2
NPI-only (Desai, Brooks), 1 IDFPR-only (Raman).

---

## 7. Frontend ("ProspectIQ")

### Routes

| Route | Content | Calls |
|---|---|---|
| `/` | Scoreboard — featured candidate + ranked sidebar | `GET /prospects/ranked`, then `GET /prospects/{id}` for the featured panel |
| `/candidate/[id]` | Dossier — 4 panels: Career Signal, Identity Resolution, Score Breakdown, Detected Signals | `GET /prospects/{id}` |
| `/candidate/[id]/follow-up` | Assessment + supporting-signal evidence + feedback form | `GET /prospects/{id}`, `GET .../feedback`, `POST /feedback` |

All three are `export const dynamic = "force-dynamic"` — always fresh, never
cached.

### `src/lib/api.ts` is the whole integration

This one file holds every backend type and every backend→UI mapping. It is the
first file to read and the only one to touch if the API changes.

**Self-healing empty state:** `fetchRankedCandidates()` calls
`/prospects/ranked`; if it returns `[]`, it fires `POST /ingest/run` and retries.
A cold clone therefore populates itself on first page load — you never *have* to
curl the ingest endpoint manually.

**Derived UI concepts** (these live only in the frontend, not the backend):

- **Tiers** — `≥80 strong` / `≥60 promising` / `≥50 neutral` / `≥35 weak` / else `poor`
- **Tags** — "Practice Owner" (has OWNERSHIP), "Recently Licensed"
  (NEW_LICENSE ≥ 0.85), "High-Earning Specialty" (SPECIALTY ≥ 0.75), "Identity
  Verified" (confidence ≥ 0.9), "Licence Unverified" (NPI but no licence)
- **Licence tenure** — "8 Months" / "3 Years", computed browser-side

### Two environment variables, and they are not interchangeable

```
API_URL=http://localhost:8000              # server-side fetches (page rendering)
NEXT_PUBLIC_API_URL=http://localhost:8000  # browser fetch (feedback POST only)
```

Set both. In a deployment where the container talks to the API over an internal
hostname but the browser needs a public URL, these correctly diverge.

CORS on the backend is hardcoded to `localhost:3000` / `127.0.0.1:3000`
(`app/main.py`) — **any other frontend origin will fail the feedback POST.**

---

## 8. Current capabilities vs. gaps

### ✅ Works today

- Full pipeline: ingest → resolve → detect → score → explain → persist → rank
- Deterministic identity resolution with a persisted, human-readable audit trail
- The **ownership cross-dataset proof**: a physician resolved from NPI+IDFPR is
  independently located in the IL business registry, with adversarial near-misses
  rejected
- Two-axis explainable scoring with configurable weights
- Feedback capture with full history
- Idempotent re-ingestion
- Three-page UI on live data, including a working feedback form
- SQLite by default (zero setup) or PostgreSQL via `DATABASE_URL`
- 27 tests covering normalization, merge rules, score bounds/monotonicity,
  weight configurability, summary determinism, ranked order, idempotency,
  feedback round-trip, and ownership matching

### ❌ Not built (mostly by design)

- **No authentication, authorization, or audit logging.** Every endpoint is open.
- **No real data.** All five adapters read bundled JSON. No HTTP client, no rate
  limiting, no retry/backoff, no pagination against live APIs.
- **No scheduling.** Ingestion runs only when someone POSTs to `/ingest/run`.
- **No Alembic migration exists.** `alembic/versions/` contains only `.gitkeep`,
  so `alembic upgrade head` is a **no-op**. The schema is created solely by
  `Base.metadata.create_all()` at app startup. To get real migrations you must
  first run `alembic revision --autogenerate`.
- **No filtering, search, or sorting** beyond `limit` on the ranked endpoint.
- **No model retraining** — explicitly out of scope; feedback is captured only.
- **Illinois-only, physicians-only.** `STATE_NAMES` in the frontend maps just
  `IL`; the IDFPR adapter hardcodes `state="IL"`.

### ⚠️ The single biggest functional gap

**45 of 100 timing points are unreachable**, because `cook_county` (30 pts) and
`affiliations` (15 pts) aren't registered in `routes.py`. Consequences:

- Max achievable timing today = **55**, so max total = **82**
- No prospect realistically reaches the frontend's `≥80` "Top Prospect" tier —
  the top candidate scores 77.2 and displays as merely "Promising". **The UI has
  a tier that is nearly impossible to earn.**
- The "Financial Event" step of the core product hypothesis never fires

**I verified the fix works.** Adding the two adapters to the source list
produces all six signal types and a materially better-separated board:

```
 1.  89.2  John A Smith    [NEW_LICENSE,OWNERSHIP,PHYSICIAN,PROPERTY_EVENT,SPECIALTY]
 2.  76.9  David Chen      [NEW_LICENSE,PHYSICIAN,PROPERTY_EVENT,SPECIALTY]
 3.  76.1  Maria Gonzalez  [NEW_LICENSE,OWNERSHIP,PHYSICIAN,SPECIALTY]
 4.  71.8  Robert J Kaplan [CAREER_ADVANCEMENT,NEW_LICENSE,PHYSICIAN,SPECIALTY]
 ...
```

11 enrichment records, 9 attach — the Palumbo LLC and the Smithfield deed are
correctly rejected. Smith clears 80 and finally earns "Top Prospect".

**The one-line change** in [app/api/routes.py:22](app/api/routes.py#L22):

```python
from app.adapters import (
    AffiliationsDataSource, CookCountyDataSource,
    IDFPRDataSource, ILSoSDataSource, NPIDataSource,
)

pipeline = IngestionPipeline(sources=[
    NPIDataSource(), IDFPRDataSource(), ILSoSDataSource(),
    CookCountyDataSource(), AffiliationsDataSource(),   # <-- add these
])
```

⚠️ Doing this **breaks two assertions in `tests/test_api.py`**
(`enrichment_records == 4`, `enrichment_matched == 3` → become `11` and `9`).
Update them in the same commit.

---

## 9. How to run it

### 9.1 ⚠️ Read this first — the Python version blocker

The README says `python3 -m venv .venv`. **On this machine that fails.** `python3`
resolves to **3.14.3**, and the pinned `pydantic==2.10.4` needs `pydantic-core`,
whose PyO3 0.22.6 build refuses anything past 3.13:

```
error: the configured Python interpreter version (3.14) is newer than
       PyO3's maximum supported version (3.13)
ERROR: Failed building wheel for pydantic-core
```

There is no wheel, so pip tries a Rust build and dies. **Use Python 3.13.**
(`/opt/homebrew/bin/python3.13` is already installed here.) The long-term fix is
bumping the pydantic pin.

### 9.2 Backend — local, SQLite, zero setup

```bash
cd /Users/pursuit/Desktop/Project_For_JP/APFJP

/opt/homebrew/bin/python3.13 -m venv .venv     # NOT python3
.venv/bin/pip install -r requirements.txt

.venv/bin/uvicorn app.main:app --reload --port 8000
```

Verify:

```bash
curl localhost:8000/health                 # {"status":"ok"}
curl -X POST localhost:8000/ingest/run     # load + score sample data
curl localhost:8000/prospects/ranked       # ranked lead list
open http://localhost:8000/docs            # interactive API docs
```

Tables auto-create on startup. Data lands in `./prospects.db` (gitignored) —
delete it for a clean slate.

### 9.3 Frontend

```bash
cd frontend
cp .env.local.example .env.local    # optional; defaults to localhost:8000
npm install
npm run dev                         # http://localhost:3000
```

Start the backend **first**. The scoreboard self-ingests if the DB is empty, so
you can go straight to `http://localhost:3000`.

### 9.4 Docker + PostgreSQL

```bash
docker compose up --build
curl -X POST localhost:8000/ingest/run
```

Backend + Postgres 16 only — **there is no frontend service in
`docker-compose.yml`.** Run the frontend on the host against `localhost:8000`.

### 9.5 Tests

```bash
.venv/bin/python -m pytest tests/ -q     # 27 passed
```

Tests use an in-memory SQLite `StaticPool` with a dependency-override fixture —
they never touch `prospects.db`.

### 9.6 Configuration

Env vars or `.env` at the repo root (`app/config.py`):

| Var | Default |
|---|---|
| `DATABASE_URL` | `sqlite:///./prospects.db` |
| `QUALIFICATION_WEIGHT` | `0.60` |
| `TIMING_WEIGHT` | `0.40` |
| `IDENTITY_MATCH_THRESHOLD` | `0.80` |

⚠️ `get_settings()` is `@lru_cache`d and `engine` is created at import time —
**settings changes require a full restart**, not just `--reload`.

---

## 10. Known issues & risks

Ordered roughly by how likely they are to bite you.

1. **Python 3.14 breaks install** (§9.1). Highest-friction issue for anyone
   cloning fresh. Fix: bump the `pydantic` pin, or document 3.13.

2. **Sample data is dated 2026 and scores decay against the real clock.** The
   pipeline uses `date.today()`. I simulated forward:

   | Reference date | Top score | Max timing |
   |---|---|---|
   | 2026-08-19 | 77.2 | 55.0 |
   | 2027-02-01 | 71.7 | 46.8 |
   | 2028-01-01 | 66.9 | 33.0 |
   | 2031-01-01 | 60.7 | 5.5 |

   Rank *order* stays stable (John Smith holds #1 throughout), so the tests keep
   passing — but the board flattens and the timing signal effectively vanishes.
   By 2031 the whole demo looks broken. If this needs a long shelf life, generate
   sample dates relative to `today` instead of hardcoding them.

3. **45 timing points are dark** — the two unwired adapters (§8). Product-level,
   not a bug.

4. **The frontend's "Top Prospect" tier (≥80) is unreachable** in the current
   wiring (max 82, actual max 77.2). Fixed by #3, or by retuning the thresholds.

5. **No migration exists.** `alembic upgrade head` does nothing; the schema comes
   only from `create_all()`. Any production deploy needs a real revision first.

6. **No auth on any endpoint**, including `POST /ingest/run`. Fine for a
   prototype, disqualifying for anything internet-facing — especially given the
   PII involved.

7. **CORS is hardcoded** to `localhost:3000`. Any real deployment must make
   `allow_origins` configurable.

8. **`identity_confidence` ignores enrichment matches.** The resolver computes
   `min(match scores)` *before* `EnrichmentMatcher` appends its `0.9` evidence,
   so John Smith reports `1.0` despite carrying a 0.9 enrichment attachment.
   Defensible (identity ≠ enrichment), but it means the number doesn't mean quite
   what a reader assumes. Worth a comment or a rename.

9. **`_find_existing` falls back to exact `full_name` + state.** If an upstream
   record's middle name appears or disappears between runs, `full_name` changes
   and idempotency silently breaks — you get a duplicate person. Only bites
   prospects with no NPI.

10. **Unmatched enrichment records are dropped silently** — no count, no log.
    `enrichment_records` minus `enrichment_matched` is the only signal that
    anything was discarded. Real data will need visibility here.

11. **Ranked endpoint has no pagination** beyond `limit ≤ 500`, and no filtering
    or sorting. Fine for 9 prospects; not for a real IDFPR bulk export.

12. **Full re-score on every ingest.** The pipeline rebuilds every prospect's
    signals and scores from scratch. Fine at this scale, O(n²) in the resolver's
    clustering loop at real scale.

---

## 11. Where to start reading

If you have 20 minutes, in this order:

1. `PROJECT_SPEC.md` — the original brief and its deliberate constraints
2. `app/adapters/base.py` — the two record types the whole design pivots on
3. `app/services/pipeline.py` — the entire flow in ~130 lines
4. `app/scoring/engine.py` — the scoring math
5. `tests/test_ownership.py` — the clearest statement of what this proves
6. `frontend/src/lib/api.ts` — the whole frontend/backend contract

## 12. Suggested next steps

**To make the demo land better** (hours):
- Wire the two dormant adapters + update the two test assertions (§8)
- Fix the Python pin (§9.1)
- Make sample-data dates relative to `today` (§10.2)

**To make it real** (weeks):
- Replace sample JSON with the live NPPES API + IDFPR bulk exports; add rate
  limiting, backoff, and pagination in the adapters
- Generate an initial Alembic revision; move off `create_all()`
- Add authn/z and audit logging before this touches a real prospect
- Add filtering/pagination to the ranked endpoint
- Compliance and legal review — this is PII-driven prospecting, and the spec
  flags it as out of scope, not as unnecessary

---

## Appendix — running processes from this analysis

I left both servers running:

- Backend: `http://localhost:8000` (log: scratchpad `api.log`)
- Frontend: `http://localhost:3000` (log: scratchpad `fe.log`)

To stop them:

```bash
pkill -f "uvicorn app.main:app"
pkill -f "next dev"
```

Artifacts created during analysis: `.venv/` and `prospects.db` (both gitignored)
and this file. **No source file was modified** — the working tree is otherwise
clean.
