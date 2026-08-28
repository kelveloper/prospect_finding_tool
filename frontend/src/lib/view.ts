/**
 * The scoreboard renders in one of two layouts, chosen from the nav bar.
 *
 * Like the featured candidate, the choice lives in the URL rather than in
 * component state: the page is a server component, so `?view=book` is what
 * lets a layout survive a refresh, a shared link, or a trip through a
 * candidate page and back.
 *
 * Client-safe — no `next/headers` here, so the toggle and the book can
 * share these names with the page that reads them.
 */
export const VIEW_PARAM = "view";

/** Detail panel beside the ranked list — the original scoreboard. */
export const BOARD_VIEW = "board";

/** Ledger spread; entries open in a slide-over instead of a fixed panel. */
export const BOOK_VIEW = "book";

export type BoardView = typeof BOARD_VIEW | typeof BOOK_VIEW;

/** Anything but an explicit `?view=book` stays on the board. */
export function parseView(value: string | undefined): BoardView {
  return value === BOOK_VIEW ? BOOK_VIEW : BOARD_VIEW;
}

/** Scoreboard href for a layout, carrying the open candidate across it. */
export function viewHref(view: BoardView, candidateId?: string | null): string {
  const params = new URLSearchParams();
  if (candidateId) params.set("id", candidateId);
  if (view === BOOK_VIEW) params.set(VIEW_PARAM, BOOK_VIEW);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
