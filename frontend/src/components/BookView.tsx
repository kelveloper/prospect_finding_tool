"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Badge from "./Badge";
import { EvidenceChip, MovementChip, TriggerChip } from "./RowChips";
import { ChevronLeft, ChevronRight } from "./icons";
import type { Candidate } from "@/lib/data";
import { tierStyle } from "@/lib/tier";
import { BOOK_VIEW, viewHref } from "@/lib/view";
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

/** Rank is the board's own ordering, so it is stamped on before any filter
 *  runs — entry #4 stays #4 on a page of four. */
type Entry = Candidate & { rank: number };

/** Tier reads best by quality, never alphabetically. */
const TIER_ORDER = ["strong", "promising", "neutral", "weak", "poor"];

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
    cmp: (a: Entry, b: Entry) =>
      (b.scoreChange ?? 0) - (a.scoreChange ?? 0) || a.rank - b.rank,
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
  /** Entry currently open in the slide-over, if any. */
  selectedId: string | null;
};

/** The board read as a ledger: ranked entries laid out on facing pages you
 *  turn, one line each. Picking a line puts `?id=` in the URL, which is what
 *  opens the slide-over beside it — the reading list stays put underneath.
 *
 *  Which spread is open is the only local state. It is paired with the entry
 *  that was open when the page was turned, so a selection arriving from
 *  somewhere else — a shared link, or the layout toggle carrying the board's
 *  featured candidate over — turns to the page that entry is printed on.
 *  From there the page-turn buttons take over again. */
