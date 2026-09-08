"""The full live sweep as one callable, plus the weekly-cadence gate.

No automation by design: the sweep runs only when a person triggers it.
The weekly gate simply keeps the main Refresh Data button honest — it
unlocks 7 days after the last recorded run (matching NPPES's weekly
update rhythm); the test sweep bypasses the gate explicitly.

While a sweep runs it stamps its progress into a process-wide phase list
(see `ingest_progress`) that /ingest/status hands to the UI on its
existing poll — no websockets, no second channel.
"""
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.adapters import (
    CookCountyLiveDataSource,
    IDFPRLiveDataSource,
    NPPESDataSource,
)
from app.models import IngestRun
from app.services.pecos_sync import PECOSService
from app.services.pipeline import IngestionPipeline, PipelineResult
from app.services.ranking import RankingService
from app.summaries import apply as apply_summary, compose

# The weekly cadence: matched to NPPES's weekly update rhythm
SWEEP_INTERVAL_DAYS = 7

# ── Phase progress ───────────────────────────────────────────
# Display order. The three enrichment sources genuinely run side by side
# (see the ThreadPoolExecutor below), so the UI groups them.
PHASES: tuple[tuple[str, str], ...] = (
    ("nppes", "Searching NPI Registry"),
    ("idfpr", "Checking IL licenses"),
    ("pecos", "Reading Medicare billing"),
    ("cook", "Searching Cook County deeds"),
    ("resolve", "Merging identities & scoring"),
    ("summaries", "Writing advisor summaries"),
)
PARALLEL_PHASES: tuple[str, ...] = ("idfpr", "pecos", "cook")

# One sweep at a time, process-wide. The UI polls /ingest/status, which
# reports `running`/`last_error`/`phases` from here, and notices completion
# by the new IngestRun row — so the POST can return the moment the sweep
# starts. The lock guards every read and write: the sweep writes from its
# worker threads while the API reads from request threads.
_ingest_lock = threading.Lock()
_ingest_state: dict[str, Any] = {
    "running": False,
    "error": None,
    "started_at": None,
    "phases": [],
}


def _fresh_phases() -> list[dict[str, Any]]:
    return [
        {"key": key, "label": label, "status": "pending", "records": None, "detail": None}
        for key, label in PHASES
    ]


def _reset_progress() -> None:
    with _ingest_lock:
        _ingest_state["phases"] = _fresh_phases()
        _ingest_state["started_at"] = datetime.now(timezone.utc)


def _stamp(key: str, status: str, records: int | None = None, **extra: Any) -> None:
    """Move one phase to `status`, optionally recording what it produced."""
    with _ingest_lock:
        for phase in _ingest_state["phases"]:
            if phase["key"] == key:
                phase["status"] = status
                if records is not None:
                    phase["records"] = records
                phase.update(extra)
                return


def _short(exc: BaseException, limit: int = 160) -> str:
    text = f"{type(exc).__name__}: {exc}".strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _phased(key: str, work: Callable[[], Any], count: Callable[[Any], int] = len):
    """Run one phase's work, stamping running → done (with its row count),
    or failed (with the error) before letting the exception through so the
    existing error flow is unchanged."""
    _stamp(key, "running")
    try:
        result = work()
    except Exception as exc:
        _stamp(key, "failed", detail=_short(exc))
        raise
    _stamp(key, "done", records=count(result))
    return result


def ingest_progress() -> dict[str, Any]:
    """Snapshot of the in-flight (or most recent) sweep's phases, safe to
    hand to another thread. Empty until the first sweep of the process."""
    with _ingest_lock:
        return {
            "running": _ingest_state["running"],
            "error": _ingest_state["error"],
            "started_at": _ingest_state["started_at"],
            "phases": [dict(p) for p in _ingest_state["phases"]],
        }


def ingest_is_running() -> bool:
    with _ingest_lock:
        return _ingest_state["running"]


def last_ingest_error() -> str | None:
    with _ingest_lock:
        return _ingest_state["error"]


