"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateBoard } from "@/lib/actions";
import {
  toIngestStatus,
  type IngestPhase,
  type IngestStatus,
  type SweepReport,
} from "@/lib/api";
import { setAuditMode, useAuditMode } from "@/lib/audit";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_MS = 15000;
// While a sweep we started is in flight — the phase checklist rides this
const SWEEP_POLL_MS = 3000;
// How long the completion summary sits in the bar before the tooltip
// carries it alone
const BANNER_MS = 10000;

async function loadStatus(): Promise<IngestStatus | null> {
  try {
    const res = await fetch(`${API_URL}/ingest/status`);
    if (!res.ok) return null;
    return toIngestStatus(await res.json());
  } catch {
    return null;
  }
}

// Kept to one short line per source — this is a tooltip, not a doc
const SOURCE_CADENCE: { name: string; cadence: string }[] = [
  { name: "NPPES (NPI)", cadence: "weekly" },
  { name: "IDFPR licenses", cadence: "continuous" },
  { name: "PECOS (Medicare)", cadence: "~monthly" },
  { name: "Cook County deeds", cadence: "continuous (lag)" },
];

// The checklist's wording per step. Keyed by the backend's phase key; a
// key we don't know falls back to the backend's own label.
const PHASE_COPY: Record<
  string,
  { name: string; running: string; done: (n: number) => string }
> = {
  nppes: {
    name: "NPI Registry",
    running: "searching…",
    done: (n) => `${n} physicians found`,
  },
  idfpr: {
    name: "IL Licensing",
    running: "checking…",
    done: (n) => `${n} licences checked`,
  },
  pecos: {
    name: "Medicare Billing",
    running: "reading…",
    done: (n) => `${n} billing records`,
  },
  cook: {
    name: "County Deeds",
    running: "searching…",
    done: (n) => `${n} deeds found`,
  },
  resolve: {
    name: "Merge & score",
    running: "merging…",
    done: (n) => `${n} resolved`,
  },
  summaries: {
    name: "Advisor summaries",
    running: "writing…",
    done: (n) => `${n} written`,
  },
};
// These three genuinely run side by side (a ThreadPoolExecutor in the
// backend), so the checklist groups them
const PARALLEL = new Set(["idfpr", "pecos", "cook"]);

// The Last sweep block's per-source rows, in pipeline order
const REPORT_ROWS: { label: string; key: keyof SweepReport }[] = [
  { label: "NPI Registry", key: "npiRecords" },
  { label: "IL licenses", key: "idfprRecords" },
  { label: "Medicare billing", key: "pecosRecords" },
  { label: "County deeds", key: "cookRecords" },
];

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso + "Z").getTime() - Date.now()) / 86_400_000);
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function duration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/** Seconds since an ISO timestamp the API wrote in UTC (with or without
 *  an offset). */
function secondsSince(iso: string, now: number): number {
  const stamp = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z";
  return (now - new Date(stamp).getTime()) / 1000;
}

/** The merge step's result line: what happened to the book.
 *
 *  "Checked", not "updated" or "re-scored": the pipeline counts every
 *  existing prospect it re-fetched and re-ran, which after a full sweep is
 *  everyone — and for most of them the score came out the same number as
 *  before. "Moved" is whose score actually changed — the honest change
 *  number, and the same one the board's What changed alert shows. */
function bookChanges(
  created: number | null,
  updated: number | null,
  skipped: number | null,
  moved: number | null,
  long = false,
): string {
  const parts = [
    `${created ?? 0} new${long ? " prospects" : ""}`,
    `${updated ?? 0} checked`,
  ];
  if (moved != null) parts.push(`${moved} moved`);
  if (skipped != null)
    parts.push(`${skipped} skipped${long ? " (not fresh entrants)" : ""}`);
  return parts.join(" · ");
}