export default function BookView({ ranked, selectedId }: Props) {
  const [specialty, setSpecialty] = useState("all");
  const [tier, setTier] = useState("all");
  const [location, setLocation] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");
  const [fromBack, setFromBack] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
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

  const viewState: BookViewState = {
    specialty,
    tier,
    location,
    query,
    onlyNew,
    sort,
    fromBack,
  };

  function applyState(next: BookViewState) {
    setSpecialty(next.specialty ?? "all");
    setTier(next.tier ?? "all");
    setLocation(next.location ?? "all");
    setQuery(next.query ?? "");
    setOnlyNew(!!next.onlyNew);
    setSort(
      ((next.sort as SortKey) ?? "rank") in SORTS
        ? (next.sort as SortKey)
        : "rank",
    );
    setFromBack(!!next.fromBack);
    setTurned({ spread: 0, forSelection: selectedId });
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          (!onlyNew || e.isNew) &&
          (specialty === "all" || e.specialty === specialty) &&
          (location === "all" || e.location === location) &&
          (tier === "all" || e.tier === tier) &&
          (q === "" ||
            e.name.toLowerCase().includes(q) ||
            e.specialty.toLowerCase().includes(q) ||
            e.location.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        // A prospect that has not moved is no more a faller than a riser, so
        // it sits after everything that has moved — whichever end we read
        // from. Parking therefore has to survive the flip, not invert with it.
        if (sort === "movement") {
          const am = a.scoreChange ?? 0;
          const bm = b.scoreChange ?? 0;
          if ((am === 0) !== (bm === 0)) return am === 0 ? 1 : -1;
        }
        return SORTS[sort].cmp(a, b) * (fromBack ? -1 : 1);
      });
  }, [entries, specialty, tier, location, query, sort, fromBack, onlyNew]);

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
    : sameState(viewState, { ...EMPTY_STATE, onlyNew: true })
      ? "This is already the New arrivals view."
      : (views.find((v) => sameState(viewState, v.state))?.name ?? null);

  const filtered = !isEmpty(viewState);
  const clear = () => {
    setSpecialty("all");
    setTier("all");
    setLocation("all");
    setQuery("");
    setOnlyNew(false);
    setSort("rank");
    setFromBack(false);
  };

  const spreadCount = Math.max(1, Math.ceil(shown.length / PER_SPREAD));
  const selectedIndex = selectedId
    ? shown.findIndex((c) => c.id === selectedId)
    : -1;
  const selectedSpread =
    selectedIndex >= 0 ? Math.floor(selectedIndex / PER_SPREAD) : null;
  const [turned, setTurned] = useState<{
    spread: number;
    forSelection: string | null;
  }>(() => ({ spread: selectedSpread ?? 0, forSelection: selectedId }));

  const turnTo = (spread: number) =>
    setTurned({ spread, forSelection: selectedId });
  const spread =
    selectedSpread !== null && selectedId !== turned.forSelection
      ? selectedSpread
      : turned.spread;
  const current = Math.min(spread, spreadCount - 1);
  const start = current * PER_SPREAD;
  const onSpread = shown.slice(start, start + PER_SPREAD);
  const pages = [
    { entries: onSpread.slice(0, PER_PAGE), number: current * 2 + 1 },
    { entries: onSpread.slice(PER_PAGE), number: current * 2 + 2 },
  ];

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
          {/* Saved views — preset filters, sitting with the filters they
              replace. "New arrivals" is the one that turns the board from a
              database into a morning routine. */}
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <ViewChip
              label="Whole book"
              count={entries.length}
              active={isEmpty(viewState)}
              onClick={() => applyState(EMPTY_STATE)}
              title="Every prospect on the board, no filters"
            />

            <ViewChip
              label="New arrivals"
              count={entries.filter((e) => e.isNew).length}
              active={
                onlyNew &&
                specialty === "all" &&
                tier === "all" &&
                !query.trim()
              }
              onClick={() => applyState({ ...EMPTY_STATE, onlyNew: true })}
              title="Prospects ingestion first found in the last 48 hours"
            />

            {views.map((view) => (
              <ViewChip
                key={view.id}
                label={view.name}
                count={
                  entries.filter(
                    (e) =>
                      (!view.state.onlyNew || e.isNew) &&
                      (view.state.specialty === "all" ||
                        e.specialty === view.state.specialty) &&
                      (view.state.tier === "all" ||
                        e.tier === view.state.tier) &&
                      (view.state.query.trim() === "" ||
                        e.name
                          .toLowerCase()
                          .includes(view.state.query.trim().toLowerCase())),
                  ).length
                }
                active={sameState(viewState, view.state)}
                onClick={() => applyState(view.state)}
                onRemove={() => removeView(view.id)}
                title={`Saved view — ${describe(view.state)}`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-hairline/60 pt-3">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Look up</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, specialty or city"
                className="w-[200px] rounded-[8px] border border-hairline bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
            </label>

            {/* Both act on the current filters, so they live with them. The
                group is what carries the auto margin — pinning Reset to the
                right edge, so it stays put when Save comes and goes rather
                than sliding across as the row reflows. */}
            <div className="ml-auto flex items-center gap-2">
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
                    aria-label="Name for this view"
                    placeholder="Name this view"
                    maxLength={40}
                    className="w-[168px] rounded-[8px] border border-brand bg-white px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={commitName}
                    className="rounded-[8px] bg-brand px-3 py-1.5 font-display text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setNaming(null)}
                    className="rounded-[8px] px-2 py-1.5 font-display text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink"
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
                      ? "Save these filters under a name of your choosing"
                      : saveBlockedBecause.startsWith("Filter the book") ||
                          saveBlockedBecause.startsWith("This is already")
                        ? saveBlockedBecause
                        : `These filters are already saved as "${saveBlockedBecause}".`
                  }
                  className="rounded-[8px] border border-dashed border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-hairline/50 disabled:text-ink-faint disabled:hover:bg-white"
                >
                  + Save this view
                </button>
              )}

              {/* Kept mounted and dimmed rather than removed: a button that
                  vanishes takes its width with it, and everything beside it
                  moves. */}
              <button
                type="button"
                onClick={clear}
                disabled={!filtered}
                title={
                  filtered
                    ? "Clear every filter and go back to the whole book"
                    : "Nothing to reset — the whole book is showing"
                }
                className="rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-hairline/50 disabled:text-ink-faint disabled:hover:bg-white"
              >
                Reset the book
              </button>
            </div>
          </div>
        </div>

        {/* Gutter shading — the fold where the two pages meet */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-12 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(29,111,164,0.08),transparent)] lg:block"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {pages.map((page, i) => (
            <section
              key={page.number}
              aria-label={`Page ${page.number}`}
              className={
                "flex min-h-[420px] flex-col px-6 py-6 sm:px-8 " +
                (i === 0
                  ? "border-b border-hairline/60 lg:border-b-0 lg:border-r"
                  : "")
              }
            >
              {page.entries.length > 0 ? (
                <>
                  {/* Column headings, printed on each page like a ledger's.
                      Widths mirror BookEntry exactly, responsive rules and
                      all, so a heading always sits over its own column. */}
                  <div className="-mx-2 flex items-center gap-3 border-b border-hairline/60 px-2 pb-2">
                    <span className="w-6 shrink-0">
                      <span
                        title="Rank on the board, by fit score"
                        className="eyebrow"
                      >
                        #
                      </span>
                    </span>
                    <span className="size-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <ColumnMenu
                        sortKey="name"
                        heading="Specialty"
                        hint="What they practise. Filter the book to one specialty."
                        filters={[
                          {
                            label: "Show specialty",
                            options: specialties,
                            value: specialty,
                            onValue: setSpecialty,
                          },
                          {
                            label: "Show location",
                            options: locations,
                            value: location,
                            onValue: setLocation,
                          },
                        ]}
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
                    <span className="hidden w-[104px] shrink-0 lg:block">
                      <ColumnMenu
                        sortKey="trigger"
                        heading="Why now"
                        hint="The most recent event worth calling about — a new licence, a practice, a property purchase."
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
                    <span className="hidden w-[86px] shrink-0 sm:block">
                      <ColumnMenu
                        sortKey="tier"
                        heading="Tier"
                        hint="Score band — strong, promising, neutral, weak or poor."
                        filters={[
                          {
                            label: "Show tier",
                            options: tiers,
                            value: tier,
                            onValue: setTier,
                          },
                        ]}
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
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
                    <span className="w-11 shrink-0">
                      <ColumnMenu
                        sortKey="rank"
                        heading="Fit"
                        hint="The overall fit score out of 100. The board is ranked by it."
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
                        active={entry.id === selectedId}
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
                        className="mt-4 rounded-[8px] bg-brand px-4 py-2 font-display text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
                      >
                        Reset the book
                      </button>
                    </span>
                  ) : (
                    <p className="text-[13px] text-ink-faint">
                      End of the book
                    </p>
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
            </section>
          ))}
        </div>

        {/* ── Page turn ────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-4 border-t border-hairline/60 bg-canvas px-6 py-3">
          <PageTurn
            direction="back"
            disabled={current === 0}
            onClick={() => turnTo(current - 1)}
          />
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
          <PageTurn
            direction="forward"
            disabled={current >= spreadCount - 1}
            onClick={() => turnTo(current + 1)}
          />
        </footer>
      </div>
    </main>
  );
}

/** One column heading. The caret opens an Excel-style menu: sort both ways,
 *  then the values to filter to. Native <details>, so no open/close state and
 *  the keyboard works for free. */
function ColumnMenu({
  sortKey,
  heading,
  hint,
  align = "left",
  filters = [],
  activeSort,
  fromBack,
  onSort,
}: {
  sortKey: SortKey;
  heading: string;
  /** Plain-English meaning — a column head is a label, not an explanation. */
  hint?: string;
  align?: "left" | "right";
  /** Filters this column offers, stacked in the order given. A cell that
   *  prints two facts can filter on both. Empty for a sort-only column. */
  filters?: {
    label: string;
    options: readonly { value: string; count: number }[];
    value: string;
    onValue: (v: string) => void;
  }[];
  activeSort: SortKey;
  fromBack: boolean;
  onSort: (key: SortKey, back: boolean) => void;
}) {
  const active = activeSort === sortKey;
  const live = filters.filter((f) => f.value !== "all");
  const filtered = live.length > 0;
  // With two filters on, the head cannot show both — it says how many.
  const value =
    live.length === 1
      ? live[0].value
      : live.length > 1
        ? `${live.length} filters`
        : "";
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
          (filtered ? `\n\nShowing only: ${value}` : "") +
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
          className={"eyebrow " + (filtered ? "truncate" : "")}
          // A filtered column prints the value it is filtered to, so the
          // heading answers "what is hiding rows?" without being opened.
          style={
            active || filtered ? { color: "var(--color-brand)" } : undefined
          }
        >
          {filtered ? value : heading}
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
              : "group-open/menu:rotate-180 " +
                (filtered ? "text-brand" : "text-ink-faint"))
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
          "absolute z-20 mt-1 max-h-[280px] w-[210px] overflow-y-auto rounded-[10px] border border-hairline bg-white p-1.5 shadow-panel " +
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

        {filters.map((filter) => (
          <div key={filter.label}>
            <hr className="my-1.5 border-surface-soft" />
            <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.6px] text-ink-faint">
              {filter.label}
            </p>
            {filter.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => filter.onValue(opt.value)}
                className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink hover:bg-canvas"
              >
                <span aria-hidden className="w-3 shrink-0 text-brand">
                  {filter.value === opt.value ? "✓" : ""}
                </span>
                <span
                  className="truncate"
                  title={opt.value === "all" ? undefined : opt.value}
                >
                  {opt.value === "all"
                    ? "All"
                    : opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                </span>
                {/* The count says what the filter will leave you with. */}
                <span className="ml-auto shrink-0 font-display text-[11px] tabular-nums text-ink-faint">
                  {opt.count}
                </span>
              </button>
            ))}
          </div>
        ))}
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
  return (
    <span
      className={
        "inline-flex items-center rounded-full border transition-colors " +
        (active
          ? "border-brand bg-brand text-white"
          : "border-hairline bg-white text-ink-muted hover:bg-surface-soft")
      }
    >
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onRename}
        title={title}
        aria-pressed={active}
        className="max-w-[210px] truncate rounded-full py-1.5 pl-3 pr-2 font-display text-[12px] font-semibold"
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
          title={`Forget the "${label}" view`}
          aria-label={`Forget the ${label} view`}
          className={
            "rounded-full py-1.5 pr-3 pl-1 font-display text-[13px] leading-none " +
            (active
              ? "text-white/70 hover:text-white"
              : "text-ink-faint hover:text-tier-poor")
          }
        >
          ×
        </button>
      ) : (
        <span className="pr-2" />
      )}
    </span>
  );
}

