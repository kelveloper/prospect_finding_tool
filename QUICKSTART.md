# Quick Start

Get the Emerging Affluent Prospecting Platform running in ~3 minutes.

> **Deeper context:** [docs/HANDOVER.md](docs/HANDOVER.md) — what it does, how it works, known gaps.

---

## ⚠️ One gotcha, read this first

**Use Python 3.13. Not 3.14.**

The README says `python3 -m venv .venv`. If your `python3` is 3.14, the install
**fails** — the pinned `pydantic==2.10.4` needs `pydantic-core`, whose Rust build
refuses anything past 3.13:

```
error: the configured Python interpreter version (3.14) is newer than
       PyO3's maximum supported version (3.13)
ERROR: Failed building wheel for pydantic-core
```

Check yours:

```bash
python3 --version
```

If it says 3.14, use an explicit 3.13 interpreter everywhere below
(`/opt/homebrew/bin/python3.13` on this Mac; `brew install python@3.13` if missing).

---

## 1. Backend

From the repo root:

```bash
/opt/homebrew/bin/python3.13 -m venv .venv     # <-- NOT python3
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

No database setup needed — it uses SQLite (`./prospects.db`) and creates its
tables on startup.

**Check it:**

```bash
curl localhost:8000/health          # {"status":"ok"}
```

---

## 2. Frontend

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

That's it — the scoreboard notices the database is empty and triggers ingestion
itself. You should see 9 physicians ranked, John A Smith on top at 77.2.

---

## 3. Verify it's actually working

```bash
.venv/bin/python -m pytest tests/ -q     # expect: 27 passed
```

Poke the API directly:

```bash
curl -X POST localhost:8000/ingest/run     # load + score sample data
curl localhost:8000/prospects/ranked       # ranked lead list
open http://localhost:8000/docs            # interactive API docs
```

Expected ranked board:

```
 1.  77.2  John A Smith          Orthopaedic Surgery
 2.  76.1  Maria Elena Gonzalez  Cardiovascular Disease
 3.  67.0  Robert J Kaplan       Neurological Surgery
 ...
 9.  25.8  Michael Brooks        Pediatrics
```

---

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `Failed building wheel for pydantic-core` | Python 3.14 | Use 3.13 (top of this file) |
| UI says **"No prospects yet"** | Backend not running | Start uvicorn, reload the page |
| Feedback buttons fail with a CORS error | Frontend not on port 3000 | Backend only allows `localhost:3000` — see `app/main.py` |
| Scores look wrong after editing `.env` | Settings are cached at import | Full restart; `--reload` isn't enough |
| Want a clean slate | Stale local DB | `rm prospects.db` and re-ingest |
| Port already in use | Old server still up | `pkill -f "uvicorn app.main:app"` / `pkill -f "next dev"` |

---

## Optional: Docker + PostgreSQL

```bash
docker compose up --build
curl -X POST localhost:8000/ingest/run
```

Backend + Postgres only — **there is no frontend service in compose.** Run the
frontend on the host as in step 2.

---

## Optional: turn on the two dormant adapters

Property (`cook_county`) and career (`affiliations`) signals are built and
tested but not registered, so **45 of 100 timing points are unreachable** and
nothing can hit the UI's "Top Prospect" tier.

In [app/api/routes.py](app/api/routes.py#L22), add them to the source list:

```python
pipeline = IngestionPipeline(sources=[
    NPIDataSource(), IDFPRDataSource(), ILSoSDataSource(),
    CookCountyDataSource(), AffiliationsDataSource(),   # <-- add
])
```

...and import them at the top. Then `rm prospects.db` and re-ingest. Smith jumps
to 89.2 with all six signal types.

⚠️ This breaks two assertions in `tests/test_api.py`
(`enrichment_records == 4` → `11`, `enrichment_matched == 3` → `9`). Update them
in the same commit.

---

## Configuration (all optional)

Env vars, or a `.env` file at the repo root:

| Var | Default |
|---|---|
| `DATABASE_URL` | `sqlite:///./prospects.db` |
| `QUALIFICATION_WEIGHT` | `0.60` |
| `TIMING_WEIGHT` | `0.40` |
| `IDENTITY_MATCH_THRESHOLD` | `0.80` |

Frontend (`frontend/.env.local`, copy from `.env.local.example`) — set **both**;
they are not interchangeable:

```
API_URL=http://localhost:8000              # server-side page rendering
NEXT_PUBLIC_API_URL=http://localhost:8000  # browser feedback POST
```
