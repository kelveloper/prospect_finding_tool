"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import FilterSelect from "./FilterSelect";
import { EvidenceChip, MovementChip, TriggerChip } from "./RowChips";
import { ChevronLeft, ChevronRight, CloseIcon } from "./icons";
import {
  changeHint,
  changeMatcher,
  realMove,
  scoreMoved,
  summarizeChanges,
} from "@/lib/changes";
import type { Candidate } from "@/lib/data";
import { tierStyle } from "@/lib/tier";
import { entryHref } from "@/lib/view";
import {
  commitViews,
  describe,
  EMPTY_STATE,
  isEmpty,
  sameState,
  viewStore,
  type BookViewState,
  type SavedView,
} from "@/lib/bookViews";

/** Entries per page; a spread shows two of them side by side. */
const PER_PAGE = 6;
const PER_SPREAD = PER_PAGE * 2;

/** How long a leaf takes to turn. Long enough to read as paper, short
 *  enough that reading ten spreads is not ten seconds of waiting. */
const FLIP_MS = 520;

/** One printed page: half a spread. */
type Page = { entries: Entry[]; number: number };

/** A leaf in motion, named by the spreads it is travelling between. */
type Flip = { from: number; to: number };

/** Rank is the board's own ordering, so it is stamped on before any filter
 *  runs — entry #4 stays #4 on a page of four. */
type Entry = Candidate & { rank: number };

/** Tier reads best by quality, never alphabetically. */
const TIER_ORDER = ["strong", "promising", "neutral", "weak", "poor"];

/** Prospects with nothing recent are a real answer to "why now", not the
 *  absence of one — they are exactly who the "Quiet prospects first" sort
 *  is for. Giving them a bucket makes them reachable by filter too. */
const QUIET = "No recent event";

/** Every column an entry prints, orderable both ways. A ledger has no
 *  "ascending" — it has a front and a back, so the flip is worded that way
 *  and each field says what its two ends mean. */
const SORTS = {
  rank: {
    // The board is ranked by fit score, so this is both orderings at once —
    // named for both so neither reader goes looking for a missing option.
    label: "Rank / fit score",
    front: "Best first",
    back: "Lowest first",
    cmp: (a: Entry, b: Entry) => a.rank - b.rank,
  },
  evidence: {
    label: "Evidence",
    front: "Best evidenced first",
    back: "Thinnest first",
    cmp: (a: Entry, b: Entry) =>
      b.evidence.found - a.evidence.found || a.rank - b.rank,
  },
  tier: {
    label: "Tier",
    front: "Strong first",
    back: "Poor first",
    cmp: (a: Entry, b: Entry) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
      a.rank - b.rank,
  },
  movement: {
    label: "Movement",
    front: "Biggest risers",
    back: "Biggest fallers",
    cmp: (a: Entry, b: Entry) => realMove(b) - realMove(a) || a.rank - b.rank,
  },
  name: {
    label: "Name",
    front: "A–Z",
    back: "Z–A",
    cmp: (a: Entry, b: Entry) => a.name.localeCompare(b.name),
  },
  specialty: {
    label: "Specialty",
    front: "A–Z",
    back: "Z–A",
    cmp: (a: Entry, b: Entry) =>
      a.specialty.localeCompare(b.specialty) || a.rank - b.rank,
  },
  trigger: {
    label: "Why now",
    front: "Most recent events first",
    back: "Quiet prospects first",
    // Rank keeps the order stable inside each group.
    cmp: (a: Entry, b: Entry) =>
      Number(!!b.trigger) - Number(!!a.trigger) ||
      (a.trigger?.label ?? "").localeCompare(b.trigger?.label ?? "") ||
      a.rank - b.rank,
  },
  location: {
    label: "Location",
    front: "A–Z",
    back: "Z–A",
    cmp: (a: Entry, b: Entry) =>
      a.location.localeCompare(b.location) || a.rank - b.rank,
  },
} as const;

type SortKey = keyof typeof SORTS;

type Props = {
  ranked: Candidate[];
  /** Where the reader is placed: the line is marked and the book opens on
   *  the spread it is printed on. Being placed does not open the panel. */
  placedId: string | null;
  /** Open one entry in full over the spread. */
  onOpen: (id: string) => void;
};

/** The board read as a ledger: ranked entries laid out on facing pages you
 *  turn, one line each. Picking a line opens it in the slide-over — the
 *  reading list stays put underneath, and closing it leaves the reader on
 *  that line rather than back at the top.
 *
 *  Which spread is open is the only local state. It is paired with the entry
 *  the reader was placed on when the page was turned, so placement arriving
 *  from somewhere else — a shared link, or the layout toggle carrying the
 *  board's featured prospect over — turns to the page that entry is printed
 *  on and marks the line. From there the page-turn buttons take over again. */
