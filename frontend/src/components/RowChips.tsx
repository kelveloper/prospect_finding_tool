import type { Candidate } from "@/lib/data";

/** The small print of a row, each piece saying what it is on hover.
 *
 *  A chip that reads "New practice" or "▲ 3" is only obvious to whoever built
 *  it, so every one of these carries a plain-English title. */

/** Why this prospect is worth a call now. Absent when nothing recent
 *  happened — silence is the honest answer, and it reads faster than a
 *  placeholder. */
export function TriggerChip({ trigger }: { trigger: Candidate["trigger"] }) {
  if (!trigger) return null;

  return (
    <span
      title={`Why now — ${trigger.hint}`}
      className={
        "inline-flex shrink-0 cursor-help items-center rounded-full px-2.5 py-[3px] font-display text-[11px] font-semibold " +
        (trigger.hot
          ? "bg-tier-neutral-bg text-tier-neutral-fg"
          : "bg-surface-soft text-ink-muted")
      }
    >
      {trigger.label}
    </span>
  );
}

/** Score movement since the previous ingest.
 *
 *  Until a second ingest exists there is nothing to compare against, so this
 *  says so rather than leaving a gap the advisor has to interpret. */
export function MovementChip({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span
        title="Score movement — nothing to compare yet. This fills in after the next data refresh."
        className="shrink-0 cursor-help font-display text-[11px] font-medium text-ink-faint"
      >
        no change yet
      </span>
    );
  }

  if (change === 0) {
    return (
      <span
        title="Score has not moved since the last data refresh."
        className="shrink-0 cursor-help font-display text-[11px] font-medium text-ink-faint"
      >
        no change
      </span>
    );
  }

  const up = change > 0;
  return (
    <span
      title={`Score moved ${up ? "up" : "down"} ${Math.abs(change)} ${
        Math.abs(change) === 1 ? "point" : "points"
      } since the last data refresh.`}
      className={
        "shrink-0 cursor-help font-display text-[11px] font-bold tabular-nums " +
        (up ? "text-tier-strong-fg" : "text-tier-poor")
      }
    >
      {up ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

/** How much of the seven-signal evidence the score rests on. The profile has
 *  the full checklist; a row only has space for the verdict. */
export function EvidenceChip({
  evidence,
}: {
  evidence: Candidate["evidence"];
}) {
  const missing = evidence.signals
    .filter((s) => !s.present)
    .map((s) => s.label);
  const title =
    `Evidence — this score is built on ${evidence.found} of ${evidence.total} signals` +
    (missing.length
      ? `. Not found: ${missing.join(", ").toLowerCase()}.`
      : ", all of them.");

  const tone =
    evidence.level === "strong"
      ? "bg-tier-strong-bg text-tier-strong-fg"
      : evidence.level === "partial"
        ? "bg-surface-tint text-brand-dark"
        : "bg-tier-neutral-bg text-tier-neutral-fg";

  const label =
    evidence.level === "strong"
      ? "✓ strong"
      : evidence.level === "partial"
        ? "partial"
        : "⚠ thin";

  return (
    <span
      title={title}
      className={
        "inline-flex shrink-0 cursor-help items-center rounded-full px-2.5 py-[3px] font-display text-[11px] font-semibold " +
        tone
      }
    >
      {label}
    </span>
  );
}
