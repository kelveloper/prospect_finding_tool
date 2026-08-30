/** The two halves of the score, on a "?" beside the tier badge.
 *
 *  It sits under the ring rather than on it: overlapping the artwork made the
 *  marker read as a blemish on the number, and put a hover target on top of
 *  the thing it was explaining.
 *
 *  Reveals on hover and on keyboard focus, never on click — this is a hint
 *  about a number, not an action, so it takes `cursor-help` and has no pressed
 *  state. Screen readers get the numbers from the marker's label rather than
 *  having to reach the floating panel. The group is named so it can only be
 *  driven by its own wrapper, never by an ancestor that also carries `group`. */
export default function ScoreTooltip({
  qualification,
  timing,
}: {
  qualification: number;
  timing: number;
}) {
  const rows = [
    { label: "Qualification", value: qualification, weight: "60%" },
    { label: "Timing", value: timing, weight: "40%" },
  ];

  return (
    <span className="group/help relative inline-flex">
      <span
        tabIndex={0}
        role="note"
        aria-label={`What makes up this score: qualification ${qualification} of 100, weighted 60 percent; timing ${timing} of 100, weighted 40 percent.`}
        className="flex size-[18px] cursor-help items-center justify-center rounded-full border border-hairline bg-white font-display text-[10px] font-bold text-ink-muted outline-none transition-colors hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
      >
        ?
      </span>

      <span
        aria-hidden
        className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 block w-[210px] rounded-[10px] border border-hairline bg-white p-3 text-left opacity-0 shadow-panel transition-opacity group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100"
      >
        <span className="eyebrow block">What makes this score</span>

        {rows.map((row) => (
          <span key={row.label} className="mt-2 block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] text-ink-muted">
                {row.label}{" "}
                <span className="text-ink-faint">· {row.weight}</span>
              </span>
              <span className="font-display text-[12px] font-bold tabular-nums text-ink">
                {row.value}
              </span>
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-soft">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${row.value}%` }}
              />
            </span>
          </span>
        ))}

        <span className="mt-2.5 block border-t border-surface-soft pt-2 text-[11px] leading-[16px] text-ink-muted">
          Qualification is who they are; timing is what just happened. The total
          weights them 60/40.
        </span>
      </span>
    </span>
  );
}
