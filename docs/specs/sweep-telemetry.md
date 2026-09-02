# Spec: Sweep telemetry — live phase progress + per-source counts

**Status:** ready to build · **Audience:** any coding agent (Roo/Cline/etc.) working in this repo
**Goal:** when a data sweep runs (the nav's **Refresh Data** button or the **Test sweep**), the user should see *which step the sweep is on* while it loads, and afterwards a *report of what it found* — how many rows per source, how many became prospects — persisted in the database and shown in the UI.

---

## 1. Current state (verified, with pointers)

The backend is FastAPI + SQLAlchemy in `app/`, the UI is Next.js in `frontend/`.

- **The sweep** is `run_live_ingest()` in `app/services/live_ingest.py`. Its real phases, in order:
  1. NPPES (NPI Registry) fetch — blocking, supplies the keys for everything else.
  2. Three enrichment sources **in parallel** on a `ThreadPoolExecutor(max_workers=3)`: IDFPR licenses, PECOS (Medicare), Cook County deeds.
  3. `IngestionPipeline.run()` (`app/services/pipeline.py`) — identity resolution, enrichment attach, signal detection, scoring, persistence.
  4. Composed summaries for newcomers, then `db.commit()`.
- **Background execution:** `start_background_ingest()` in the same file runs the sweep on a worker thread and tracks a module-global dict `_ingest_state = {"running": False, "error": None}`. The API reads it via `ingest_is_running()` / `last_ingest_error()`.
- **API:** `POST /ingest/run` (`app/api/routes.py:41`) — returns immediately (`IngestStarted`) unless `wait=true` (tests/bootstrap run it synchronously). `GET /ingest/status` (`app/api/routes.py:92`) returns `IngestStatusOut` (`app/schemas/api.py:182`).
- **Persistence:** `IngestRun` (`app/models/entities.py:213`) currently stores only `state, records_ingested, prospects_created, prospects_updated, ran_at`.
- **Already computed but thrown away:** `PipelineResult` (`app/services/pipeline.py:52`) also carries `prospects_resolved`, `prospects_skipped` (discovery-filter skips), `enrichment_records`, `enrichment_matched` — none of it persisted. Per-source row counts are trivially available in `run_live_ingest` at the point each future's result is merged.
- **Frontend:** `frontend/src/components/RefreshData.tsx`. Key facts:
  - While a sweep it started is in flight, it already polls `/ingest/status` **every 3 s** (`runIngest`, line ~102). Idle, it polls every 15 s.
  - During a sweep the bar shows only the static text "Sweeping four live sources…".
  - A hover tooltip panel already exists (source-cadence list + the Test sweep button) — the natural home for the post-run report.
- Migrations are Alembic (`alembic/`). DB is SQLite (`prospects.db`).

**Design constraint:** no websockets/SSE. Phase progress rides the existing 3-second `/ingest/status` poll — extend the payload, nothing else.

---

## 2. Feature A — live phase progress

### Backend

Extend `_ingest_state` with a thread-safe progress structure, written by `run_live_ingest` as it moves through phases. Suggested shape (list order = display order):

```json
{
  "running": true,
  "error": null,
  "phases": [
    {"key": "nppes",     "label": "Searching NPI Registry",          "status": "done",    "records": 214},
    {"key": "idfpr",     "label": "Checking IL licenses",            "status": "done",    "records": 198},
    {"key": "pecos",     "label": "Reading Medicare billing",        "status": "running", "records": null},
    {"key": "cook",      "label": "Searching Cook County deeds",     "status": "running", "records": null},
    {"key": "resolve",   "label": "Merging identities & scoring",    "status": "pending", "records": null},
    {"key": "summaries", "label": "Writing advisor summaries",       "status": "pending", "records": null}
  ]
}
```

Implementation notes:

- `records` for a source phase = row count that source returned; for `resolve` reuse it for prospects resolved.
- The three enrichment phases start together (that's the truth of the pipeline — see the ThreadPoolExecutor); mark each `done` individually as its future resolves. Wrap each future's callable so it stamps its own completion (`pool.submit` a small wrapper), or mark them at `.result()` collection time — wrapper preferred so PECOS finishing first shows first.
- Guard writes with the existing `_ingest_lock` or a new lock; the status endpoint reads from another thread.
- Reset phases to all-`pending` at sweep start; on exception, leave the failing phase visible and set `error` as today.
- The synchronous `wait=true` path (`routes.py:77`) calls `run_live_ingest` directly — progress updates are harmless there; do not special-case it. To make this work, move the phase-stamping *into* `run_live_ingest` itself (not the background wrapper).
- Add `phases` to `IngestStatusOut` (default `[]` / `None` so old clients are unaffected).

### Frontend (`RefreshData.tsx`) — progress popover (design approved by Kelvin)

While a sweep runs, the Refresh Data button becomes `Sweeping… ▾` and clicking it opens a **popover anchored under the button** (GitHub-PR-checks style — NOT a modal; the user can keep browsing the board). It shows a **6-step checklist**; steps 2–4 sit inside a labeled "searched in parallel" group because they genuinely run concurrently:

```
┌─ Sweeping… · step 3 of 6 ───────────────────────┐
│  ✓ NPI Registry          214 physicians found   │
│                                                 │
│    searched in parallel ─────────────────────   │
│  │ ✓ IL Licensing        198 licences checked   │
│  │ ◐ Medicare Billing    reading…               │
│  │ ✓ County Deeds        9 deeds found          │
│    ──────────────────────────────────────────   │
│                                                 │
│  ○ Merge & score         waiting                │
│  ○ Advisor summaries     waiting                │
│                                                 │
│  Started 1m 40s ago                             │
└─────────────────────────────────────────────────┘
```

States per step: `✓` done (accent color) with its result count · `◐` spinner on running steps (the parallel group can have several spinning at once) · `○` pending (muted). The header carries a step counter where the "current" step is the first non-done one.

**Finished state** (popover stays available after completion; same content feeds the Last sweep block in §4):

```
✓ Merge & score       3 new · 187 updated · 24 skipped
✓ Advisor summaries   3 written
header: Sweep complete · 4m 12s
```

("Merge & score" is where *existing* prospects get updated in place — every sweep re-scores everyone it re-fetched; only unknown physicians face the 6-month fresh-entrant filter, which is what "skipped" counts.)

**Error state.** Sweeps can and do fail — all four sources are live public APIs (data.cms.gov is noted in `pecos/client.py` as the slowest). Today any source raising aborts the whole sweep (`_worker` catches it into `last_error`). The popover must show *which* step failed:

```
┌─ Sweep failed at step 3 ────────────────────────┐
│  ✓ NPI Registry          214 physicians found   │
│  │ ✓ IL Licensing        198 licences checked   │
│  │ ✗ Medicare Billing    timed out after 60s    │
│  │ ✓ County Deeds        9 deeds found          │
│  ○ Merge & score         not run                │
│  ○ Advisor summaries     not run                │
│  Nothing was saved — your book is unchanged.    │
│  [ Try again ]                                  │
└─────────────────────────────────────────────────┘
```

Backend support: when a phase's work raises, stamp that phase `"status": "failed"` with a short `"detail"` (exception message, truncated) before re-raising, so the existing error flow is unchanged.

**Batches and retries (context the builder needs).** Each source fetches in batches — IDFPR 150 licences/request, PECOS 50 NPIs/request, Cook County 100 names/request — and every batch request already gets one automatic retry on timeout/5xx (`app/adapters/base.py:18`, `polite_get_json`). If the retry also fails, the batch's exception propagates and fails its whole source (and today, the whole sweep). Two consequences for this feature:
- A "failed" phase's `detail` is usually a batch-level httpx error; keep the message as-is (it names the status/timeout) — do not try to add batch numbers to it (the adapters don't currently know their batch index; out of scope).
- Optional, cheap, and nice for long sources: a running source phase may include `"batches_done": n, "batches_total": m` in its phase entry so the popover can render "reading… (batch 2 of 4)". Only do this where the batch count is already computable at the call site (`live_ingest.py` knows the input list sizes and each adapter's `BATCH_SIZE`); skip it rather than refactor adapters. The "nothing was saved" line is truthful for failures at or before Merge & score (`IngestionPipeline.run` commits at its end); a failure *during* Advisor summaries can leave prospects committed without an IngestRun row — in that one case say "Prospects were updated, but the run wasn't recorded" instead. `[Try again]` re-invokes the same `runIngest(force)` the user clicked.

- The idle 15 s poll also receives `phases`, so a sweep started from another tab/CLI shows the same live popover here (the `sweeping` flag already drives the button state).

---

## 3. Feature B — persist the full sweep report

Extend `IngestRun` (`app/models/entities.py:213`) with nullable columns (nullable so historic rows stay valid — **Alembic migration required**):

| column | source of the value |
|---|---|
| `npi_records` | `len(records)` right after the NPPES fetch in `run_live_ingest` |
| `idfpr_records` | `len(idfpr_future.result())` |
| `pecos_records` | `len(pecos_records)` |
| `cook_records` | `len(cook_future.result())` |
| `prospects_resolved` | `PipelineResult.prospects_resolved` |
| `prospects_skipped` | `PipelineResult.prospects_skipped` (discovery filter: known physicians who are not fresh entrants) |
| `enrichment_records` | `PipelineResult.enrichment_records` |
| `enrichment_matched` | `PipelineResult.enrichment_matched` (rows that attached; the difference vs `enrichment_records` = rows discarded at the identity gate) |
| `duration_seconds` | wall-clock of `run_live_ingest` (float) |

`records_ingested`, `prospects_created`, `prospects_updated`, `ran_at`, `state` already exist. Plumb the per-source counts from `run_live_ingest` into the `IngestRun(...)` construction it already does (~line 81). Expose all new fields on `IngestStatusOut` (nullable) from the latest run.

---

## 4. Feature C — show the report in the UI

In the existing hover tooltip panel in `RefreshData.tsx` (it already shows "Data updated Xh ago"), add a compact **Last sweep** block fed from `/ingest/status`:

```
Last sweep · 4m 12s
NPI Registry        214 rows
IL licenses         198 rows
Medicare billing     61 rows
County deeds          9 rows
→ 3 new prospects · 187 updated · 24 skipped (not fresh entrants)
→ 70 events attached · 12 discarded (no identity match)
```

- Render rows only for non-null fields (older runs predate the columns).
- Right after a sweep the user just watched, the same numbers double as the completion message — optionally show the "→" summary lines inline in the bar for ~10 s after `running` flips false, then let the tooltip carry it.

---

## 5. Other information worth surfacing (ranked; first two are cheap and high-value)

1. **Attach rate / identity discards** — `enrichment_records - enrichment_matched` is the count of real-world events the identity gate refused to pin on anyone (the "Reyes-Martin" cases). It is the system's precision story; show it (done above).
2. **Skipped strangers** — `prospects_skipped` explains "why did 200 rows produce only 3 prospects?" (answer: the 6-month fresh-entrant discovery filter). Without it the numbers look broken.
3. **Score movement** — after each sweep, count prospects whose `total_score` changed by ≥5 (query `ScoreSnapshot`, last two per prospect). One number: "12 prospects moved". Medium effort; optional.
4. **Per-source failures** — today one source raising kills the whole sweep. A follow-up (out of scope here, but leave room in the phase structure): per-phase `"status": "failed"` + partial completion.
5. **Stale summaries** — already in `IngestStatusOut.stale_summaries`; already shown in the tooltip. No work.

---

## 6. Acceptance criteria

1. Clicking **Test sweep** turns the button into `Sweeping… ▾`; clicking that opens the 6-step popover, whose steps advance (✓/◐/○ with live counts) within ~3 s of each phase change.
1b. When a source raises (simulate by pointing one source URL at an unreachable host), the popover shows ✗ on that step with the error detail, downstream steps read "not run", and the "nothing was saved" line appears.
2. When the sweep finishes, `ingest_runs` has one new row with all §3 columns populated; `GET /ingest/status` returns them.
3. The hover panel shows the Last sweep block with per-source counts, created/updated/skipped, attached/discarded, and duration.
4. A sweep started from another tab shows live phases in this tab (idle poll path).
5. `POST /ingest/run?wait=true` still returns the full `IngestResult` and also records the new columns (the tests use this path — run `pytest tests/` and keep it green).
6. Old `ingest_runs` rows (null new columns) render without errors in API and UI.
7. Alembic migration upgrades a copy of the existing `prospects.db` cleanly.

## 7. Out of scope

- Websockets/SSE, real per-request progress bars within a source, retrying failed sources, any change to the weekly-gate logic, and the frontend's `src/`-less structure (the UI lives in `frontend/`, note the `frontend/AGENTS.md` warning: read `node_modules/next/dist/docs/` before writing Next.js code — the version has breaking changes).
