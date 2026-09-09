import type { FieldChangeItem, ScoreSnapshotItem } from "@/lib/data";
import { FIELD_LABELS } from "./WhatChangedCard";
import { explainMove, signed } from "@/lib/movement";

const W = 260;
const H = 44;
const PAD = 4;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Why a point sits where it does. Each snapshot is written in the same
 *  transaction as the ingest that produced it, so the facts that changed
 *  "at" this point are the field changes recorded between the previous
 *  snapshot and this one. */
function explain(
  s: ScoreSnapshotItem,
  prev: ScoreSnapshotItem | null,
  changes: FieldChangeItem[],
): string[] {
  if (!prev) return ["First score on record."];
  const from = new Date(prev.recordedAt).getTime();
  const to = new Date(s.recordedAt).getTime() + 60_000;
  const facts = changes
    .filter((c) => {
      const t = new Date(c.changedAt).getTime();
      return t > from && t <= to;
    })
    .sort(
      (a, b) => (a.tier === "score" ? -1 : 1) - (b.tier === "score" ? -1 : 1),
    )
    .slice(0, 3)
    .map(
      (c) =>
        `${FIELD_LABELS[c.field] ?? c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}`,
    );
  return explainMove({
    change: round1(s.total - prev.total),
    valueChange: round1(s.qualification - prev.qualification),
    timingChange: round1(s.timing - prev.timing),
    note: s.note,
    facts,
  });
}

export default function ScoreSparkline({
  history,
  changes = [],
}: {
  history: ScoreSnapshotItem[];
  /** Recorded field changes, so a point can say which fact moved it. */
  changes?: FieldChangeItem[];
}) {
  if (history.length < 2) {
    return (
      <p className="text-[12px] text-ink-faint">
        Trajectory begins with the next ingest — one snapshot so far
        {history.length === 1 ? ` (${history[0].total})` : ""}.
      </p>
    );
  }

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

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[12px] text-ink-muted tabular-nums">
          {history[0].total}
          <span className="ml-1 text-[10px] text-ink-faint">
            {fmt(history[0].recordedAt)}
          </span>
        </span>
        <span className="font-display text-[12px] font-bold text-ink tabular-nums">
          {last.total}
          <span className="ml-1 text-[10px] font-normal text-ink-faint">
            {fmt(last.recordedAt)}
          </span>
        </span>
      </div>

      {/* Tooltips escape upward, so the chart keeps room above it. */}
      <div className="relative mt-2 h-16">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
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
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {history.map((s, i) => {
          const isLast = i === history.length - 1;
          const before = i > 0 ? history[i - 1] : null;
          const move = before ? round1(s.total - before.total) : 0;
          const why = explain(s, before, changes);
          // Edge points would push their card off the card's edge, so the
          // first and last anchor to their own side instead of centering.
          const align =
            i === 0
              ? "left-0"
              : isLast
                ? "right-0"
                : "left-1/2 -translate-x-1/2";

          return (
            <span
              key={s.recordedAt}
              className="group/pt absolute"
              style={{
                left: `${(x(i) / W) * 100}%`,
                top: `${(y(s.total) / H) * 100}%`,
              }}
            >
              {/* A 24px target around a 4-7px dot — the dot is the mark, this
                  is what the pointer and the Tab key can actually catch. */}
              <span
                tabIndex={0}
                role="note"
                aria-label={`${fmt(s.recordedAt)}: priority ${s.total}${before ? `, ${signed(move)} since the previous ingest` : ""}, value ${s.qualification}, timing ${s.timing}. ${why.join(" ")}`}
                className="absolute left-1/2 top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-help items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: isLast ? 9 : 5,
                    height: isLast ? 9 : 5,
                    backgroundColor: isLast ? endColor : "var(--color-brand)",
                    boxShadow: isLast ? "0 0 0 1.5px white" : undefined,
                  }}
                />
              </span>

              <span
                className={
                  "pointer-events-none invisible absolute bottom-full z-30 mb-3 w-[236px] rounded-[10px] border border-hairline bg-white p-2.5 text-left opacity-0 shadow-panel transition-opacity group-hover/pt:visible group-hover/pt:opacity-100 group-focus-within/pt:visible group-focus-within/pt:opacity-100 " +
                  align
                }
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">{fmt(s.recordedAt)}</span>
                  {before ? (
                    <span
                      className={
                        "font-display text-[11px] font-bold tabular-nums " +
                        (move > 0
                          ? "text-tier-strong-fg"
                          : move < 0
                            ? "text-tier-poor"
                            : "text-ink-faint")
                      }
                    >
                      {move > 0 ? "▲" : move < 0 ? "▼" : "="} {Math.abs(move)}
                    </span>
                  ) : null}
                </span>

                <span className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-ink-muted">Priority</span>
                  <span className="font-display text-[13px] font-bold tabular-nums text-ink">
                    {s.total}
                  </span>
                </span>

                <span className="mt-1.5 block border-t border-surface-soft pt-1.5">
                  {[
                    { label: "Value", value: s.qualification },
                    { label: "Timing", value: s.timing },
                  ].map((row) => (
                    <span
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 leading-[17px]"
                    >
                      <span className="text-[11px] text-ink-muted">
                        {row.label}
                      </span>
                      <span className="font-display text-[11px] font-semibold tabular-nums text-ink">
                        {row.value}
                      </span>
                    </span>
                  ))}
                </span>

                {/* Why it moved — the part a number alone cannot say */}
                <span className="mt-1.5 block border-t border-surface-soft pt-1.5">
                  {why.map((line) => (
                    <span
                      key={line}
                      className="block text-[11px] leading-[15px] text-ink-muted"
                    >
                      {line}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
