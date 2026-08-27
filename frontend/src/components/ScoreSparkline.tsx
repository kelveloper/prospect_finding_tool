import type { ScoreSnapshotItem } from "@/lib/data";

/** Score trajectory across ingests. Single series: brand line + faint area,
 *  emphasized endpoint colored by the last move (status green/red), values
 *  in ink tokens. Per-point tooltips carry the full snapshot. */
export default function ScoreSparkline({ history }: { history: ScoreSnapshotItem[] }) {
  if (history.length < 2) {
    return (
      <p className="text-[12px] text-ink-faint">
        Trajectory begins with the next ingest — one snapshot so far
        {history.length === 1 ? ` (${history[0].total})` : ""}.
      </p>
    );
  }

  const W = 260;
  const H = 44;
  const PAD = 4;
  const totals = history.map((s) => s.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  // Keep a minimum vertical span so near-flat lines don't look like noise
  const span = Math.max(max - min, 4);
  const mid = (max + min) / 2;
  const lo = mid - span / 2;

  const x = (i: number) => PAD + (i / (history.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);

  const line = history.map((s, i) => `${x(i)},${y(s.total)}`).join(" ");
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const delta = Math.round((last.total - prev.total) * 10) / 10;
  const endColor =
    delta > 0
      ? "var(--color-tier-strong)"
      : delta < 0
        ? "var(--color-tier-poor)"
        : "var(--color-brand)";

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[12px] text-ink-muted tabular-nums">
          {history[0].total}
          <span className="ml-1 text-[10px] text-ink-faint">{fmt(history[0].recordedAt)}</span>
        </span>
        <span className="font-display text-[12px] font-bold text-ink tabular-nums">
          {last.total}
          <span className="ml-1 text-[10px] font-normal text-ink-faint">{fmt(last.recordedAt)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-11 w-full"
        role="img"
        aria-label={`Score trajectory across ${history.length} ingests: ${history[0].total} to ${last.total}`}
      >
        <polygon points={area} fill="var(--color-brand)" opacity="0.10" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {history.map((s, i) => (
          <circle
            key={s.recordedAt}
            cx={x(i)}
            cy={y(s.total)}
            r={i === history.length - 1 ? 3.5 : 2}
            fill={i === history.length - 1 ? endColor : "var(--color-brand)"}
            stroke="white"
            strokeWidth={i === history.length - 1 ? 1.5 : 0}
          >
            <title>
              {`${fmt(s.recordedAt)} — total ${s.total} (qualification ${s.qualification}, timing ${s.timing})`}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
