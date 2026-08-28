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
export default function RefreshData({ status: initial }: { status: IngestStatus | null }) {
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

  async function runIngest() {
    setRunning(true);
    setError(false);
    try {
      // Deep sweep: 150 per specialty so genuinely new physicians can
      // enter the book, not just the same first-page slice re-fetched
      const res = await fetch(`${API_URL}/ingest/run?limit=150`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await loadStatus());
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="group relative flex items-center gap-2.5">
      <span className="hidden text-[12px] text-ink-faint sm:inline">
        {running
          ? "Sweeping four live sources — this can take a few minutes"
          : error
            ? "Refresh failed — is the API up?"
            : status?.lastRunAt
              ? `Data updated ${ago(status.lastRunAt)}` +
                (status.staleSummaries > 0
                  ? ` · ${status.staleSummaries} summaries pending`
                  : "")
              : "No ingest recorded yet"}
      </span>

      <button
        type="button"
        onClick={runIngest}
        disabled={running}
        className="flex items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:opacity-70"
      >
        {running ? (
          <>
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent"
            />
            Refreshing…
          </>
        ) : (
          "Refresh Data"
        )}
      </button>

      {/* Source-cadence tooltip — small, hover only */}
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-[240px] rounded-[12px] bg-white p-3 shadow-panel group-hover:block">
        <p className="eyebrow">Source Update Cadence</p>
        <dl className="mt-1.5 space-y-1">
          {SOURCE_CADENCE.map((s) => (
            <div key={s.name} className="flex justify-between gap-3 text-[11px]">
              <dt className="text-ink-muted">{s.name}</dt>
              <dd className="shrink-0 font-display font-semibold text-ink">
                {s.cadence}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] leading-[14px] text-ink-faint">
          Weekly refresh recommended — re-runs update existing prospects in
          place; no duplicates.
        </p>
      </div>
    </div>
  );
}
