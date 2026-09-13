/**
 * Where the reader is on the scoreboard: which layout is open, who they are
 * placed on, and whether the book has that entry open in full.
 *
 * This is a store rather than component state because its readers do not
 * share a parent — the layout toggle is rendered into the header by the
 * server page, the board and the book render below it. That is why the
 * toggle used to be a plain `<Link>`, which made every layout switch a full
 * server round-trip: all ~1,200 ranked rows re-fetched and re-sent before
 * anything could repaint. Switching layouts is now local state, and the URL
 * is written afterwards so links stay shareable and back/forward still walk
 * the history — the same trick the board already used for `?id=`, extended
 * to cover the layout and the open entry too.
 *
 * Placement and opening are kept separate on purpose. Switching layouts is a
 * change of mode, not of record: placement travels across so the book turns
 * to the spread you were reading and marks the line, but the open panel is
 * left behind so the book lands on the spread rather than on a panel
 * covering it.
 */

import { useRef, useSyncExternalStore } from "react";
import {
  BOOK_VIEW,
  ENTRY_PARAM,
  ID_PARAM,
  VIEW_PARAM,
  parseView,
  type BoardView,
} from "./view";

export type BoardState = {
  layout: BoardView;
  /** Where the reader is placed. The board shows them in its panel; the book
   *  marks their line and turns to the spread they are printed on. */
  id: string | null;
  /** Book only: placement opened in full. Null leaves the spread clear. */
  entry: string | null;
};

/* ── Store ──────────────────────────────────────────────── */

/* The snapshot must be reference-stable between changes, so the state object
 * is replaced only when something actually changed. */
let current: BoardState | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  // Back/forward moves the URL without a reload, so the store follows it for
  // as long as anyone is listening.
  if (listeners.size === 0) window.addEventListener("popstate", readUrl);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) window.removeEventListener("popstate", readUrl);
  };
}

function snapshot(initial: BoardState): BoardState {
  if (current === null) current = initial;
  return current;
}

/** Current board state, seeded from what the server read out of the URL.
 *  Every reader passes the same seed, so the first client paint agrees with
 *  the server's. */
export function useBoardState(initial: BoardState): BoardState {
  // getServerSnapshot has to return the same reference each time it is
  // called, and a server component's props are re-created per render.
  const seed = useRef(initial);
  return useSyncExternalStore(
    subscribe,
    () => snapshot(seed.current),
    () => seed.current,
  );
}

/* ── URL ────────────────────────────────────────────────── */

/** The address this state is readable at. */
export function boardHref(state: BoardState): string {
  const params = new URLSearchParams();
  if (state.id) params.set(ID_PARAM, state.id);
  if (state.layout === BOOK_VIEW) {
    params.set(VIEW_PARAM, BOOK_VIEW);
    if (state.entry) params.set(ENTRY_PARAM, state.entry);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function readUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const layout = parseView(params.get(VIEW_PARAM) ?? undefined);
  commit(
    {
      layout,
      id: params.get(ID_PARAM),
      entry: layout === BOOK_VIEW ? params.get(ENTRY_PARAM) : null,
    },
    false,
  );
}

function commit(next: BoardState, push: boolean): void {
  current = next;
  if (push) window.history.pushState(null, "", boardHref(next));
  listeners.forEach((fn) => fn());
}

/* ── Actions ────────────────────────────────────────────── */

/** Switch layouts, carrying placement but never the open panel. */
export function setLayout(layout: BoardView): void {
  if (!current || current.layout === layout) return;
  commit({ layout, id: current.id, entry: null }, true);
}

/** Move the reader onto a prospect without opening the book's panel. */
export function setPlaced(id: string): void {
  if (!current || current.id === id) return;
  commit({ ...current, id }, true);
}

/** Book: open one entry in full over the spread. */
export function openEntry(id: string): void {
  if (!current) return;
  commit({ ...current, id, entry: id }, true);
}

/** Book: dismiss the panel, leaving the reader placed on that line. */
export function closeEntry(): void {
  if (!current || current.entry === null) return;
  commit({ ...current, entry: null }, true);
}
