/**
 * What "changed since the last sweep" means, in one place.
 *
 * Every sweep re-scores everyone it re-fetches, so "updated" says nothing —
 * the honest question is who *moved*. A prospect counts as changed when
 * ingestion first found them in the last 48 hours (the NEW badge) or when
 * their score moved the last time it was recomputed. The unchanged majority
 * is the default view, never a filter of its own.
 *
 * The exception is a formula change. When the scoring model is replaced,
 * the next sweep rewrites every score in the same second — 221 of 221
 * "moved", none of them because anything happened to that doctor. Counting
 * that as news makes the filter match the whole book, which is a filter
 * that cannot filter. So a move that took nearly everyone is read as what
 * it is and left out of the count; genuine arrivals still show.
 *
 * That guard is a guess, and it guessed wrong: the Sep 10 rescore rewrote
 * all 221 scores but only 50 landed on a different number, because the rest
 * scored the same under both formulas. 23% is under the threshold, so fifty
 * prospects were reported as news when nothing had happened to any of them.
 *
 * So the note leads now — score_history.note marks a snapshot that did not
 * come from the world moving, it rides to the client on every row, and
 * scoreMoved reads it per prospect. The share guard stays underneath it for
 * the case it was written for: a sweep under a new formula, which leaves the
 * note null and would otherwise slip past unmarked.
 */

type Changeable = {
  isNew: boolean;
  scoreChange: number | null;
  scoreChangeNote: string | null;
};

/**
 * This one prospect's score moved, and the world is why.
 *
 * A snapshot written by a rescore carries a note saying so. Its delta is the
 * old formula measured against the new one — a change of ruler, not of
 * subject — so it is not a move. Reporting it as one tells an advisor a
 * doctor rose 17 points when all that rose was our own arithmetic.
 *
 * This is the exact signal, per prospect. The share guard below is the
 * backstop for a sweep that changes the formula without writing the note.
 */
export function scoreMoved(c: Changeable): boolean {
  return (
    c.scoreChange !== null &&
    Math.abs(c.scoreChange) >= MOVE_FLOOR &&
    c.scoreChangeNote === null
  );
}

/**
 * Below half a point, a score did not move — time passed.
 *
 * Timing decays on a half-life, so every prospect carrying a dated trigger
 * drifts down a little between sweeps whether or not anything happened to
 * them. The sweep of Sep 14 is the shape of it: twenty prospects moved by
 * exactly -0.1 and thirteen moved by 1.3 to 8.5. The first group is the
 * calendar; the second is the world.
 *
 * Printing the first as a red ▼ put a falling arrow on the top of the board
 * — the #1 prospect included — for a tenth of a point nobody can act on.
 * The board prints one decimal, so half a point is the smallest move worth
 * a reader's attention, and the gap between 0.1 and 1.3 is wide enough that
 * the line does not have to be exact to be right.
 */
export const MOVE_FLOOR = 0.5;

/** Above this share of the book, a move is the formula, not the world. */
const WHOLE_BOOK = 0.9;

export type ChangeSummary = {
  /** New arrivals plus movers — the size of the filtered list. */
  total: number;
  newCount: number;
  /** Movers worth showing; 0 when the whole book moved at once. */
  moved: number;
  /** A rescore rewrote the book, so movement is not news this time. */
  rescored: boolean;
};

export function summarizeChanges(list: Changeable[]): ChangeSummary {
  let newCount = 0;
  let moved = 0;
  for (const c of list) {
    if (c.isNew) newCount++;
    else if (scoreMoved(c)) moved++;
  }
  const rescored = list.length > 0 && moved >= list.length * WHOLE_BOOK;
  if (rescored) moved = 0;
  return { total: newCount + moved, newCount, moved, rescored };
}

/** The move worth reporting — zero when the delta was our arithmetic rather
 *  than the world, so "biggest risers" cannot be led by a rescore. */
export function realMove(c: Changeable): number {
  return scoreMoved(c) ? (c.scoreChange as number) : 0;
}

/** The test that matches what the summary counted — pass the summary so the
 *  list and the number beside it can never disagree. */
export function changeMatcher(s: ChangeSummary): (c: Changeable) => boolean {
  return s.rescored ? (c) => c.isNew : (c) => c.isNew || scoreMoved(c);
}

/** "New arrivals" or "New arrivals and movers" — what the filter will show. */
export function changeLabel(s: ChangeSummary): string {
  return s.moved > 0 ? "Only new or moved" : "Only new arrivals";
}

/** "1 new · 19 moved" — only the parts that are non-zero. */
export function describeChanges(s: ChangeSummary): string {
  const parts: string[] = [];
  if (s.newCount > 0) parts.push(`${s.newCount} new`);
  if (s.moved > 0) parts.push(`${s.moved} moved`);
  return parts.join(" · ");
}

/** The hover explanation, including why movement is being ignored. */
export function changeHint(s: ChangeSummary): string {
  const head = `${describeChanges(s)} since the last sweep`;
  return s.rescored
    ? `${head}. Every score also changed when the scoring formula was replaced — that moved the whole book at once, so it is not counted as news.`
    : head;
}