# ── The sweep ────────────────────────────────────────────────
def run_live_ingest(
    db: Session,
    state: str = "IL",
    limit: int = 200,
    new_within_months: int | None = 6,
) -> PipelineResult:
    """Pull all four sources, upsert the book, record the run, and give
    every summary-less newcomer a composed narrative. Raises httpx errors
    to the caller."""
    _reset_progress()
    started = time.monotonic()
    started_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Phase 1: real physicians from NPPES — the seed every other source
    # is keyed off, so it has to finish first.
    nppes = NPPESDataSource(state=state, limit_per_specialty=limit)
    records = _phased("nppes", lambda: list(nppes.fetch()))
    npi_records = len(records)
    licenses = [r.license_number for r in records if r.license_number]
    npi_names = {r.npi: (r.first_name, r.last_name) for r in records if r.npi}

    # Phase 2: the three enrichment sources are independent of one another,
    # so they run side by side — the sweep now costs NPPES plus the slowest
    # single source instead of the sum of all four. Only the PECOS branch
    # touches the session, so the shared `db` is never used concurrently.
    # Each submitted callable stamps its own phase, so whichever source
    # finishes first shows first.
    is_il = state.upper() == "IL"
    idfpr_records = pecos_records_n = cook_records = None
    with ThreadPoolExecutor(max_workers=3) as pool:
        if is_il:
            idfpr_future = pool.submit(
                _phased,
                "idfpr",
                lambda: list(IDFPRLiveDataSource(license_numbers=licenses).fetch()),
            )
            cook_future = pool.submit(
                _phased,
                "cook",
                lambda: list(
                    CookCountyLiveDataSource(buyer_names=npi_names.values()).fetch()
                ),
            )
        else:
            idfpr_future = cook_future = None
            _stamp("idfpr", "skipped", detail="Illinois only")
            _stamp("cook", "skipped", detail="Illinois only")
        pecos_future = pool.submit(
            _phased,
            "pecos",
            lambda: PECOSService(db).sync(npi_names),
            lambda result: len(result[0]),
        )

        # Merged in the order the serial sweep used: idfpr, pecos, cook
        if idfpr_future:
            idfpr_rows = idfpr_future.result()
            idfpr_records = len(idfpr_rows)
            records += idfpr_rows
        pecos_records, _ = pecos_future.result()
        pecos_records_n = len(pecos_records)
        records += pecos_records
        if cook_future:
            cook_rows = cook_future.result()
            cook_records = len(cook_rows)
            records += cook_rows

    # Phase 3: identity resolution, enrichment attach, signals, scoring
    result = _phased(
        "resolve",
        lambda: IngestionPipeline(sources=[]).run(
            db, records=records, new_within_months=new_within_months
        ),
        lambda r: r.prospects_resolved,
    )
    _stamp(
        "resolve",
        "done",
        created=result.prospects_created,
        updated=result.prospects_updated,
        skipped=result.prospects_skipped,
    )

    # Book-level record of the run — powers "Data updated …" in the nav
    # and the Last sweep report in its tooltip
    run = IngestRun(
        state=state.upper(),
        records_ingested=result.records_ingested,
        prospects_created=result.prospects_created,
        prospects_updated=result.prospects_updated,
        npi_records=npi_records,
        idfpr_records=idfpr_records,
        pecos_records=pecos_records_n,
        cook_records=cook_records,
        prospects_resolved=result.prospects_resolved,
        prospects_skipped=result.prospects_skipped,
        enrichment_records=result.enrichment_records,
        enrichment_matched=result.enrichment_matched,
    )
    db.add(run)

    # Phase 4: newcomers get a composed narrative immediately so no prospect
    # ever shows the raw pipeline text. Fill-empty-only: an existing (LLM)
    # summary is never overwritten — changed veterans stay flagged stale
    # until the offline LLM refresh upgrades them.
    # The same pass counts the movers: "updated" is everyone checked again,
    # which after a full sweep is everyone; "moved" is whose score actually
    # came out different — the number the board's What changed alert shows.
    moved = 0

    def _write_summaries() -> int:
        nonlocal moved
        written = 0
        for prospect in RankingService(db).ranked(limit=100_000):
            if prospect.advisor_summary is None:
                apply_summary(prospect, compose(prospect), source="composed")
                written += 1
            if prospect.score_history and prospect.score_change:
                latest = prospect.score_history[-1].recorded_at
                if latest.tzinfo is not None:
                    latest = latest.astimezone(timezone.utc).replace(tzinfo=None)
                if latest >= started_at:
                    moved += 1
        return written

    _phased("summaries", _write_summaries, lambda n: n)
    _stamp("resolve", "done", moved=moved)
    run.prospects_moved = moved
    run.duration_seconds = round(time.monotonic() - started, 1)
    db.commit()
    return result


# ── Background execution ─────────────────────────────────────
def start_background_ingest(
    state: str = "IL",
    limit: int = 200,
    new_within_months: int | None = 6,
) -> bool:
    """Kick off a sweep on a worker thread with its own session. Returns
    False when one is already in flight — never two sweeps at once."""
    with _ingest_lock:
        if _ingest_state["running"]:
            return False
        _ingest_state["running"] = True
        _ingest_state["error"] = None
        # Cleared here too, so a poll that lands before the worker thread
        # starts never sees the previous sweep's finished checklist
        _ingest_state["phases"] = _fresh_phases()
        _ingest_state["started_at"] = datetime.now(timezone.utc)

    def _worker() -> None:
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            run_live_ingest(
                db, state=state, limit=limit, new_within_months=new_within_months
            )
        except Exception as exc:  # surfaced via /ingest/status, not a response
            with _ingest_lock:
                _ingest_state["error"] = f"{type(exc).__name__}: {exc}"
        finally:
            db.close()
            with _ingest_lock:
                _ingest_state["running"] = False

    threading.Thread(target=_worker, name="live-ingest", daemon=True).start()
    return True


def next_sweep_due_at(db: Session) -> datetime | None:
    """When the weekly button unlocks; None means no run recorded yet."""
    last = db.query(IngestRun).order_by(IngestRun.ran_at.desc()).first()
    if last is None:
        return None
    ran_at = last.ran_at
    if ran_at.tzinfo is not None:
        ran_at = ran_at.astimezone(timezone.utc).replace(tzinfo=None)
    return ran_at + timedelta(days=SWEEP_INTERVAL_DAYS)


def sweep_is_due(db: Session) -> bool:
    due_at = next_sweep_due_at(db)
    if due_at is None:
        return True
    return datetime.now(timezone.utc).replace(tzinfo=None) >= due_at
