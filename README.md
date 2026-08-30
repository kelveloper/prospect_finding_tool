# Emerging Affluent Prospecting Platform

Signal-driven prospect ranking for wealth management. V1 targets **physicians**,
ranked live from **four free government data sources** — the NPI Registry
(NPPES), Illinois licensing (IDFPR), Medicare enrollment (PECOS), and Cook
County property deeds. Deterministic scoring: no LLM, no ML, every point
traceable to a source record. See `docs/PROJECT_SPEC.md` for the original spec.

- **Backend** (repo root): FastAPI + SQLAlchemy — ingestion, identity
  resolution, scoring, ranking, feedback.
- **Frontend** (`frontend/`): Next.js "ProspectIQ" scoreboard wired to the
  backend endpoints — see `frontend/README.md`.

## Docs (read in this order)

1. **This README** — what the platform is and how to run it
2. [`docs/USER_JOURNEY.md`](docs/USER_JOURNEY.md) — setup + the demo script + what to point at on a live board
3. [`docs/RANKING.md`](docs/RANKING.md) — the scoring system, with worked examples
4. [`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md) — pipeline mechanics + demo-day FAQ
5. [`docs/PROGRESS.md`](docs/PROGRESS.md) — what's done, what's pending, the AI roadmap

Everything else is indexed in **[`docs/README.md`](docs/README.md)** — the
presentation deck, the engineering handover, the data-source research, and
the product notes.

```bash
# Terminal 1 — backend
.venv/bin/uvicorn app.main:app --port 8000
# Terminal 2 — frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Pipeline

```
Data Sources (NPPES, IDFPR, PECOS, Cook County — all live, free, no keys)
  → Ingestion & Normalization   app/adapters/
  → Identity Resolution         app/identity/      (license-number join + name rules)
  → Signal Detection            app/scoring/detector.py
  → Scoring                     app/scoring/engine.py   total = qual*0.60 + timing*0.40
  → Reason Summary              app/scoring/reasons.py  (deterministic, no LLM)
  → Prospect Records            PostgreSQL / SQLite
  → Ranking API + Feedback      app/api/
```

## Quick start (local, SQLite — zero setup)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Then:

```bash
curl -X POST localhost:8000/ingest/run        # LIVE ingest: real IL physicians (~30-90s)
curl localhost:8000/prospects/ranked          # ranked lead list
```

Interactive docs: http://localhost:8000/docs

## Quick start (Docker + PostgreSQL)

```bash
docker compose up --build
curl -X POST localhost:8000/ingest/run
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/ingest/run` | Run the live pipeline (default): real physicians from NPPES per scored specialty, licenses verified against IDFPR by license number, PECOS billing groups + career snapshots, Cook County deed matches. `?state=IL&limit=25` tunes the pull. |
| GET | `/prospects/ranked?limit=50` | Ranked leads, highest score first |
| GET | `/prospects/{id}` | Full profile: scores, signals, identity confidence |
| POST | `/feedback` | Advisor verdict: `good_fit` \| `revisit_later` \| `not_fit` |
| GET | `/prospects/{id}/feedback` | Feedback history |

## Scoring model

**Total = Qualification ("should we care?") × 0.60 + Timing ("why now?") × 0.40**,
built entirely from detected signals — every point traceable to a stored
signal and a source record, with a deterministic plain-English reason
summary. Full math, worked examples, and tuning guide: **[`docs/RANKING.md`](docs/RANKING.md)**.

## Enrichment signals (all live)

- **OWNERSHIP** — inferred from PECOS: physicians billing Medicare under a
  self-named entity ("Bradley Ashpole Md Llc"). NPI-keyed, zero
  name-matching risk. Registry-grade records (formation dates, officers)
  have no free API — the priced plan is in `docs/RESEARCH_COMMERCIAL_SOURCES.md`.
- **PROPERTY_EVENT** — Cook County deed transfers with buyer names, prices,
  dates, queried for tracked physicians over the 36-month decay window.
- **CAREER_ADVANCEMENT** — monthly PECOS snapshot diffs: new billing group
  or facility affiliation = a job move, persisted with its detection date.

Enrichment matching is deliberately strict (`app/identity/enrichment.py`):
NPI match where the source carries it, else exact first+last name + state —
near-misses rejected. Every attachment is stored in `identity_matches` with
score and reason, so every claim is auditable.

## Identity resolution

Deterministic rules, no ML — tiered: exact **license-number join** (NPPES
records carry state license numbers; IDFPR keys on them) merges at 1.0;
then name+state rules ("John Smith MD" ≡ "John A Smith MD", 0.95; first
initial + same specialty, 0.85). Merge threshold 0.80 (configurable).
Single-source prospects carry lower identity confidence (0.6) than
corroborated ones, shown as the trust badge in the UI.

## Tests

```bash
.venv/bin/python -m pytest tests/ -q
```

Covers: name normalization, dedup/merge rules, score bounds and monotonicity,
configurable weights, deterministic reason summaries, ranked-order API,
idempotent re-ingestion, and the feedback round-trip.

## Migrations

The app auto-creates tables on startup (prototype convenience). For real
migrations:

```bash
.venv/bin/alembic revision --autogenerate -m "initial schema"
.venv/bin/alembic upgrade head
```

## Adding a data source (future phases)

1. Create `app/adapters/<source>/` subclassing `BaseDataSource`, normalizing
   rows into `RawProviderRecord` (people) or `EnrichmentRecord` (entities,
   deeds, career events).
2. Register it in the live pipeline (`app/api/routes.py`).

The identity resolver and scoring engine do not change. Next planned:
`ILSoSLiveDataSource` via the paid Cobalt registry API (see
`docs/RESEARCH_COMMERCIAL_SOURCES.md`).

## Production-readiness notes (out of V1 scope, by design)

- Schedule ingestion (PECOS refreshes monthly); add rate limiting/backoff
  and retries in adapters.
- Move table creation fully to Alembic; add connection pooling config.
- Add authn/z, audit logging, and compliance review before any outreach use.
- Feedback table is retraining-ready (verdict + timestamp per prospect); a
  future scoring model can calibrate weights against advisor verdicts.
- Planned AI assists (LLM match-assistant, grounded UI narrative) are
  specced in `docs/PROGRESS.md` — never inside scoring.
