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
 * The right fix lives upstream: score_history.note exists to mark a
 * snapshot that did not come from the world moving, but only the rescore
 * CLI writes it — a sweep under a new formula leaves it null, which is
 * exactly the case this guard covers.
 */

type Changeable = { isNew: boolean; scoreChange: number | null };

/** This one prospect's score moved since the previous snapshot. */
function scoreMoved(c: Changeable): boolean {
  return c.scoreChange !== null && c.scoreChange !== 0;
}

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
