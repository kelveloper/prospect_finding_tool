import type { Candidate } from "@/lib/data";

/** Everything the score needs qualifying with, behind one "?".
 *
 *  Two questions arrive together — what the score is made of, and how much
 *  evidence it rests on — so they share a marker. Splitting them gave the
 *  profile two hover affordances inches apart, both about the same number.
 *
 *  A "?" rather than a worded badge, because the marker's job is to say
 *  "there is more here" — an unmarked hover target is invisible. It warms to
 *  amber when evidence is thin, so a score resting on three signals still
 *  says so before anyone hovers.
 *
 *  Hover and keyboard focus, never a click: this qualifies a number, it is
 *  not an action. */
const STATES = {
  strong: {
    label: "Strong evidence",
    mark: "\u2713",
    tone: "bg-tier-strong-bg text-tier-strong-fg",
  },
  partial: {
    label: "Partial evidence",
    mark: "",
    tone: "bg-surface-tint text-brand-dark",
  },
  thin: {
    label: "Thin evidence",
    mark: "\u26a0",
    tone: "bg-tier-neutral-bg text-tier-neutral-fg",
  },
} as const;

export default function EvidenceBadge({
  evidence,
  qualification,
  timing,
}: {
  evidence: Candidate["evidence"];
  qualification: number;
  timing: number;
}) {
  const thin = evidence.level === "thin";
  const state = STATES[evidence.level];

  const halves = [
    { label: "Qualification", weight: "60%", value: qualification },
    { label: "Timing", weight: "40%", value: timing },
  ];

  const spoken =
    `What makes this score. Qualification ${qualification} of 100, weighted 60 percent. ` +
    `Timing ${timing} of 100, weighted 40 percent. ` +
    `Built on ${evidence.found} of ${evidence.total} signals: ` +
    evidence.signals
      .map((s) => `${s.label} ${s.present ? "found" : "not found"}`)
      .join(", ") +
    ".";

  return (
    <span className="group/ev relative inline-flex cursor-help items-center gap-1.5">
      <span
        className={
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[11.5px] font-semibold " +
          state.tone
        }
      >
        {state.mark ? <span aria-hidden>{state.mark}</span> : null}
        {state.label}
      </span>

      <span className="group/ev relative inline-flex">
        <span
          tabIndex={0}
          role="note"
          aria-label={spoken}
          title={
            thin
              ? "Score rests on thin evidence — hover for detail"
              : "What makes this score"
          }
          className={
            "flex size-[18px] cursor-help items-center justify-center rounded-full border font-display text-[10px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 " +
            (thin
              ? "border-tier-neutral bg-tier-neutral-bg text-tier-neutral-fg"
              : "border-hairline bg-white text-ink-muted hover:border-brand hover:text-brand")
          }
        >
          ?
        </span>

        <span
          aria-hidden
          className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-[262px] rounded-[10px] border border-hairline bg-white p-3 text-left opacity-0 shadow-panel transition-opacity group-hover/ev:visible group-hover/ev:opacity-100 group-focus-within/ev:visible group-focus-within/ev:opacity-100"
        >
          <span className="eyebrow block">What makes this score</span>

          {halves.map((half) => (
            <span key={half.label} className="mt-2 block">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-ink-muted">
                  {half.label}{" "}
                  <span className="text-ink-faint">· {half.weight}</span>
                </span>
                <span className="font-display text-[12px] font-bold tabular-nums text-ink">
                  {half.value}
                </span>
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-soft">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${half.value}%` }}
                />
              </span>
            </span>
          ))}

          {/* All seven, ticked or dashed. The checklist reads faster than a
            sentence of missing names, and the gaps stay obvious. */}
          <span className="mt-3 block border-t border-surface-soft pt-2.5">
            <span
              className={
                "block font-display text-[11.5px] font-semibold " +
                (thin ? "text-tier-neutral-fg" : "text-ink")
              }
            >
              Built on {evidence.found} of {evidence.total} signals
              {thin ? " — thin" : ""}
            </span>

            <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-[3px]">
              {evidence.signals.map((signal) => (
                <span
                  key={signal.label}
                  className={
                    "flex items-baseline gap-1 text-[11px] leading-[15px] " +
                    (signal.present ? "text-tier-strong-fg" : "text-ink-faint")
                  }
                >
                  <span aria-hidden className="w-2 shrink-0">
                    {signal.present ? "✓" : "—"}
                  </span>
                  {signal.label}
                </span>
              ))}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