function phaseLine(p: IngestPhase, sweepFailed: boolean): string {
  const copy = PHASE_COPY[p.key];
  switch (p.status) {
    case "done":
      if (p.key === "resolve")
        return bookChanges(p.created, p.updated, p.skipped, p.moved);
      return copy ? copy.done(p.records ?? 0) : `${p.records ?? 0} rows`;
    case "running":
      return copy?.running ?? "running…";
    case "failed":
      return p.detail ?? "failed";
    case "skipped":
      return p.detail ?? "skipped";
    default:
      return sweepFailed ? "not run" : "waiting";
  }
}

/** ✓ / spinner / ✗ / ○ for one step. */
function PhaseMark({ status }: { status: IngestPhase["status"] }) {
  if (status === "running")
    return (
      <span
        aria-label="running"
        className="size-3 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
      />
    );
  const glyph = status === "done" ? "✓" : status === "failed" ? "✗" : "○";
  const tone =
    status === "done"
      ? "text-tier-strong"
      : status === "failed"
        ? "text-tier-poor"
        : "text-ink-faint";
  return (
    <span
      aria-label={status}
      className={`w-3 shrink-0 text-center font-display text-[12px] font-bold leading-none ${tone}`}
    >
      {glyph}
    </span>
  );
}

/** Nav-bar data control: quiet status line + Refresh Data button. Hovering
 *  shows how often each upstream source actually updates, so advisors know
 *  a weekly refresh is the honest cadence — and what the last sweep found.
 *  While a sweep runs the button opens a checklist of its steps. */