/** One printed line: rank, who they are, tier, fit. */
function BookEntry({
  candidate,
  rank,
  active,
}: {
  candidate: Candidate;
  rank: number;
  active: boolean;
}) {
  const style = tierStyle(candidate.tier);

  return (
    <Link
      href={viewHref(BOOK_VIEW, candidate.id)}
      // The book must not jump back to the top as entries are read.
      scroll={false}
      aria-current={active ? "true" : undefined}
      title={
        active
          ? `Showing ${candidate.name}'s entry`
          : `Open ${candidate.name}'s entry`
      }
      className={
        "-mx-2 flex items-center gap-3 rounded-[10px] border-b border-dashed border-hairline/60 px-2 py-3 transition-colors last:border-b-0 " +
        (active ? "bg-surface-soft" : "hover:bg-canvas")
      }
    >
      <span className="w-6 shrink-0 text-center font-display text-[11px] font-bold text-ink-faint tabular-nums">
        {rank}
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light font-display text-[12px] font-bold text-white">
        {candidate.initials}
      </span>

      <span className="min-w-0 flex-1">
        {/* Titled because these truncate. The row's own title says "open
            this entry", which is no help when the text you cannot read is
            the specialty. */}
        <span
          title={candidate.name}
          className="block truncate font-display text-[14px] font-semibold text-ink"
        >
          {candidate.name}
        </span>
        <span
          title={`${candidate.specialty} · ${candidate.location}`}
          className="block truncate text-[12px] text-ink-faint"
        >
          {candidate.specialty} · {candidate.location}
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

      <span className="hidden w-[86px] shrink-0 sm:block">
        <span
          title={`Tier — ${candidate.tierLabel}, from the fit score.`}
          className="cursor-help"
        >
          <Badge bg={style.badgeBg} fg={style.badgeFg}>
            {candidate.tier}
          </Badge>
        </span>
      </span>

      <span className="hidden w-[78px] shrink-0 text-right md:block">
        <MovementChip change={candidate.scoreChange} />
      </span>

      <span
        className="w-11 shrink-0 text-right font-display text-[15px] font-bold tabular-nums"
        style={{ color: style.badgeFg }}
      >
        {candidate.score}
      </span>
    </Link>
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