export default function BookView({ ranked, placedId, onOpen }: Props) {
  const [specialty, setSpecialty] = useState("all");
  const [tier, setTier] = useState("all");
  const [location, setLocation] = useState("all");
  const [trigger, setTrigger] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");
  const [fromBack, setFromBack] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  // A native <details> only closes from its own summary, so an open column
  // menu followed the advisor around the page. Close on any click outside one,
  // and on Escape. Done against the DOM rather than React state because the
  // open flag belongs to the element — mirroring it would be a second source
  // of truth to keep in step.
  useEffect(() => {
    const menus = () =>
      document.querySelectorAll<HTMLDetailsElement>(
        'details[name="book-column-menu"][open]',
      );

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('details[name="book-column-menu"]')
      ) {
        return;
      }
      menus().forEach((menu) => (menu.open = false));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = menus();
      if (open.length === 0) return;
      // Put focus back where it came from, so Escape does not strand it.
      open.forEach((menu) => {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      });
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /** null = not naming; "" = naming a new view; an id = renaming that one. */
  const [naming, setNaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const views = useSyncExternalStore(
    viewStore.subscribe,
    viewStore.getSnapshot,
    viewStore.getServerSnapshot,
  );

  const viewState: BookViewState = useMemo(
    () => ({
      specialty,
      tier,
      location,
      trigger,
      query,
      onlyNew,
      onlyChanged,
      sort,
      fromBack,
    }),
    [
      specialty,
      tier,
      location,
      trigger,
      query,
      onlyNew,
      onlyChanged,
      sort,
      fromBack,
    ],
  );

  function applyState(next: BookViewState) {
    setSpecialty(next.specialty ?? "all");
    setTier(next.tier ?? "all");
    setLocation(next.location ?? "all");
    setTrigger(next.trigger ?? "all");
    setQuery(next.query ?? "");
    setOnlyNew(!!next.onlyNew);
    setOnlyChanged(!!next.onlyChanged);
    setSort(
      ((next.sort as SortKey) ?? "rank") in SORTS
        ? (next.sort as SortKey)
        : "rank",
    );
    setFromBack(!!next.fromBack);
    setTurned({ spread: 0, forPlacement: placedId });
  }

  /** Opens the name field, seeded with a description of the filters. The
   *  advisor almost always wants "My Chicago derms", not the machine's
   *  "Dermatology · Promising". */
  function startNaming(target: string) {
    setNaming(target);
    setDraftName(
      target === ""
        ? describe(viewState)
        : (views.find((v) => v.id === target)?.name ?? ""),
    );
  }

  function commitName() {
    const name = draftName.trim() || describe(viewState);

    if (naming === "") {
      const view: SavedView = {
        // The state is the id: saving is only offered when no stored view
        // already matches it, so this is unique by construction — and unlike
        // a timestamp it is pure, and stable across reloads.
        id: JSON.stringify(viewState),
        name,
        state: viewState,
      };
      commitViews([...views, view]);
    } else if (naming) {
      commitViews(views.map((v) => (v.id === naming ? { ...v, name } : v)));
    }

    setNaming(null);
  }

  function removeView(id: string) {
    commitViews(views.filter((v) => v.id !== id));
  }

  // Stamped before filtering so a filtered page still prints true board ranks.
  const entries: Entry[] = useMemo(
    () => ranked.map((c, i) => ({ ...c, rank: i + 1 })),
    [ranked],
  );
  const changes = useMemo(() => summarizeChanges(entries), [entries]);
  // Same summary drives the chip's count and the rows it selects, so a
  // formula-wide rescore cannot make this chip claim the whole book.
  const isChanged = useMemo(() => changeMatcher(changes), [changes]);

  /** Does this entry belong in a book filtered to `state`?
   *
   *  One predicate, shared by the spread and by the count on every saved-view
   *  chip. They used to be two hand-copied chains, and the copy had already
   *  fallen behind: it never learned about location, so a view saved on a
   *  city counted the whole book at itself — "Saint Louis, MO · 221". It
   *  would not have learned about "why now" either. */
  const matches = useCallback(
    (state: BookViewState) => {
      const q = (state.query ?? "").trim().toLowerCase();
      return (e: Entry) =>
        (!state.onlyNew || e.isNew) &&
        (!state.onlyChanged || isChanged(e)) &&
        (state.specialty === "all" || e.specialty === state.specialty) &&
        ((state.location ?? "all") === "all" ||
          e.location === state.location) &&
        ((state.trigger ?? "all") === "all" ||
          (e.trigger?.label ?? QUIET) === state.trigger) &&
        (state.tier === "all" || e.tier === state.tier) &&
        (q === "" ||
          e.name.toLowerCase().includes(q) ||
          e.specialty.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q));
    },
    [isChanged],
  );

  /** Commonest first, so the value that matches most of the board is the
   *  first thing you see. Ties fall back to alphabetical. */
  const optionsFor = useMemo(
    () => (pick: (e: Entry) => string) => {
      const counts = new Map<string, number>();
      for (const entry of entries) {
        const key = pick(entry);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [
        { value: "all", count: entries.length },
        ...[...counts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      ];
    },
    [entries],
  );

  const specialties = useMemo(
    () => optionsFor((e) => e.specialty),
    [optionsFor],
  );
  const locations = useMemo(() => optionsFor((e) => e.location), [optionsFor]);
  const triggers = useMemo(
    () => optionsFor((e) => e.trigger?.label ?? QUIET),
    [optionsFor],
  );
  /** Tier keeps quality order rather than frequency — strong to poor reads
   *  as a scale, and shuffling it by count would break that. */
  const tiers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.tier, (counts.get(entry.tier) ?? 0) + 1);
    }
    return [
      { value: "all", count: entries.length },
      ...TIER_ORDER.filter((t) => counts.has(t)).map((t) => ({
        value: t as string,
        count: counts.get(t) ?? 0,
      })),
    ];
  }, [entries]);

  const shown = useMemo(
    () =>
      entries.filter(matches(viewState)).sort((a, b) => {
        // A prospect that has not moved is no more a faller than a riser, so
        // it sits after everything that has moved — whichever end we read
        // from. Parking therefore has to survive the flip, not invert with it.
        if (sort === "movement") {
          const am = realMove(a);
          const bm = realMove(b);
          if ((am === 0) !== (bm === 0)) return am === 0 ? 1 : -1;
        }
        return SORTS[sort].cmp(a, b) * (fromBack ? -1 : 1);
      }),
    [entries, matches, viewState, sort, fromBack],
  );

  /** Clicking a menu entry both picks the column and sets which end to read
   *  from, so one call covers what were two controls. */
  const setOrder = (key: SortKey, back: boolean) => {
    setSort(key);
    setFromBack(back);
  };

  /** Nothing to save when the filters are empty, already stored, or exactly
   *  one of the built-in chips. */
  const saveBlockedBecause = isEmpty(viewState)
    ? "Nothing to save yet — filter or re-order the book first, then save that as a view you can come back to."
    : sameState(viewState, { ...EMPTY_STATE, onlyChanged: true })
      ? "This is already the What changed view."
      : (views.find((v) => sameState(viewState, v.state))?.name ?? null);

  /** After a single ingest there is nothing to compare against, so the column
   *  prints "no change yet" on all but a stray row or two. One mover out of
   *  219 does not earn a column and a header; the cutoff is a twentieth of the
   *  board, below which the column is 95% identical text. */
  const hasMovement = useMemo(() => {
    if (entries.length === 0) return false;
    // Movement is the whole point of the What changed view, so it always
    // earns the column there
    if (onlyChanged) return true;
    // Same test as the What changed count, so the column cannot appear for
    // movement the board has decided is not movement.
    const moved = entries.filter(scoreMoved).length;
    return moved / entries.length >= 0.05;
  }, [entries, onlyChanged]);

  const filtered = !isEmpty(viewState);
  /** How many controls are actually narrowing the book — what Reset undoes.
   *  Order is not a filter, so it is not counted; the button still restores
   *  it, which is why it can be live with nothing here to show. */
  const narrowing =
    (specialty !== "all" ? 1 : 0) +
    (location !== "all" ? 1 : 0) +
    (trigger !== "all" ? 1 : 0) +
    (tier !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0) +
    (onlyNew ? 1 : 0) +
    (onlyChanged ? 1 : 0);
  /* The same thing the "Whole book" chip does, and deliberately the same
     call: this used to reset each filter by hand, so every filter added to
     the book was one more chance to leave Reset behind — which is exactly
     what happened when "Why now" arrived. EMPTY_STATE is the one list. */
  const clear = () => applyState(EMPTY_STATE);

  const spreadCount = Math.max(1, Math.ceil(shown.length / PER_SPREAD));
  const placedIndex = placedId ? shown.findIndex((c) => c.id === placedId) : -1;
  const placedSpread =
    placedIndex >= 0 ? Math.floor(placedIndex / PER_SPREAD) : null;
  const [turned, setTurned] = useState<{
    spread: number;
    forPlacement: string | null;
  }>(() => ({ spread: placedSpread ?? 0, forPlacement: placedId }));

  // A turn is two states: which spread is showing (immediate, so the footer
  // and the underlying pages are already correct) and the leaf still in the
  // air on top of it.
  const [flip, setFlip] = useState<Flip | null>(null);
  const [turning, setTurning] = useState(false);

  const turnTo = (next: number) => {
    const target = Math.max(0, Math.min(next, spreadCount - 1));
    if (target === current) return;
    setTurned({ spread: target, forPlacement: placedId });
    // Nothing to animate under reduced motion, and nothing to animate on a
    // stacked one-column layout either — there is no spine to turn about.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlip({ from: current, to: target });
    setTurning(false);
  };

  // Mount the leaf flat against the page, then start it turning on the next
  // frame so the transition has somewhere to travel from.
  useEffect(() => {
    if (!flip) return;
    const frame = requestAnimationFrame(() => setTurning(true));
    const landed = setTimeout(() => setFlip(null), FLIP_MS + 40);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(landed);
    };
  }, [flip]);
  const spread =
    placedSpread !== null && placedId !== turned.forPlacement
      ? placedSpread
      : turned.spread;
  const current = Math.min(spread, spreadCount - 1);
  const start = current * PER_SPREAD;
  const onSpread = shown.slice(start, start + PER_SPREAD);

  const pageAt = (spreadIndex: number, side: 0 | 1): Page => {
    const from = spreadIndex * PER_SPREAD;
    const on = shown.slice(from, from + PER_SPREAD);
    return {
      entries: side === 0 ? on.slice(0, PER_PAGE) : on.slice(PER_PAGE),
      number: spreadIndex * 2 + 1 + side,
    };
  };

  // While a leaf is turning, the spread underneath is a hybrid: the half the
  // leaf has lifted away from already shows the page being turned to, so the
  // new page is revealed by the turn instead of appearing after it.
  const forward = flip ? flip.to > flip.from : false;
  const pages: Page[] = !flip
    ? [pageAt(current, 0), pageAt(current, 1)]
    : forward
      ? [pageAt(flip.from, 0), pageAt(flip.to, 1)]
      : [pageAt(flip.to, 0), pageAt(flip.from, 1)];

  // The leaf itself carries the page being turned on its front and the one
  // arriving on its back, exactly as a sheet of paper does.
  const leaf = flip
    ? {
        side: (forward ? 1 : 0) as 0 | 1,
        front: forward ? pageAt(flip.from, 1) : pageAt(flip.from, 0),
        back: forward ? pageAt(flip.to, 0) : pageAt(flip.to, 1),
      }
    : null;

  /** A page's own frame. The left page carries the fold. */
  const pageClass = (i: number) =>
    "flex min-h-[420px] flex-col px-6 py-6 sm:px-8 " +
    (i === 0 ? "border-b border-hairline/60 lg:border-b-0 lg:border-r" : "");

  /* What is printed on a page. Pulled out so the turning leaf can carry a
     real page on each of its faces — the illusion only holds if the thing
     rotating is the same thing that settles. */
  const pageContent = (page: Page, i: number) => (
    <>
      {page.entries.length > 0 ? (
        <>
          {/* Column headings, printed on each page like a ledger's.
                      Widths mirror BookEntry exactly, responsive rules and
                      all, so a heading always sits over its own column.

                      Ordering only. Filtering lives in one place — the row
                      of quick filters above — because a dimension you can
                      set from two controls is a dimension you have to go
                      looking for in two places. */}
          <div className="-mx-2 flex items-start gap-3 border-b border-hairline/60 px-2 pb-2">
            <span className="w-6 shrink-0">
              <span title="Rank on the board, by fit score" className="eyebrow">
                #
              </span>
            </span>
            <span className="size-9 shrink-0" />
            {/* Two heads, because the cell prints two facts and either can
                order the book. They stack rather than sharing a menu: a
                reader looking to sort by city should not have to open one
                labelled "Specialty" to find it. */}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <ColumnMenu
                sortKey="specialty"
                heading="Specialty"
                hint="What they practice."
                activeSort={sort}
                fromBack={fromBack}
                onSort={setOrder}
              />
              <ColumnMenu
                sortKey="location"
                heading="Location"
                hint="Where they practice."
                activeSort={sort}
                fromBack={fromBack}
                onSort={setOrder}
              />
            </span>
            <span className="hidden w-[104px] shrink-0 lg:block">
              <ColumnMenu
                sortKey="trigger"
                heading="Why now"
                hint="The most recent event worth calling about — a new license, a practice, a property purchase."
                activeSort={sort}
                fromBack={fromBack}
                onSort={setOrder}
              />
            </span>
            <span className="hidden w-[86px] shrink-0 md:block">
              <ColumnMenu
                sortKey="evidence"
                heading="Evidence"
                hint="How many of the seven signals we look for were actually found for this prospect."
                activeSort={sort}
                fromBack={fromBack}
                onSort={setOrder}
              />
            </span>
            {hasMovement ? (
              <span className="hidden w-[78px] shrink-0 text-right md:block">
                <ColumnMenu
                  sortKey="movement"
                  heading="Move"
                  hint="How the fit score has changed since the last data refresh."
                  align="right"
                  activeSort={sort}
                  fromBack={fromBack}
                  onSort={setOrder}
                />
              </span>
            ) : null}
            <span className="w-[104px] shrink-0">
              <ColumnMenu
                sortKey="tier"
                heading="Fit"
                hint="Fit — value × how fresh the trigger is — and the band it falls in by standing. The board is ranked by it."
                align="right"
                activeSort={sort}
                fromBack={fromBack}
                onSort={setOrder}
              />
            </span>
          </div>

          <div className="mt-1 flex-1">
            {page.entries.map((entry) => (
              <BookEntry
                key={entry.id}
                candidate={entry}
                rank={entry.rank}
                placed={entry.id === placedId}
                onOpen={() => onOpen(entry.id)}
                showMovement={hasMovement}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          {shown.length === 0 && i === 0 ? (
            <span>
              <p className="font-display text-[15px] font-semibold text-ink">
                No entries match
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Nothing on the board fits these filters.
              </p>
              <button
                type="button"
                onClick={clear}
                // The same action as the toolbar's, so it carries the same
                // cross — one affordance, said twice. Solid rather than
                // outlined only because here it is the way out of an empty
                // page, not one control among several.
                className="mt-4 inline-flex items-center gap-1.5 rounded-[8px] bg-brand py-2 pl-3.5 pr-4 font-display text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
              >
                <CloseIcon className="size-3.5 shrink-0" />
                Reset the book
              </button>
            </span>
          ) : (
            <p className="text-[13px] text-ink-faint">End of the book</p>
          )}
        </div>
      )}

      <p
        className={
          "mt-6 font-display text-[11px] font-semibold text-ink-faint tabular-nums " +
          (i === 0 ? "text-left" : "text-right")
        }
      >
        {page.number}
      </p>
    </>
  );

  return (
    <main className="mx-auto max-w-[1560px] px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Prospect Ledger</p>
          <h1 className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
            The Book
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Every prospect on the board, printed in rank order. Open a line to
            read the full entry beside it.
          </p>
        </div>
      </div>

      {/* ── The open book ──────────────────────────────── */}
      <div className="relative mt-6 overflow-hidden rounded-[16px] bg-white shadow-panel ring-1 ring-hairline/60">
        {/* ── Front matter: how the book is indexed ──── */}
        <div className="border-b border-hairline/60 bg-canvas px-6 py-4 sm:px-8">
          {/* ── The four an advisor actually narrows by ──────
              Specialty, location, why now and fit, out in the open rather
              than tucked inside the column menus below — those are where
              you go to re-order the book, which is not where anyone looks
              to filter it. Search covers everything else. Both controls
              write the same state, so a column menu and this row can never
              disagree. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow w-[104px] shrink-0">Quick filters</span>
            <FilterSelect
              label="Specialty"
              value={specialty}
              options={specialties}
              onValue={setSpecialty}
              title="Show only prospects practising this"
            />
            <FilterSelect
              label="Location"
              value={location}
              options={locations}
              onValue={setLocation}
              title="Show only prospects practising here"
            />
            <FilterSelect
              label="Why now"
              value={trigger}
              options={triggers}
              onValue={setTrigger}
              title="Show only prospects carrying this trigger"
            />
            <FilterSelect
              label="Fit"
              value={tier}
              options={tiers}
              onValue={setTier}
              title="Show only prospects in this band"
              format={(t) => t.charAt(0).toUpperCase() + t.slice(1)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-hairline/60 pt-3">
            {/* Label beside the field, not stacked above it. */}
            {/* Grows to fill the strip rather than sitting at a fixed 200px.
                Matching the pill row's width instead would drift the moment
                a saved filter is added or a count changes digits. */}
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <span className="eyebrow w-[104px] shrink-0">Search by</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, specialty or city"
                className="w-full min-w-0 rounded-[8px] border border-hairline bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
            </label>

            {/* Saved views live here rather than in a row of their own:
                they are whole filter sets, so they belong beside the search
                and the reset that act on the same state — not above the
                controls they stand in for. "What changed" is the one that
                turns the board from a database into a morning routine. */}
            <div className="flex flex-wrap items-center gap-2">
              {/* New arrivals and movers together; absent when the last
                sweep changed nothing, since there is nothing to show */}
              {changes.total > 0 ? (
                <ViewChip
                  label="What changed"
                  count={changes.total}
                  active={
                    onlyChanged &&
                    specialty === "all" &&
                    tier === "all" &&
                    !query.trim()
                  }
                  onClick={() =>
                    applyState({ ...EMPTY_STATE, onlyChanged: true })
                  }
                  title={changeHint(changes)}
                />
              ) : null}

              {views.map((view) => (
                <ViewChip
                  key={view.id}
                  label={view.name}
                  count={entries.filter(matches(view.state)).length}
                  active={sameState(viewState, view.state)}
                  onClick={() => applyState(view.state)}
                  onRemove={() => removeView(view.id)}
                  title={`Saved filter — ${describe(view.state)}`}
                />
              ))}

              {/* The dashed chip is the shape of what you get, sitting where it
                will appear — a Save button parked among the controls said
                nothing about the result. */}
              {naming !== null ? (
                <span className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName();
                      if (e.key === "Escape") setNaming(null);
                    }}
                    aria-label="Name for this filter"
                    placeholder="Name this filter"
                    maxLength={40}
                    className="w-[168px] rounded-full border border-brand bg-white px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={commitName}
                    className="rounded-full bg-brand px-3 py-1.5 font-display text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setNaming(null)}
                    className="px-1 font-display text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => startNaming("")}
                  disabled={saveBlockedBecause !== null}
                  title={
                    saveBlockedBecause === null
                      ? "Name these filters and keep them here"
                      : saveBlockedBecause.startsWith("Nothing to save") ||
                          saveBlockedBecause.startsWith("This is already")
                        ? saveBlockedBecause
                        : `These filters are already saved as "${saveBlockedBecause}".`
                  }
                  className="rounded-full border border-hairline px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:border-brand hover:bg-white disabled:cursor-not-allowed disabled:border-hairline/60 disabled:text-ink-faint disabled:hover:bg-transparent"
                >
                  {/* One label at one width. It used to swap between a
                    20-character invitation and a 27-character instruction,
                    so the whole strip reflowed as you filtered — and the
                    widest thing in the row was the one you could not click.
                    Why it is disabled is a job for the tooltip. */}
                  + Save filter
                </button>
              )}
            </div>

            {/* The group carries the auto margin — pinning Reset to the
                right edge, so it stays put as the row reflows. */}
            <div className="ml-auto flex items-center gap-2">
              {/* Kept mounted and dimmed rather than removed: a button that
                  vanishes takes its width with it, and everything beside it
                  moves. */}
              <button
                type="button"
                onClick={clear}
                disabled={!filtered}
                title={
                  !filtered
                    ? "Nothing to reset — the whole book is showing"
                    : narrowing > 0
                      ? `Clear ${narrowing} ${narrowing === 1 ? "filter" : "filters"} and go back to the whole book`
                      : "Put the book back in rank order"
                }
                // Next to "+ Save filter" this was the same white bordered
                // control in the same weight — only the corners differed, and
                // nobody reads corners. The cross says it takes something
                // away, and the count says how much, so the pair now reads as
                // add-one against clear-these rather than as two buttons.
                className="flex items-center gap-1.5 rounded-[8px] border border-hairline bg-white py-1.5 pl-2.5 pr-3 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-hairline/50 disabled:text-ink-faint disabled:hover:bg-white"
              >
                <CloseIcon className="size-3 shrink-0" />
                Reset the book
                {narrowing > 0 ? (
                  <span className="rounded-full bg-surface-tint px-1.5 py-px text-[11px] tabular-nums text-brand-dark">
                    {narrowing}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        {/* The spread, and the leaf turning above it. Perspective sits here
            rather than on the card so the turn has depth without the
            toolbar and the page-turn footer sharing its 3D space. */}
        <div
          // Clipped, because a lifted page projects larger than the half it
          // occupies flat — without this the turn spills over the toolbar
          // above and the page-turn footer below.
          className="relative overflow-hidden"
          style={{ perspective: "2200px" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {pages.map((page, i) => (
              <section
                key={page.number}
                aria-label={`Page ${page.number}`}
                className={pageClass(i)}
              >
                {pageContent(page, i)}
              </section>
            ))}
          </div>

          {/* Gutter shading — the fold where the two pages meet. Scoped to
              the spread, not the card: hung on the card it ran the full
              height, creasing the toolbar above and the page-turn footer
              below, neither of which is paper. Left under the leaf's z-20,
              so a page in the air is not printed through by the fold. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-12 -translate-x-1/2 lg:block"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgb(var(--shadow-ink) / 0.08), transparent)",
            }}
          />

          {/* ── The turning leaf ──────────────────────────
            On screen only while a page is in the air. It is the spread's
            own half, hinged at the spine: the page you are leaving on the
            front, the page you are turning to on the back. Hidden from
            assistive tech and from the pointer — both already have the
            settled spread underneath, and below `lg` the book is a single
            column with no spine to turn about. */}
          {leaf ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-20 hidden w-1/2 lg:block"
              style={{
                left: leaf.side === 1 ? "50%" : 0,
                transformStyle: "preserve-3d",
                transformOrigin:
                  leaf.side === 1 ? "left center" : "right center",
                transform: `rotateY(${turning ? (leaf.side === 1 ? -180 : 180) : 0}deg)`,
                transition: `transform ${FLIP_MS}ms cubic-bezier(0.36, 0.03, 0.24, 1)`,
              }}
            >
              <LeafFace i={leaf.side} className={pageClass(leaf.side)}>
                {pageContent(leaf.front, leaf.side)}
              </LeafFace>
              {/* The back of a sheet faces the other way: pre-rotated, so it
                is only readable once the leaf has passed the spine. */}
              <LeafFace
                i={leaf.side === 1 ? 0 : 1}
                className={pageClass(leaf.side === 1 ? 0 : 1)}
                flipped
              >
                {pageContent(leaf.back, leaf.side === 1 ? 0 : 1)}
              </LeafFace>
            </div>
          ) : null}
        </div>

        {/* ── Page turn ────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-4 border-t border-hairline/60 bg-canvas px-6 py-3">
          <div className="flex shrink-0 items-center gap-1.5">
            <PageEnd
              direction="first"
              disabled={current === 0}
              onClick={() => turnTo(0)}
            />
            <PageTurn
              direction="back"
              disabled={current === 0}
              onClick={() => turnTo(current - 1)}
            />
          </div>
          <p className="text-center text-[12px] text-ink-muted">
            <span className="font-display font-semibold text-ink">
              Spread {current + 1} of {spreadCount}
            </span>
            {onSpread.length > 0 ? (
              <span className="hidden sm:inline">
                {" "}
                · entries {start + 1}–{start + onSpread.length} of{" "}
                {shown.length}
              </span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <PageTurn
              direction="forward"
              disabled={current >= spreadCount - 1}
              onClick={() => turnTo(current + 1)}
            />
            <PageEnd
              direction="last"
              disabled={current >= spreadCount - 1}
              onClick={() => turnTo(spreadCount - 1)}
            />
          </div>
        </footer>
      </div>
    </main>
  );
}

/** One column heading. The caret opens an Excel-style menu: sort both ways,
 *  Ordering only — filtering moved out to the quick filters above the book,
 *  so a dimension has one home rather than two. Native <details>, so no
 *  open/close state and the keyboard works for free. */
function ColumnMenu({
  sortKey,
  heading,
  hint,
  align = "left",
  activeSort,
  fromBack,
  onSort,
}: {
  sortKey: SortKey;
  heading: string;
  /** Plain-English meaning — a column head is a label, not an explanation. */
  hint?: string;
  align?: "left" | "right";
  activeSort: SortKey;
  fromBack: boolean;
  onSort: (key: SortKey, back: boolean) => void;
}) {
  const active = activeSort === sortKey;
  const sort = SORTS[sortKey];

  return (
    <details
      // Shared name makes these an exclusive accordion: opening one column's
      // menu closes whichever was open, across both pages, with no state.
      name="book-column-menu"
      className="group/menu relative"
    >
      <summary
        title={
          (hint ? `${heading} — ${hint}` : `Sort or filter by ${heading}`) +
          (active
            ? `\n\nSorting by this, ${fromBack ? SORTS[sortKey].back : SORTS[sortKey].front}.`
            : "")
        }
        className={
          "flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden " +
          (align === "right" ? "justify-end" : "")
        }
      >
        <span
          className="eyebrow"
          // A filtered column prints the value it is filtered to, so the
          // heading answers "what is hiding rows?" without being opened.
          style={active ? { color: "var(--color-brand)" } : undefined}
        >
          {heading}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={
            "size-3 shrink-0 transition-transform " +
            (active
              ? fromBack
                ? "text-brand"
                : "rotate-180 text-brand"
              : "group-open/menu:rotate-180 " + "text-ink-faint")
          }
        >
          <path
            d="M3 4.5 6 8l3-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div
        className={
          "absolute z-20 mt-1 w-[248px] rounded-[10px] border border-hairline bg-white p-1.5 shadow-panel " +
          (align === "right" ? "right-0" : "left-0")
        }
      >
        <button
          type="button"
          onClick={() => onSort(sortKey, false)}
          className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink hover:bg-canvas"
        >
          <span aria-hidden className="w-3 text-brand">
            {active && !fromBack ? "✓" : ""}
          </span>
          {sort.front}
        </button>
        <button
          type="button"
          onClick={() => onSort(sortKey, true)}
          className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink hover:bg-canvas"
        >
          <span aria-hidden className="w-3 text-brand">
            {active && fromBack ? "✓" : ""}
          </span>
          {sort.back}
        </button>
      </div>
    </details>
  );
}

/** A saved-view tab. Carries its own count so the advisor can see how much
 *  a view narrows the board before opening it. */
function ViewChip({
  label,
  count,
  active,
  onClick,
  onRemove,
  onRename,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  /** Saved views can be renamed; the built-ins cannot. */
  onRename?: () => void;
  title: string;
}) {
  const empty = count === 0 && !active;
  return (
    // One rounded shape, not two. The button used to carry its own
    // rounded-full inside the wrapper's, and nested radii at slightly
    // different sizes read as a double edge. overflow-hidden lets the
    // children square off and be clipped by the wrapper instead.
    <span
      className={
        "inline-flex items-center overflow-hidden rounded-full border transition-colors " +
        (active
          ? "border-brand bg-brand text-white"
          : "border-hairline bg-white text-ink-muted hover:bg-surface-soft")
      }
    >
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onRename}
        // A view holding nothing leads to an empty book, so it says so
        // rather than offering the same click as the views that hold
        // something. Still readable — it is a count worth knowing.
        disabled={empty}
        title={empty ? `${title} — none right now` : title}
        aria-pressed={active}
        className={
          "max-w-[210px] truncate py-1.5 font-display text-[12px] font-semibold " +
          (empty ? "cursor-not-allowed opacity-55 " : "") +
          // Symmetric unless a remove button follows, which supplies the
          // right-hand padding itself.
          (onRemove ? "pl-3 pr-1.5" : "px-3")
        }
      >
        {label}{" "}
        <span className={active ? "text-white/70" : "text-ink-faint"}>
          · {count}
        </span>
      </button>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          title={`Forget the "${label}" filter`}
          aria-label={`Forget the ${label} filter`}
          className={
            "rounded-full py-1.5 pr-3 pl-1 font-display text-[13px] leading-none " +
            (active
              ? "text-white/70 hover:text-white"
              : "text-ink-faint hover:text-tier-poor")
          }
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

/** One side of the turning leaf.
 *
 *  Opaque, because a leaf is paper and you must not read the spread through
 *  it, and backface-hidden, so each face is only visible while it is the one
 *  pointing at the reader. The shading is what sells it: a page catches less
 *  light towards the spine it is hinged on, and more of it the further the
 *  leaf stands off the book. */
function LeafFace({
  i,
  className,
  flipped,
  children,
}: {
  /** Which half of the spread this face is printed as. */
  i: 0 | 1;
  className: string;
  /** The far side of the sheet, pre-rotated so it reads only past the fold. */
  flipped?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-white"
      style={{
        backfaceVisibility: "hidden",
        transform: flipped ? "rotateY(180deg)" : undefined,
        // A lifted sheet throws a shadow on the page it is leaving.
        boxShadow: "0 18px 44px rgb(var(--shadow-ink) / 0.22)",
      }}
    >
      <div className={className + " h-full"}>{children}</div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            i === 0
              ? "linear-gradient(270deg, rgb(var(--shadow-ink) / 0.10), transparent 42%)"
              : "linear-gradient(90deg, rgb(var(--shadow-ink) / 0.10), transparent 42%)",
        }}
      />
    </div>
  );
}

/** One printed line: rank, who they are, tier, fit. */
function BookEntry({
  candidate,
  rank,
  placed,
  onOpen,
  showMovement,
}: {
  candidate: Candidate;
  rank: number;
  /** The line the reader is on — marked whether or not its panel is open,
   *  so switching in from the board shows where you left off. */
  placed: boolean;
  onOpen: () => void;
  /** Hidden until an ingest gives it something to compare against. */
  showMovement: boolean;
}) {
  const style = tierStyle(candidate.tier);

  return (
    <a
      // A real address, so an entry is still copyable and middle-clickable.
      // The click itself is handled here: opening a panel should not cost a
      // server render of the whole book.
      href={entryHref(candidate.id)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen();
      }}
      aria-current={placed ? "true" : undefined}
      title={`Open ${candidate.name}'s entry`}
      className={
        "-mx-2 flex items-center gap-3 border-b border-dashed border-hairline/60 py-3 transition-colors last:border-b-0 " +
        // The marker sits in the gutter the row already had, so a marked
        // line does not shift the text of its neighbours.
        "rounded-[10px] border-l-[3px] border-l-transparent pl-[5px] pr-2 " +
        (placed
          ? "border-l-brand bg-surface-soft"
          : "hover:border-l-hairline hover:bg-canvas")
      }
    >
      <span className="w-6 shrink-0 text-center font-display text-[11px] font-bold text-ink-faint tabular-nums">
        {rank}
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light font-display text-[12px] font-bold text-white">
        {candidate.initials}
      </span>

      <span className="min-w-0 flex-1">
        {/* Name and location share a line. The name never fills the cell —
            the widest in the book is 175px of 269 — while the specialty
            below it overruns by half. Pairing the two spends the slack on
            the line that has none, and the header already sorts them as
            separate keys, so the body now matches that promise. */}
        <span className="flex items-baseline gap-2">
          <span
            title={candidate.name}
            className="min-w-0 truncate font-display text-[14px] font-semibold text-ink"
          >
            {candidate.name}
          </span>
          {/* The license note lives in the tooltip: it is the answer to "why
              is this one here", but not worth a column of its own. */}
          <span
            title={
              candidate.licenseNote
                ? `${candidate.location} · ${candidate.licenseNote}`
                : candidate.location
            }
            className="shrink-0 whitespace-nowrap text-[11px] text-ink-faint"
          >
            {candidate.location}
          </span>
        </span>
        {/* Wraps to a second line instead of truncating. Two lines hold the
            longest taxonomy string in the book; one held none of the worst
            three. */}
        <span
          title={candidate.specialty}
          className="mt-0.5 line-clamp-2 text-[12px] leading-[16px] text-ink-faint"
        >
          {candidate.specialty}
        </span>
      </span>

      <span className="hidden w-[104px] shrink-0 lg:block">
        {candidate.trigger ? (
          <TriggerChip trigger={candidate.trigger} />
        ) : (
          <span
            title="Nothing recent on record for this prospect."
            className="cursor-help text-[11px] text-ink-faint"
          >
            —
          </span>
        )}
      </span>

      <span className="hidden w-[86px] shrink-0 md:block">
        <EvidenceChip evidence={candidate.evidence} />
      </span>

      {showMovement ? (
        <span className="hidden w-[78px] shrink-0 text-right md:block">
          <MovementChip
            change={candidate.scoreChange}
            isNew={candidate.isNew}
            valueChange={candidate.valueChange}
            timingChange={candidate.timingChange}
            note={candidate.scoreChangeNote}
          />
        </span>
      ) : null}

      {/* Score and band together: the band is a function of the score, so two
          columns were one fact printed twice. */}
      <span
        title={`Fit ${candidate.score} — ${candidate.tierLabel}.`}
        className="flex w-[104px] shrink-0 cursor-help items-baseline justify-end gap-1.5"
      >
        <span
          className="hidden text-[11px] font-medium sm:inline"
          style={{ color: style.badgeFg }}
        >
          {candidate.tier}
        </span>
        <span
          className="font-display text-[15px] font-bold tabular-nums"
          style={{ color: style.badgeFg }}
        >
          {candidate.score}
        </span>
      </span>
    </a>
  );
}

/** Jump to either end of the book. Icon only — the label beside it already
 *  says which way you are going, and the title names the destination. */
function PageEnd({
  direction,
  disabled,
  onClick,
}: {
  direction: "first" | "last";
  disabled: boolean;
  onClick: () => void;
}) {
  const first = direction === "first";
  const Icon = first ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={first ? "Jump to the first spread" : "Jump to the last spread"}
      aria-label={first ? "First spread" : "Last spread"}
      className="flex shrink-0 items-center rounded-[8px] border border-hairline bg-white px-2 py-2 text-brand shadow-raised transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
    >
      <Icon className="-mr-2 size-4" />
      <Icon className="size-4" />
    </button>
  );
}

function PageTurn({
  direction,
  disabled,
  onClick,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
}) {
  const back = direction === "back";
  const Icon = back ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex shrink-0 items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[13px] font-semibold text-brand shadow-raised transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
    >
      {back ? <Icon className="size-4" /> : null}
      {back ? "Previous" : "Next"}
      {back ? null : <Icon className="size-4" />}
    </button>
  );
}
