"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Badge from "./Badge";
import { tierStyle } from "@/lib/tier";
import type { Candidate, Tier } from "@/lib/data";

/** Tier order for the filter dropdown — best first, matching the board. */
const TIER_ORDER: Tier[] = ["strong", "promising", "neutral", "weak", "poor"];

/** Past this many distinct values a dropdown stops being scannable, so the
 *  column falls back to a free-text match instead. */
const SELECT_MAX = 40;

/** Rows per page. "all" is kept for advisors who'd rather scroll one long book. */
const PAGE_SIZES = [10, 25, 50, 100, "all"] as const;
type PageSize = (typeof PAGE_SIZES)[number];

type Row = Candidate & { rank: number };

/** "text" matches a substring, "select" an exact value, "min" a numeric floor. */
type FilterKind = "none" | "text" | "select" | "min";

type Column = {
  key: string;
  label: string;
  /** Right-aligns the column and sorts it numerically. */
  numeric?: boolean;
  filter: FilterKind;
  /** The value a filter matches against. */
  value: (c: Row) => string | number;
  /** Overrides `value` for sorting — used where the display string sorts wrong. */
  sortValue?: (c: Row) => string | number;
  /** Overrides the default plain-text cell. */
  cell?: (c: Row) => ReactNode;
};

/** "8 Months" must sort below "12 Months", so sort on the leading number and
 *  push the unknowns ("—") to the bottom. */
function licenceMonths(c: Row): number {
  const n = parseInt(c.licenceHeld, 10);
  return Number.isNaN(n) ? -1 : n;
}

/** Drops a trailing ".0" so 57.1 and 40 both read cleanly in one column. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ScoreCell({ c }: { c: Row }) {
  const style = tierStyle(c.tier);
  return (
    <span className="flex items-center justify-end gap-2.5">
      {c.scoreChange !== null && c.scoreChange !== 0 ? (
        <span
          title={`Moved ${c.scoreChange > 0 ? "up" : "down"} ${Math.abs(c.scoreChange)} points since the last ingest`}
          className={
            "font-display text-[11px] font-bold tabular-nums " +
            (c.scoreChange > 0 ? "text-tier-strong-fg" : "text-tier-poor")
          }
        >
          {c.scoreChange > 0 ? "▲" : "▼"} {Math.abs(c.scoreChange)}
        </span>
      ) : null}
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-soft">
        <span
          className="block h-full rounded-full"
          style={{ width: `${c.score}%`, backgroundColor: style.accent }}
        />
      </span>
      <span className="w-9 shrink-0 text-right font-display text-[14px] font-bold tabular-nums text-ink">
        {fmt(c.score)}
      </span>
    </span>
  );
}

const COLUMNS: Column[] = [
  { key: "rank", label: "#", numeric: true, filter: "none", value: (c) => c.rank },
  {
    key: "name",
    label: "Prospect",
    filter: "text",
    value: (c) => c.name,
    cell: (c) => (
      <Link
        href={profileHref(c.id)}
        className="flex items-center gap-2.5 font-display text-[14px] font-semibold text-ink hover:text-brand hover:underline"
        title={`Open ${c.name}'s profile`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-light font-display text-[11px] font-bold text-white">
          {c.initials}
        </span>
        {c.name}
      </Link>
    ),
  },
  { key: "specialty", label: "Specialty", filter: "select", value: (c) => c.specialty },
  {
    key: "tier",
    label: "Tier",
    filter: "select",
    value: (c) => c.tier,
    // Sort by board quality, not alphabetically.
    sortValue: (c) => TIER_ORDER.indexOf(c.tier),
    cell: (c) => {
      const style = tierStyle(c.tier);
      return (
        <Badge bg={style.badgeBg} fg={style.badgeFg}>
          {c.tier}
        </Badge>
      );
    },
  },
  {
    key: "score",
    label: "Score",
    numeric: true,
    filter: "min",
    value: (c) => c.score,
    cell: (c) => <ScoreCell c={c} />,
  },
  {
    key: "qualification",
    label: "Qual.",
    numeric: true,
    filter: "min",
    value: (c) => c.qualificationScore,
    cell: (c) => fmt(c.qualificationScore),
  },
  {
    key: "timing",
    label: "Timing",
    numeric: true,
    filter: "min",
    value: (c) => c.timingScore,
    cell: (c) => fmt(c.timingScore),
  },
  {
    key: "licence",
    label: "Licence",
    filter: "text",
    value: (c) => c.licenceHeld,
    sortValue: licenceMonths,
  },
  { key: "location", label: "Location", filter: "select", value: (c) => c.location },
];

function profileHref(id: string): string {
  return `/candidate/${id}`;
}

const DEFAULT_SORT = "rank";
const DEFAULT_DIR = "asc";
const DEFAULT_SIZE: PageSize = 10;
/** Column filters are namespaced in the URL so they can't collide with
 *  ?view= or anything else the page reads. */
