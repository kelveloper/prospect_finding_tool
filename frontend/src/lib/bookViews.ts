/**
 * Saved views for the book — a named set of filters you can come back to.
 *
 * Stored in localStorage rather than the URL. The book's filters live in
 * component state, so there is no query string to name; the view holds the
 * state itself. That also means a view survives a refresh without the URL
 * carrying four parameters an advisor never reads.
 *
 * A shareable-link version would need the filters serialized into the URL
 * first — worth doing, but a separate change.
 */

import { CHANGED_LABEL } from "./changes";

export const VIEWS_KEY = "telltale_book_views";

/** Everything a view restores. Kept flat so an older saved view missing a
 *  newer field still loads, with that filter simply off. */
export type BookViewState = {
  specialty: string;
  tier: string;
  location: string;
  /** "Why now" — the trigger label a row carries, or the quiet bucket for
   *  prospects with nothing recent. Absent on views saved before the book
   *  could filter on it, which reads as "any". */
  trigger?: string;
  query: string;
  /** Built-ins narrow the board in ways the filter controls cannot.
   *  `onlyNew` survives for views saved before the changed filter replaced
   *  it. */
  onlyNew?: boolean;
  onlyChanged?: boolean;
};

/* Views saved while the book still had column sorts carry `sort` and
   `fromBack`. Both are ignored now rather than migrated: the keys are inert
   in storage, and the view comes back filtered the same way, in rank order. */

export type SavedView = {
  id: string;
  name: string;
  state: BookViewState;
};

export const EMPTY_STATE: BookViewState = {
  specialty: "all",
  tier: "all",
  location: "all",
  trigger: "all",
  query: "",
  onlyNew: false,
  onlyChanged: false,
};

export function isEmpty(s: BookViewState): boolean {
  return (
    s.specialty === "all" &&
    s.tier === "all" &&
    (s.location ?? "all") === "all" &&
    (s.trigger ?? "all") === "all" &&
    s.query.trim() === "" &&
    !s.onlyNew &&
    !s.onlyChanged
  );
}

export function sameState(a: BookViewState, b: BookViewState): boolean {
  return (
    a.specialty === b.specialty &&
    a.tier === b.tier &&
    (a.location ?? "all") === (b.location ?? "all") &&
    (a.trigger ?? "all") === (b.trigger ?? "all") &&
    a.query.trim() === b.query.trim() &&
    !!a.onlyNew === !!b.onlyNew &&
    !!a.onlyChanged === !!b.onlyChanged
  );
}

/** "Chicago derms" beats "View 3", so the default name describes the filters
 *  rather than counting them. The advisor can overwrite it. */
export function describe(s: BookViewState): string {
  const parts: string[] = [];
  if (s.onlyChanged) parts.push(CHANGED_LABEL);
  if (s.onlyNew) parts.push("New arrivals");
  if (s.specialty !== "all") parts.push(s.specialty);
  if ((s.location ?? "all") !== "all") parts.push(s.location);
  if ((s.trigger ?? "all") !== "all") parts.push(s.trigger as string);
  if (s.tier !== "all")
    parts.push(s.tier.charAt(0).toUpperCase() + s.tier.slice(1));
  if (s.query.trim()) parts.push(`"${s.query.trim()}"`);
  return parts.join(" · ") || "Saved view";
}

/* ── Store ────────────────────────────────────────────────
   useSyncExternalStore rather than an effect: localStorage does not exist
   during the server render, and setting state from an effect on mount both
   trips react-hooks/set-state-in-effect and paints an empty row first. The
   snapshot is cached because getSnapshot must return a stable reference. */

let cache: SavedView[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: SavedView[] = [];

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): SavedView[] {
  if (cache === null) cache = loadViews();
  return cache;
}

/** The server has no storage, so it renders the built-in views only. */
function getServerSnapshot(): SavedView[] {
  return EMPTY;
}

export const viewStore = { subscribe, getSnapshot, getServerSnapshot };

/** Writes through to storage and wakes every subscriber. */
export function commitViews(views: SavedView[]): void {
  cache = views;
  saveViews(views);
  listeners.forEach((fn) => fn());
}

export function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything malformed is dropped rather than crashing the book.
    return parsed.filter(
      (v): v is SavedView =>
        typeof v === "object" &&
        v !== null &&
        "id" in v &&
        "name" in v &&
        "state" in v,
    );
  } catch {
    return [];
  }
}

export function saveViews(views: SavedView[]): void {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Private browsing can refuse storage. The view still applies for this
    // session; it just will not be remembered.
  }
}
