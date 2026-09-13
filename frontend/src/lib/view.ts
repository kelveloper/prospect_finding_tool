/**
 * The names the scoreboard's two layouts go by in the URL.
 *
 * The reader's actual position — layout, placement, open entry — is held in
 * lib/boardState and written here afterwards, which is what lets `?view=book`
 * survive a refresh, a shared link, or a trip through a prospect page and
 * back without a layout switch costing a server render.
 *
 * Client-safe — no `next/headers` here, so the toggle, the book and the page
 * that seeds them can all share these names.
 */
export const VIEW_PARAM = "view";

/** Who the reader is placed on. */
export const ID_PARAM = "id";

/** Detail panel beside the ranked list — the original scoreboard. */
export const BOARD_VIEW = "board";

/** Ledger spread; entries open in a slide-over instead of a fixed panel. */
export const BOOK_VIEW = "book";

export type BoardView = typeof BOARD_VIEW | typeof BOOK_VIEW;

/** Anything but an explicit `?view=book` stays on the board. */
export function parseView(value: string | undefined): BoardView {
  return value === BOOK_VIEW ? BOOK_VIEW : BOARD_VIEW;
}

/**
 * Book only: the entry whose detail panel is open.
 *
 * Placement and opening are deliberately two different things. `?id=` says
 * where the reader is — the board shows that prospect in its panel, the book
 * marks their line and turns to the spread it is printed on. `?entry=` is the
 * book's extra step of opening that line in full.
 *
 * The layout toggle carries placement and never the open panel, so switching
 * into the book lands on the spread you came to read rather than on a panel
 * covering it.
 */
export const ENTRY_PARAM = "entry";

/** Book href with one entry's panel open over the spread. */
export function entryHref(candidateId: string): string {
  const params = new URLSearchParams();
  params.set(VIEW_PARAM, BOOK_VIEW);
  params.set(ENTRY_PARAM, candidateId);
  return `/?${params.toString()}`;
}
