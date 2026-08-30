"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IngestStatus } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_MS = 15000;

async function loadStatus(): Promise<IngestStatus | null> {
  try {
    const res = await fetch(`${API_URL}/ingest/status`);
    if (!res.ok) return null;
    const s = await res.json();
    return {
      lastRunAt: s.last_run_at,
      nextSweepAt: s.next_sweep_at,
      prospectsCreated: s.prospects_created,
      prospectsUpdated: s.prospects_updated,
      staleSummaries: s.stale_summaries,
    };
  } catch {
    return null;
  }
}

// Kept to one short line per source — this is a tooltip, not a doc
const SOURCE_CADENCE: { name: string; cadence: string }[] = [
  { name: "NPPES (NPI)", cadence: "weekly" },
  { name: "IDFPR licences", cadence: "continuous" },
  { name: "PECOS (Medicare)", cadence: "~monthly" },
  { name: "Cook County deeds", cadence: "continuous (lag)" },
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

/** Nav-bar data control: quiet status line + Refresh Data button. Hovering
 *  shows how often each upstream source actually updates, so advisors know
 *  a weekly refresh is the honest cadence. */
export default function RefreshData({
  status: initial,
}: {
  status: IngestStatus | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

  // Self-updating: the line stays current without a page refresh, and
  // picks up ingests run from anywhere (another tab, the CLI, a teammate)
  useEffect(() => {
    let lastSeen = initial?.lastRunAt ?? null;
    const tick = async () => {
      const fresh = await loadStatus();
      if (!fresh) return;
      setStatus(fresh);
      if (fresh.lastRunAt !== lastSeen) {
        lastSeen = fresh.lastRunAt;
        router.refresh(); // a new run landed elsewhere — reload the board
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [initial, router]);

  // Deep sweep + discovery filter: existing prospects always update,
  // but unknown physicians are only created when their NPI or state
  // license is under 6 months old — fresh entrants, not backlog.
  // force=true is the test sweep's explicit bypass of the weekly gate.
  async function runIngest(force: boolean) {
    setRunning(true);
    setError(false);
    try {
      const res = await fetch(
        `${API_URL}/ingest/run?limit=200&new_within_months=6` +
          (force ? "&force=true" : ""),
        { method: "POST" },
      );
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await loadStatus());
      router.refresh();
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

  return (
    <div className="group relative flex items-center gap-2.5">
      {/* Only the states that need acting on stay in the bar. */}
      {running || error ? (
        <span
          className={
            "hidden text-[12px] sm:inline " +
            (error ? "font-semibold text-tier-poor" : "text-ink-muted")
          }
        >
          {running
            ? "Sweeping four live sources…"
            : "Refresh failed — is the API up?"}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => runIngest(false)}
        disabled={running || lockedDays > 0}
        title={
          lockedDays > 0
            ? `Weekly cadence — the sources barely move faster. Unlocks in ${lockedDays}d.`
            : "Run the weekly sweep"
        }
        className="flex items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:opacity-60"
      >
        {running ? (
          <>
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent"
            />
            Refreshing…
          </>
        ) : lockedDays > 0 ? (
          `Refresh in ${lockedDays}d`
        ) : (
          "Refresh Data"
        )}
      </button>

      {/* Source-cadence tooltip — small, hover only */}
      <div className="absolute right-0 top-full z-20 mt-2 hidden w-[260px] rounded-[12px] border border-hairline bg-white p-3 shadow-panel group-hover:block">
        <p className="text-[12px] text-ink-muted">
          {status?.lastRunAt
            ? `Data updated ${ago(status.lastRunAt)}`
            : "No ingest recorded yet"}
          {status && status.staleSummaries > 0
            ? ` · ${status.staleSummaries} summaries pending`
            : ""}
        </p>

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
          Weekly refresh recommended — existing prospects update in place (no
          duplicates); only fresh entrants (&lt;6 mo NPI or licence) join.
        </p>

        {/* Dev/test escape hatch: same sweep, bypasses the weekly lock. Lives
            here rather than in the bar — it is not advisor-facing. */}
        <button
          type="button"
          onClick={() => runIngest(true)}
          disabled={running}
          title="Test sweep — bypasses the weekly lock (dev only)"
          className="mt-3 w-full rounded-[8px] border border-dashed border-hairline bg-white px-2.5 py-1.5 font-display text-[11px] font-semibold text-ink-muted transition-colors hover:bg-surface-soft hover:text-brand disabled:opacity-60"
        >
          Test sweep — ignore the weekly lock
        </button>
      </div>
    </div>
  );
}
