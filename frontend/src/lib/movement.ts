/**
 * Why a score moved, in the reader's words — shared by the sparkline's
 * hover card and the movement chip on cards and Book rows.
 *
 * Value only moves when a recorded fact changes (specialty, ownership,
 * career stage). Timing only rises when an event or licence date attaches
 * and only falls as events age, so its direction explains itself. A note on
 * the snapshot (a rescore under a new formula) trumps all of that.
 */

export type Move = {
  /** Total movement; null until two snapshots exist. */
  change: number | null;
  valueChange?: number | null;
  timingChange?: number | null;
  note?: string | null;
  /** "License issue date: — → 2026-08-28", recorded at this ingest. */
  facts?: string[];
};

export const signed = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(n)}`;

export function explainMove(m: Move): string[] {
  if (m.change === null)
    return ["Nothing to compare yet — one snapshot so far."];
  if (m.note) return [m.note];
  const facts = m.facts ?? [];
  const dValue = m.valueChange ?? 0;
  const dTiming = m.timingChange ?? 0;
  const lines: string[] = [];
  if (Math.abs(dValue) >= 0.05)
    lines.push(
      `Value ${signed(dValue)} — ${
        facts.length
          ? "a recorded fact changed"
          : dValue > 0
            ? "specialty, ownership or career stage moved up"
            : "specialty, ownership or career stage moved down"
      }`,
    );
  if (Math.abs(dTiming) >= 0.05)
    lines.push(
      `Timing ${signed(dTiming)} — ${
        dTiming > 0
          ? "a fresh event or licence date attached"
          : "the events aged; each loses half its value a year"
      }`,
    );
  if (lines.length === 0)
    lines.push(
      m.change === 0
        ? "No change — same facts, same score."
        : `Moved ${signed(m.change)} since the last data refresh.`,
    );
  return [...lines, ...facts];
}
