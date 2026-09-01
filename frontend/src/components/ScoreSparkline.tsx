import type { ScoreSnapshotItem } from "@/lib/data";

const W = 260;
const H = 44;
const PAD = 4;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Score trajectory across ingests. Single series: brand line + faint area,
 *  emphasized endpoint colored by the last move (status green/red).
 *
 *  The line and fill are drawn in SVG; the points are HTML dots laid over it,
 *  which is what lets each one carry a real hover card instead of the native
 *  <title> tooltip the browser renders slowly, unstyled, and never on focus.
 *  That overlay is why the SVG stretches with preserveAspectRatio="none" —
 *  the drawing then fills the box exactly, so the dots' percentage positions
 *  land on the line at every width. The stroke is pinned to a true 2px with
 *  vectorEffect so the stretch can't thicken it. No JavaScript: hover and
 *  focus states come from CSS, the same way the score badge's card does. */
export default function ScoreSparkline({
  history,
}: {
  history: ScoreSnapshotItem[];
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
                aria-label={`${fmt(s.recordedAt)}: total ${s.total} of 100, qualification ${s.qualification}, timing ${s.timing}`}
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
                  "pointer-events-none invisible absolute bottom-full z-30 mb-3 w-[164px] rounded-[10px] border border-hairline bg-white p-2.5 text-left opacity-0 shadow-panel transition-opacity group-hover/pt:visible group-hover/pt:opacity-100 group-focus-within/pt:visible group-focus-within/pt:opacity-100 " +
                  align
                }
              >
                <span className="eyebrow block">{fmt(s.recordedAt)}</span>

                <span className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-ink-muted">Total</span>
                  <span className="font-display text-[13px] font-bold tabular-nums text-ink">
                    {s.total}
                  </span>
                </span>

                <span className="mt-1.5 block border-t border-surface-soft pt-1.5">
                  {[
                    { label: "Qualification", value: s.qualification },
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
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