export default function RefreshData({
  status: initial,
}: {
  status: IngestStatus | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);
  // The step checklist popover (click-to-open, not the hover tooltip)
  const [open, setOpen] = useState(false);
  // Completion summary shown in the bar for a few seconds after a sweep
  const [banner, setBanner] = useState<string | null>(null);
  // Ticks once a second while the popover shows "Started … ago"
  const [now, setNow] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  // What Try again should re-run: the same call the user clicked
  const lastForce = useRef(false);
  const audit = useAuditMode();

  // Self-updating: the line stays current without a page refresh, and
  // picks up ingests run from anywhere (another tab, the CLI, a teammate).
  // Sweeps started elsewhere show their live phases here too — the poll
  // carries them, and the running flag drives the button.
  useEffect(() => {
    let lastSeen = initial?.lastRunAt ?? null;
    const tick = async () => {
      const fresh = await loadStatus();
      if (!fresh) return;
      setStatus(fresh);
      if (fresh.lastRunAt !== lastSeen) {
        lastSeen = fresh.lastRunAt;
        // A new run landed elsewhere — drop the cached board, then reload
        await revalidateBoard();
        router.refresh();
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [initial, router]);

  // Close the popover on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Spin for our own run and for one started anywhere else (the 15s poll
  // carries the backend's running flag)
  const sweeping = running || (status?.running ?? false);

  useEffect(() => {
    if (!(open && sweeping)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, sweeping]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner]);

  // Deep sweep + discovery filter: existing prospects always update,
  // but unknown physicians are only created when their NPI or state
  // license is under 6 months old — fresh entrants, not backlog.
  // force=true is the test sweep's explicit bypass of the weekly gate.
  // The sweep itself runs in the backend's background — the POST returns
  // immediately and this watches /ingest/status until the run lands.
  async function runIngest(force: boolean) {
    lastForce.current = force;
    setRunning(true);
    setError(false);
    setBanner(null);
    try {
      const before = status?.lastRunAt ?? null;
      const res = await fetch(
        `${API_URL}/ingest/run?limit=200&new_within_months=6` +
          (force ? "&force=true" : ""),
        { method: "POST" },
      );
      // 409 = a sweep is already in flight (another tab) — watch that one
      if (!res.ok && res.status !== 409) throw new Error(String(res.status));
      for (let tick = 0; tick < 300; tick++) {
        await new Promise((resolve) => setTimeout(resolve, SWEEP_POLL_MS));
        const fresh = await loadStatus();
        if (!fresh) continue;
        setStatus(fresh);
        if (fresh.running) continue;
        if (fresh.lastError) throw new Error(fresh.lastError);
        if (fresh.lastRunAt !== before) {
          const r = fresh.lastSweep;
          if (r)
            setBanner(
              bookChanges(
                r.prospectsCreated,
                r.prospectsUpdated,
                r.prospectsSkipped,
                r.prospectsMoved,
              ),
            );
          await revalidateBoard();
          router.refresh();
          return;
        }
        // Not running, no error, no new run — after a grace tick for the
        // thread to spin up, treat it as a silent failure.
        if (tick >= 2) throw new Error("sweep ended without recording a run");
      }
      throw new Error("sweep timed out");
    } catch {
      setError(true);
    } finally {
      setRunning(false);
    }
  }

  // The weekly lock: unclickable until 7 days after the last run
  const lockedDays =
    status?.nextSweepAt && daysUntil(status.nextSweepAt) > 0
      ? daysUntil(status.nextSweepAt)
      : 0;
  const blocked = sweeping || lockedDays > 0;

  // ── The checklist's state, derived from the poll ──
  const phases = status?.phases ?? [];
  const failedIndex = phases.findIndex((p) => p.status === "failed");
  const failedPhase = failedIndex >= 0 ? phases[failedIndex] : null;
  // The last sweep this backend ran ended in a failure we should surface
  const sweepFailed =
    failedPhase !== null && !sweeping && (error || !!status?.lastError);
  const finished =
    phases.length > 0 &&
    !sweeping &&
    failedPhase === null &&
    phases.every((p) => p.status === "done" || p.status === "skipped");
  const stepCount = phases.length;
  const currentStep = sweeping
    ? Math.min(
        stepCount,
        phases.findIndex((p) => p.status !== "done" && p.status !== "skipped") +
          1 || stepCount,
      )
    : 0;
  const runningPhase = phases.find((p) => p.status === "running");
  const report = status?.lastSweep ?? null;

  const header = sweeping
    ? `Sweeping… · step ${currentStep} of ${stepCount}`
    : sweepFailed
      ? `Sweep failed at step ${failedIndex + 1}`
      : finished
        ? `Sweep complete${report?.durationSeconds != null ? ` · ${duration(report.durationSeconds)}` : ""}`
        : "Last sweep";

  const barText = sweeping
    ? runningPhase
      ? `Step ${currentStep} of ${stepCount} · ${runningPhase.label}…`
      : "Sweeping four live sources…"
    : banner;

  const showPopover = open && phases.length > 0;

  return (
    <div ref={rootRef} className="group relative flex items-center gap-2.5">
      {/* Only the states that need acting on stay in the bar. */}
      {barText ? (
        <span className="hidden text-[12px] text-ink-muted sm:inline">
          {barText}
        </span>
      ) : sweepFailed ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="hidden text-[12px] font-semibold text-tier-poor hover:underline sm:inline"
        >
          Sweep failed at step {failedIndex + 1} · details ▾
        </button>
      ) : error ? (
        <span className="hidden text-[12px] font-semibold text-tier-poor sm:inline">
          Refresh failed — is the API up?
        </span>
      ) : null}

      {/* aria-disabled rather than disabled: a truly disabled button swallows
          every pointer event, so hovering it dropped :hover on the wrapper and
          took the tooltip with it — the one place that explains the lock and
          holds the override. This stays hoverable and focusable and refuses
          the click itself. */}
      <button
        type="button"
        onClick={() => {
          // While a sweep runs the button opens its checklist; otherwise it
          // starts one, unless the weekly lock is on
          if (sweeping) setOpen((v) => !v);
          else if (!blocked) void runIngest(false);
        }}
        aria-disabled={!sweeping && blocked}
        aria-expanded={sweeping ? open : undefined}
        title={
          sweeping
            ? "See which step the sweep is on"
            : lockedDays > 0
              ? `Weekly cadence — the sources barely move faster. Unlocks in ${lockedDays}d.`
              : "Run the weekly sweep"
        }
        className={
          "flex items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors " +
          (blocked ? "cursor-not-allowed opacity-60" : "hover:bg-surface-soft")
        }
      >
        {sweeping ? (
          <>
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent"
            />
            Sweeping… <span aria-hidden>▾</span>
          </>
        ) : lockedDays > 0 ? (
          `Refresh in ${lockedDays}d`
        ) : (
          "Refresh Data"
        )}
      </button>

      {/* Step checklist — a popover under the button, GitHub-checks style.
          The board stays usable behind it. Stays available after the
          sweep ends so the result (or the failure) can be read. */}
      {showPopover ? (
        <div
          role="dialog"
          aria-label={header}
          className="absolute right-0 top-full z-30 mt-2 w-[320px] rounded-[12px] border border-hairline bg-white p-3 shadow-panel"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p
              className={
                "font-display text-[12px] font-semibold " +
                (sweepFailed ? "text-tier-poor" : "text-ink")
              }
            >
              {header}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-[12px] leading-none text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </div>

          <ol className="mt-2.5 space-y-1.5">
            {phases.map((p, i) => {
              const parallel = PARALLEL.has(p.key);
              const groupStart = parallel && !PARALLEL.has(phases[i - 1]?.key);
              const groupEnd = parallel && !PARALLEL.has(phases[i + 1]?.key);
              return (
                <li
                  key={p.key}
                  className={
                    parallel
                      ? "ml-1 border-l-2 border-hairline pl-2.5" +
                        (groupStart ? " mt-2.5 pt-0.5" : "") +
                        (groupEnd ? " pb-0.5" : "")
                      : i > 0 && !parallel && PARALLEL.has(phases[i - 1]?.key)
                        ? "mt-2.5"
                        : ""
                  }
                >
                  {groupStart ? (
                    <p className="eyebrow -ml-2.5 mb-1.5 pl-2.5">
                      searched in parallel
                    </p>
                  ) : null}
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="mt-[2px] flex size-3 items-center justify-center">
                      <PhaseMark status={p.status} />
                    </span>
                    <span
                      className={
                        "w-[118px] shrink-0 font-display font-semibold " +
                        (p.status === "pending" || p.status === "skipped"
                          ? "text-ink-muted"
                          : "text-ink")
                      }
                    >
                      {PHASE_COPY[p.key]?.name ?? p.label}
                    </span>
                    <span
                      className={
                        "min-w-0 break-words " +
                        (p.status === "failed"
                          ? "font-semibold text-tier-poor"
                          : "text-ink-muted")
                      }
                      title={
                        p.status === "failed"
                          ? (p.detail ?? undefined)
                          : undefined
                      }
                    >
                      {phaseLine(p, sweepFailed)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {sweeping && status?.startedAt ? (
            <p className="mt-2.5 text-[10px] text-ink-muted">
              Started {duration(secondsSince(status.startedAt, now))} ago
            </p>
          ) : null}

          {sweepFailed ? (
            <>
              <p className="mt-2.5 text-[11px] text-ink">
                {failedPhase?.key === "summaries"
                  ? "Prospects were updated, but the run wasn't recorded."
                  : "Nothing was saved — your book is unchanged."}
              </p>
              <button
                type="button"
                // A failed sweep recorded nothing, so the weekly gate is
                // wherever it was; a retry behind a locked gate must force
                // it (the failed sweep was forced or started from the CLI)
                onClick={() => runIngest(lastForce.current || lockedDays > 0)}
                className="mt-2 w-full rounded-[8px] border border-hairline bg-white px-2.5 py-1.5 font-display text-[11px] font-semibold text-brand transition-colors hover:bg-surface-soft"
              >
                Try again
              </button>
            </>
          ) : null}

          {finished && status?.lastRunAt ? (
            <p className="mt-2.5 text-[10px] text-ink-muted">
              Data updated {ago(status.lastRunAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Source-cadence tooltip. The offset is padding, not margin: as a
          margin it was dead space, and crossing it left the group and shut the
          panel before the pointer could land in it. Yields to the popover so
          the two never stack. */}
      {showPopover ? null : (
        <div className="absolute right-0 top-full z-20 hidden pt-2 group-hover:block group-focus-within:block">
          <div className="w-[300px] rounded-[12px] border border-hairline bg-white p-3 shadow-panel">
            {lockedDays > 0 ? (
              <p className="mb-2 rounded-[8px] bg-surface-tint px-2.5 py-1.5 text-[11px] leading-[15px] text-brand-dark">
                Locked for {lockedDays} more day{lockedDays === 1 ? "" : "s"} —
                the sources barely move faster than weekly.
              </p>
            ) : null}
            <p className="text-[12px] text-ink-muted">
              {status?.lastRunAt
                ? `Data updated ${ago(status.lastRunAt)}`
                : "No ingest recorded yet"}
              {status && status.staleSummaries > 0
                ? ` · ${status.staleSummaries} summaries pending`
                : ""}
            </p>

            {report ? (
              <>
                <p className="eyebrow mt-3">
                  Last sweep
                  {report.durationSeconds != null
                    ? ` · ${duration(report.durationSeconds)}`
                    : ""}
                </p>
                <dl className="mt-1.5 space-y-1">
                  {/* Rows only for what the run recorded — older runs
                    predate the per-source counts */}
                  {REPORT_ROWS.filter((r) => report[r.key] != null).map((r) => (
                    <div
                      key={r.key}
                      className="flex justify-between gap-3 text-[11px]"
                    >
                      <dt className="text-ink-muted">{r.label}</dt>
                      <dd className="shrink-0 font-display font-semibold text-ink">
                        {report[r.key]} {report[r.key] === 1 ? "row" : "rows"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1.5 text-[11px] leading-[15px] text-ink">
                  →{" "}
                  {bookChanges(
                    report.prospectsCreated,
                    report.prospectsUpdated,
                    report.prospectsSkipped,
                    report.prospectsMoved,
                    true,
                  )}
                </p>
                {report.enrichmentRecords != null &&
                report.enrichmentMatched != null ? (
                  <p className="text-[11px] leading-[15px] text-ink">
                    → {report.enrichmentMatched} events attached ·{" "}
                    {report.enrichmentRecords - report.enrichmentMatched}{" "}
                    discarded (no identity match)
                  </p>
                ) : null}
              </>
            ) : null}

            <p className="eyebrow mt-3">Source Update Cadence</p>
            <dl className="mt-1.5 space-y-1">
              {SOURCE_CADENCE.map((s) => (
                <div
                  key={s.name}
                  className="flex justify-between gap-3 text-[11px]"
                >
                  <dt className="text-ink-muted">{s.name}</dt>
                  <dd className="shrink-0 font-display font-semibold text-ink">
                    {s.cadence}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10px] leading-[14px] text-ink-muted">
              Weekly refresh recommended — existing prospects update in place
              (no duplicates); only fresh entrants (&lt;6 mo NPI or license)
              join.
            </p>

            {/* Dev/test escape hatch: same sweep, bypasses the weekly lock. Lives
              here rather than in the bar — it is not advisor-facing. */}
            <button
              type="button"
              onClick={() => runIngest(true)}
              disabled={sweeping}
              title="Test sweep — bypasses the weekly lock (dev only)"
              className="mt-3 w-full rounded-[8px] border border-dashed border-hairline bg-white px-2.5 py-1.5 font-display text-[11px] font-semibold text-ink-muted transition-colors hover:bg-surface-soft hover:text-brand disabled:opacity-60"
            >
              Test sweep — ignore the weekly lock
            </button>

            {/* Operator-only, like the button above. Hidden from the board
              rather than protected — there are no accounts to protect it
              with. */}
            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[10px] leading-[14px] text-ink-muted">
              <input
                type="checkbox"
                checked={audit}
                onChange={(e) => setAuditMode(e.target.checked)}
                className="mt-[1px] accent-brand"
              />
              <span>
                <span className="font-display text-[11px] font-semibold text-ink">
                  Identity audit
                </span>{" "}
                — badge and filter the board by how each profile was merged. Off
                for advisors; on stays on in this browser. Hides, does not
                protect.
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
