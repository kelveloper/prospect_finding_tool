import type { ReactNode } from "react";

/** The two halves of the score, behind a "?" on the ring.
 *
 *  This is the only fact the old Score Breakdown panel carried that the ring
 *  did not already show, so it moves here rather than occupying a card. It is
 *  a click, not a hover: a hover target with no marking is invisible, and
 *  hover does not exist on touch. Native <details>, so no JavaScript and the
 *  keyboard works for free. The full derivation stays under "Sources". */
export default function ScoreTooltip({
  qualification,
  timing,
  children,
}: {
  qualification: number;
  timing: number;
  children: ReactNode;
}) {
  const rows = [
    { label: "Qualification", value: qualification, weight: "60%" },
    { label: "Timing", value: timing, weight: "40%" },
  ];

  return (
    <span className="relative inline-block">
      {children}

      <details name="score-help" className="group absolute -right-1 top-0">
        <summary
          title="What makes up this score"
          aria-label="What makes up this score"
          className="flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-hairline bg-white font-display text-[11px] font-bold text-brand shadow-raised transition-colors hover:bg-surface-soft group-open:bg-brand group-open:text-white [&::-webkit-details-marker]:hidden"
        >
          ?
        </summary>

        <div className="absolute right-0 z-30 mt-1.5 w-[210px] rounded-[10px] border border-hairline bg-white p-3 text-left shadow-panel">
          <p className="eyebrow">What makes this score</p>

          {rows.map((row) => (
            <div key={row.label} className="mt-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-ink-muted">
                  {row.label}{" "}
                  <span className="text-ink-faint">· {row.weight}</span>
                </span>
                <span className="font-display text-[12px] font-bold tabular-nums text-ink">
                  {row.value}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${row.value}%` }}
                />
              </div>
            </div>
          ))}

          <p className="mt-2.5 border-t border-surface-soft pt-2 text-[11px] leading-[16px] text-ink-muted">
            Qualification is who they are; timing is what just happened. The
            total weights them 60/40.
          </p>
        </div>
      </details>
    </span>
  );
}
