import type { OutreachEntry } from "@/lib/data";

/** How a prospect's last logged outreach event reads on a list row.
 *
 *  The advisor's own work is the one thing on the board that did not come
 *  from a registry, and until now it was the one thing the board did not
 *  show: `outreach_status` has been computed on the backend and sent on
 *  every row since tracking was built, and nothing read it.
 *
 *  Kept apart from the past-tense history lines in OutreachActions on
 *  purpose. Those sit alone in a panel and can run long; these sit on the
 *  row's quiet second line, beside a specialty that is often longer than
 *  the cell, so "Couldn't reach them" becomes "No answer".
 */
export type WorkedState = {
  /** What the row prints. Short — it shares a line with the specialty. */
  label: string;
  /** Spelled out for the tooltip and for screen readers. */
  spoken: string;
  /** A win, not merely a closed line. Set in green rather than grey. */
  won: boolean;
  /** Off the call list, so the row recedes and the untouched ones stand out.
   *
   *  False for `not_connected` alone: a prospect who did not pick up is the
   *  one attempt that leaves them still worth calling, and fading them would
   *  let a single missed call quietly bury someone the advisor still means
   *  to reach. */
  settled: boolean;
};

const STATES: Record<OutreachEntry["eventType"], WorkedState> = {
  converted: {
    label: "✓ Client",
    spoken: "Became a client",
    won: true,
    settled: true,
  },
  connected: {
    label: "Spoke to them",
    spoken: "Spoke to them — outcome not logged yet",
    won: false,
    settled: true,
  },
  follow_up_later: {
    label: "Following up",
    spoken: "Spoke to them; following up later",
    won: false,
    settled: true,
  },
  not_connected: {
    label: "No answer",
    spoken: "Tried and couldn't reach them — still worth calling",
    won: false,
    settled: false,
  },
  not_converted: {
    label: "Not a fit",
    spoken: "Reached them; not a fit",
    won: false,
    settled: true,
  },
  not_pursued: {
    label: "Skipped",
    spoken: "Skipped without calling",
    won: false,
    settled: true,
  },
};

/** Null when nobody has touched this prospect — the ordinary case, and the
 *  one the row prints nothing for. */
export function workedState(
  status: OutreachEntry["eventType"] | null,
): WorkedState | null {
  return status ? (STATES[status] ?? null) : null;
}
