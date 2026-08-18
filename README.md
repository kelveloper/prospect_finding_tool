# Emerging Affluent Prospecting Platform

Signal-driven prospect ranking for wealth management. V1 targets **physicians**
using two public sources — the NPI Registry and Illinois (IDFPR) licensing data —
and proves that a deterministic scoring pipeline can produce a useful ranked lead
list. No LLM, no ML. See `PROJECT_SPEC.md` for the full spec.

- **Backend** (repo root): FastAPI + SQLAlchemy — ingestion, identity
  resolution, scoring, ranking, feedback.
- **Frontend** (`frontend/`): Next.js "ProspectIQ" scoreboard wired to the
  backend endpoints — see `frontend/README.md`.

```bash
# Terminal 1 — backend
.venv/bin/uvicorn app.main:app --port 8000
# Terminal 2 — frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Pipeline

```
Data Sources (NPI, IDFPR)
  → Ingestion & Normalization   app/adapters/
  → Identity Resolution         app/identity/      (deterministic rules)
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
curl -X POST localhost:8000/ingest/run        # load + score sample data
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
| POST | `/ingest/run` | Run the full pipeline over all data sources |
| GET | `/prospects/ranked?limit=50` | Ranked leads, highest score first |
| GET | `/prospects/{id}` | Full profile: scores, signals, identity confidence |
| POST | `/feedback` | Advisor verdict: `good_fit` \| `revisit_later` \| `not_fit` |
| GET | `/prospects/{id}/feedback` | Feedback history |

## Scoring model

- **Qualification (0–100)** — "should we care?": physician standing (55 pts,
  active license = full strength) + specialty earning tier (45 pts, e.g.
  orthopaedic surgery 1.0, family medicine 0.4).
- **Timing (0–100)** — "why now?": license-issue recency (70 pts) + NPI
  enumeration recency (30 pts), on a decay curve (≤6 mo = 1.0 → >36 mo = 0.1).
- **Total** = `qualification × 0.60 + timing × 0.40`. Weights are settings
  (`QUALIFICATION_WEIGHT` / `TIMING_WEIGHT` env vars), not code.

Every score is traceable: signals are persisted per prospect, and the reason
summary is generated deterministically from them.

## Identity resolution

Deterministic rules, no ML. Records cluster when last name + state match and
the first name matches exactly (middle initials ignored — "John Smith MD" ≡
"John A Smith MD", score 0.95) or by first initial + same specialty (0.85).
Merge threshold: 0.80 (configurable). Every merge is stored in
`identity_matches` with its score and reason. Single-source prospects carry a
lower identity confidence (0.6) than corroborated ones.

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

1. Create `app/adapters/<source>/source.py` subclassing `BaseDataSource`,
   normalizing rows into `RawProviderRecord`.
2. Register it in the pipeline (`app/api/routes.py`).
3. Optionally activate a reserved signal type (`OWNERSHIP`, `PROPERTY_EVENT`,
   `CAREER_ADVANCEMENT`) in `app/scoring/detector.py`.

The identity resolver and scoring engine do not change.

## Production-readiness notes (out of V1 scope, by design)

- Replace sample JSON with the live NPPES API + IDFPR bulk exports; schedule
  ingestion; add rate limiting/backoff in adapters.
- Move table creation fully to Alembic; add connection pooling config.
- Add authn/z, audit logging, and compliance review before any outreach use.
- Feedback table is retraining-ready (verdict + timestamp per prospect); a
  future scoring model can calibrate weights against advisor verdicts.
