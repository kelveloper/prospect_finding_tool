"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Badge from "./Badge";
import { ChevronLeft, ChevronRight } from "./icons";
import type { Candidate } from "@/lib/data";
import { tierStyle } from "@/lib/tier";
import { BOOK_VIEW, viewHref } from "@/lib/view";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");
  const [fromBack, setFromBack] = useState(false);

  // Stamped before filtering so a filtered page still prints true board ranks.
  const entries: Entry[] = useMemo(
    () => ranked.map((c, i) => ({ ...c, rank: i + 1 })),
    [ranked],
  );

  const specialties = useMemo(
    () => [...new Set(entries.map((e) => e.specialty))].sort(),
    [entries],
  );
  const tiers = useMemo(
    () => [...new Set(entries.map((e) => e.tier))],
    [entries],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          (specialty === "all" || e.specialty === specialty) &&
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
  }, [entries, specialty, tier, query, sort, fromBack]);

  /** Clicking a menu entry both picks the column and sets which end to read
   *  from, so one call covers what were two controls. */
  const setOrder = (key: SortKey, back: boolean) => {
    setSort(key);
    setFromBack(back);
  };

  const filtered =
    specialty !== "all" ||
    tier !== "all" ||
    query.trim() !== "" ||
    sort !== "rank";
  const clear = () => {
    setSpecialty("all");
    setTier("all");
    setQuery("");
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
        <div className="flex flex-wrap items-end gap-3 border-b border-hairline/60 bg-canvas px-6 py-4 sm:px-8">
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

          {filtered ? (
            <button
              type="button"
              onClick={clear}
              className="ml-auto rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft"
            >
              Reset the book
            </button>
          ) : null}
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
                      <ColumnMenu
                        sortKey="rank"
                        heading="#"
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
                    <span className="size-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <ColumnMenu
                        sortKey="name"
                        heading="Prospect · Specialty"
                        filterLabel="Show specialty"
                        options={specialties}
                        value={specialty}
                        onValue={setSpecialty}
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
                    <span className="hidden shrink-0 sm:block">
                      <ColumnMenu
                        sortKey="movement"
                        heading="Move"
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
                    <span className="hidden shrink-0 sm:block">
                      <ColumnMenu
                        sortKey="tier"
                        heading="Tier"
                        options={tiers}
                        value={tier}
                        onValue={setTier}
                        activeSort={sort}
                        fromBack={fromBack}
                        onSort={setOrder}
                      />
                    </span>
                    {/* Spacer over the fit bar — the score's own heading sits
                        to its right, so this column stays unlabelled. */}
                    <span
                      aria-hidden
                      className="hidden w-16 shrink-0 md:block"
                    />
                    <span className="w-11 shrink-0">
                      <ColumnMenu
                        sortKey="rank"
                        heading="Fit"
                        align="right"
                        filterLabel="Show"
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
  align = "left",
  options,
  value,
  onValue,
  filterLabel = "Show",
  activeSort,
  fromBack,
  onSort,
}: {
  sortKey: SortKey;
  heading: string;
  align?: "left" | "right";
  /** Values this column can filter to. Omit for a sort-only column. */
  options?: readonly string[];
  value?: string;
  onValue?: (v: string) => void;
  filterLabel?: string;
  activeSort: SortKey;
  fromBack: boolean;
  onSort: (key: SortKey, back: boolean) => void;
}) {
  const active = activeSort === sortKey;
  const filtered = value !== undefined && value !== "all";
  const sort = SORTS[sortKey];

  return (
    <details
      // Shared name makes these an exclusive accordion: opening one column's
      // menu closes whichever was open, across both pages, with no state.
      name="book-column-menu"
      className="group/menu relative"
    >
      <summary
        title={`Sort or filter by ${heading}`}
        className={
          "flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden " +
          (align === "right" ? "justify-end" : "")
        }
      >
        <span
          className="eyebrow truncate"
          // A filtered column prints the value it is filtered to, so the
          // heading answers "what is hiding rows?" without being opened.
          title={filtered ? `${heading}: ${value}` : heading}
          style={
            active || filtered ? { color: "var(--color-brand)" } : undefined
          }
        >
          {filtered ? value : heading}
        </span>
        {active ? (
          <span aria-hidden className="text-[9px] text-brand">
            {fromBack ? "▼" : "▲"}
          </span>
        ) : null}
        <span
          aria-hidden
          className={
            "text-[8px] transition-transform group-open/menu:rotate-180 " +
            (filtered ? "text-brand" : "text-ink-faint")
          }
        >
          ▼
        </span>
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

        {options && onValue ? (
          <>
            <hr className="my-1.5 border-surface-soft" />
            <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.6px] text-ink-faint">
              {filterLabel}
            </p>
            {["all", ...options].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onValue(opt)}
                className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink hover:bg-canvas"
              >
                <span aria-hidden className="w-3 shrink-0 text-brand">
                  {(value ?? "all") === opt ? "✓" : ""}
                </span>
                <span className="truncate">
                  {opt === "all"
                    ? "All"
                    : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </span>
              </button>
            ))}
          </>
        ) : null}
      </div>
    </details>
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
        <span className="block truncate font-display text-[14px] font-semibold text-ink">
          {candidate.name}
        </span>
        <span className="block truncate text-[12px] text-ink-faint">
          {candidate.specialty} · {candidate.location}
        </span>
      </span>

      {/* Movement since the last ingest */}
      {candidate.scoreChange !== null && candidate.scoreChange !== 0 ? (
        <span
          title={`Score moved ${candidate.scoreChange > 0 ? "up" : "down"} ${Math.abs(candidate.scoreChange)} points since the last ingest`}
          className={
            "hidden shrink-0 font-display text-[11px] font-bold tabular-nums sm:inline " +
            (candidate.scoreChange > 0
              ? "text-tier-strong-fg"
              : "text-tier-poor")
          }
        >
          {candidate.scoreChange > 0 ? "▲" : "▼"}{" "}
          {Math.abs(candidate.scoreChange)}
        </span>
      ) : null}

      <span className="hidden shrink-0 sm:block">
        <Badge bg={style.badgeBg} fg={style.badgeFg}>
          {candidate.tier}
        </Badge>
      </span>

      <span className="hidden w-16 shrink-0 overflow-hidden rounded-full bg-surface-soft md:block">
        <span
          className="block h-1 rounded-full"
          style={{
            width: `${candidate.score}%`,
            backgroundColor: style.accent,
          }}
        />
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
