/**
 * What "changed since the last sweep" means, in one place.
 *
 * Every sweep re-scores everyone it re-fetches, so "updated" says nothing —
 * the honest question is who *moved*. A prospect counts as changed when
 * ingestion first found them in the last 48 hours (the NEW badge) or when
 * their score moved the last time it was recomputed. The unchanged majority
 * is the default view, never a filter of its own.
 */

type Changeable = { isNew: boolean; scoreChange: number | null };

export function changedSinceSweep(c: Changeable): boolean {
  return c.isNew || (c.scoreChange !== null && c.scoreChange !== 0);
}

export type ChangeSummary = {
  /** New arrivals plus movers — the size of the filtered list. */
  total: number;
  newCount: number;
  moved: number;
};

export function summarizeChanges(list: Changeable[]): ChangeSummary {
  let newCount = 0;
  let moved = 0;
  for (const c of list) {
    if (c.isNew) newCount++;
    else if (changedSinceSweep(c)) moved++;
  }
  return { total: newCount + moved, newCount, moved };
}

/** "1 new · 19 moved" — only the parts that are non-zero. */
export function describeChanges(s: ChangeSummary): string {
  const parts: string[] = [];
  if (s.newCount > 0) parts.push(`${s.newCount} new`);
  if (s.moved > 0) parts.push(`${s.moved} moved`);
  return parts.join(" · ");
}