const FILTER_PREFIX = "f_";

export default function BookViewTable({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read once on mount: the URL is the source of truth for where the advisor
  // left off, so Back from a profile lands on the same filtered page.
  const [sortKey, setSortKey] = useState(
    () => searchParams.get("sort") ?? DEFAULT_SORT,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() =>
    searchParams.get("dir") === "desc" ? "desc" : DEFAULT_DIR,
  );
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith(FILTER_PREFIX)) seed[key.slice(FILTER_PREFIX.length)] = value;
    });
    return seed;
  });
  const [pageSize, setPageSize] = useState<PageSize>(
    () => PAGE_SIZES.find((n) => String(n) === searchParams.get("size")) ?? DEFAULT_SIZE,
  );
  const [page, setPage] = useState(() => {
    const n = Number(searchParams.get("p"));
    return Number.isInteger(n) && n > 0 ? n : 1;
  });
  // The filter row is chrome most of the time — off until the advisor wants it,
  // but it opens itself when a restored URL already carries filters.
  const [showFilters, setShowFilters] = useState(
    () => [...searchParams.keys()].some((k) => k.startsWith(FILTER_PREFIX)),
  );

  // Rank is the board's own ordering, so it has to be stamped on before any
  // client-side sort shuffles the rows.
  const ranked: Row[] = useMemo(
    () => candidates.map((c, i) => ({ ...c, rank: i + 1 })),
    [candidates],
  );

  /** Distinct values per select column, so each dropdown offers only what the
   *  board actually contains. */
  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of COLUMNS) {
      if (col.filter !== "select") continue;
      const values = [...new Set(ranked.map((c) => String(col.value(c))))];
      out[col.key] =
        col.key === "tier"
          ? TIER_ORDER.filter((t) => values.includes(t))
          : values.sort();
    }
    return out;
  }, [ranked]);

  const rows = useMemo(() => {
    const active = COLUMNS.map((col) => ({ col, q: (filters[col.key] ?? "").trim() })).filter(
      (f) => f.q !== "",
    );

    const filtered = ranked.filter((c) =>
      active.every(({ col, q }) => {
        const v = col.value(c);
        switch (col.filter) {
          case "select":
            return String(v) === q;
          case "min": {
            const min = Number(q);
            return Number.isNaN(min) || Number(v) >= min;
          }
          default:
            return String(v).toLowerCase().includes(q.toLowerCase());
        }
      }),
    );

    const col = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0];
    const pick = col.sortValue ?? col.value;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [ranked, filters, sortKey, sortDir]);

  const size = pageSize === "all" ? rows.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  // Clamped rather than reset, so a shrinking result set can never strand the
  // view on an empty page.
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * size;
  const pageRows = rows.slice(start, start + size);

  function toggleSort(col: Column) {
    setPage(1);
    if (col.key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(col.key);
    // Scores read best highest-first; names, rank and places read best A→Z.
    setSortDir(col.numeric && col.key !== "rank" ? "desc" : "asc");
  }

  // Mirror the controls into the URL. window.history.replaceState is the
  // documented way to do this without a navigation, so filtering 194 rows
  // never round-trips to the server. replace, not push, keeps one history
  // entry for the whole session of tweaking.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);

    for (const key of [...sp.keys()]) {
      if (key.startsWith(FILTER_PREFIX)) sp.delete(key);
    }
    sp.delete("sort");
    sp.delete("dir");
    sp.delete("p");
    sp.delete("size");

    // Only non-defaults reach the URL, so an untouched table stays a bare "/".
    if (sortKey !== DEFAULT_SORT) sp.set("sort", sortKey);
    if (sortDir !== DEFAULT_DIR) sp.set("dir", sortDir);
    if (page !== 1) sp.set("p", String(page));
    if (pageSize !== DEFAULT_SIZE) sp.set("size", String(pageSize));
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim() !== "") sp.set(FILTER_PREFIX + key, value);
    }

    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [sortKey, sortDir, page, pageSize, filters]);

  /** Anywhere on the row opens the prospect. The name is still a real link,
   *  so keyboard and middle-click keep working without a second tab stop. */
  function openProfile(c: Row, e: MouseEvent<HTMLTableRowElement>) {
    // Let a link, button or filter control handle its own click.
    if ((e.target as HTMLElement).closest("a, button, select, input")) return;
    // A click that ends a text selection is a drag, not a navigation.
    if (window.getSelection()?.toString()) return;

    const href = profileHref(c.id);
    // Honour the usual "open in a new tab" modifiers.
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  }

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Page 4 of the old result set is meaningless against a new one.
    setPage(1);
  }

  const activeCount = Object.values(filters).filter((v) => v.trim() !== "").length;
  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const inputClass =
    "w-full rounded-[6px] border border-hairline bg-white px-2 py-1 text-[12px] font-normal normal-case tracking-normal text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";

  function FilterControl({ col }: { col: Column }) {
    const value = filters[col.key] ?? "";

    if (col.filter === "none") return null;

    if (col.filter === "select") {
      const opts = options[col.key] ?? [];
      // A dropdown this long stops being scannable — take text instead.
      if (opts.length > SELECT_MAX) {
        return (
          <input
            type="search"
            value={value}
            onChange={(e) => setFilter(col.key, e.target.value)}
            aria-label={`Filter by ${col.label}`}
            placeholder="Contains…"
            className={inputClass}
          />
        );
      }
      return (
        <select
          value={value}
          onChange={(e) => setFilter(col.key, e.target.value)}
          aria-label={`Filter by ${col.label}`}
          className={inputClass}
        >
          <option value="">All</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {col.key === "tier" ? o.charAt(0).toUpperCase() + o.slice(1) : o}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={col.filter === "min" ? "number" : "search"}
        inputMode={col.filter === "min" ? "numeric" : undefined}
        min={col.filter === "min" ? 0 : undefined}
        max={col.filter === "min" ? 100 : undefined}
        value={value}
        onChange={(e) => setFilter(col.key, e.target.value)}
        aria-label={
          col.filter === "min" ? `Minimum ${col.label}` : `Filter by ${col.label}`
        }
        placeholder={col.filter === "min" ? "Min" : "Contains…"}
        className={inputClass}
      />
    );
  }

  return (
    <section className="rounded-[16px] bg-white shadow-card">
      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-soft px-6 py-4">
        <p className="text-[13px] text-ink-muted">
          Click any column header to sort
          {showFilters ? ", or filter with the boxes below." : "."}
        </p>
        <span className="flex items-center gap-3">
          <span
            aria-live="polite"
            className="rounded-full bg-surface-tint px-2.5 py-1 font-display text-[12px] font-semibold text-brand-dark"
          >
            {rows.length} of {ranked.length}
          </span>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-pressed={showFilters}
            className={
              "rounded-[8px] border px-3 py-2 font-display text-[12px] font-semibold transition-colors " +
              (showFilters
                ? "border-brand bg-surface-tint text-brand-dark"
                : "border-hairline bg-white text-brand hover:bg-surface-soft")
            }
          >
            {showFilters ? "Hide filters" : "Filter"}
            {activeCount > 0 ? ` (${activeCount})` : ""}
          </button>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft"
            >
              Clear all filters
            </button>
          ) : null}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <caption className="sr-only">
            Every prospect on your book — sortable and filterable by any column
          </caption>

          <thead>
            <tr className="border-b border-surface-soft align-top">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                    className={"px-3 py-3 " + (col.numeric ? "text-right" : "")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      aria-label={`Sort by ${col.label}`}
                      // The eyebrow utility hard-codes a colour, so the active
                      // state has to win with an inline style.
                      style={active ? { color: "var(--color-brand)" } : undefined}
                      className="eyebrow inline-flex items-center gap-1 transition-colors hover:text-brand"
                    >
                      {col.label}
                      <span aria-hidden className={active ? "" : "opacity-0"}>
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    </button>

                    {showFilters ? (
                      <span className="mt-1.5 block">
                        <FilterControl col={col} />
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-16 text-center">
                  <p className="font-display text-[16px] font-semibold text-ink">
                    No prospects match these filters
                  </p>
                  <p className="mt-1 text-[14px] text-ink-muted">
                    Loosen one of the column filters, or clear them all to see the
                    whole book.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-[8px] bg-brand px-5 py-2.5 font-display text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
                  >
                    Clear all filters
                  </button>
                </td>
              </tr>
            ) : (
              pageRows.map((c) => (
                <tr
                  key={c.id}
                  onClick={(e) => openProfile(c, e)}
                  onMouseEnter={() => router.prefetch(profileHref(c.id))}
                  className="cursor-pointer border-b border-surface-soft/60 transition-colors last:border-0 hover:bg-canvas"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={
                        "px-3 py-3 text-[13px] text-ink-muted " +
                        (col.numeric ? "text-right font-display tabular-nums " : "") +
                        (col.key === "rank" ? "text-[12px] font-bold text-ink-faint" : "")
                      }
                    >
                      {col.cell ? col.cell(c) : String(col.value(c))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paging ───────────────────────────────────── */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surface-soft px-6 py-3">
          <span className="flex items-center gap-2">
            <label
              htmlFor="book-page-size"
              className="font-display text-[12px] font-semibold text-ink-muted"
            >
              Rows per page
            </label>
            <select
              id="book-page-size"
              value={String(pageSize)}
              onChange={(e) => {
                // Matching against PAGE_SIZES keeps the literal union intact,
                // where Number() would widen it to plain number.
                setPageSize(
                  PAGE_SIZES.find((n) => String(n) === e.target.value) ??
                    DEFAULT_SIZE,
                );
                setPage(1);
              }}
              className="rounded-[6px] border border-hairline bg-white px-2 py-1 font-display text-[12px] text-ink focus:border-brand focus:outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={String(n)} value={String(n)}>
                  {n === "all" ? "All" : n}
                </option>
              ))}
            </select>
          </span>

          <p aria-live="polite" className="text-[12px] text-ink-muted">
            Showing{" "}
            <span className="font-display font-semibold text-ink tabular-nums">
              {start + 1}–{start + pageRows.length}
            </span>{" "}
            of{" "}
            <span className="font-display font-semibold text-ink tabular-nums">
              {rows.length}
            </span>
          </p>

          <nav aria-label="Pagination" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage <= 1}
              className="rounded-[6px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-white"
            >
              ← Prev
            </button>
            <span className="font-display text-[12px] text-ink-muted tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="rounded-[6px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-white"
            >
              Next →
            </button>
          </nav>
        </div>
      ) : null}
    </section>
  );
}
