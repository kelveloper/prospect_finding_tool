"use client";

import Link from "next/link";
import { useState } from "react";
import Badge from "./Badge";
import { ChevronLeft, ChevronRight } from "./icons";
import type { Candidate } from "@/lib/data";
import { tierStyle } from "@/lib/tier";
import { BOOK_VIEW, viewHref } from "@/lib/view";

/** Entries per page; a spread shows two of them side by side. */
const PER_PAGE = 6;
const PER_SPREAD = PER_PAGE * 2;

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
  const spreadCount = Math.max(1, Math.ceil(ranked.length / PER_SPREAD));
  const selectedIndex = selectedId ? ranked.findIndex((c) => c.id === selectedId) : -1;
  const selectedSpread = selectedIndex >= 0 ? Math.floor(selectedIndex / PER_SPREAD) : null;
  const [turned, setTurned] = useState<{ spread: number; forSelection: string | null }>(
    () => ({ spread: selectedSpread ?? 0, forSelection: selectedId }),
  );

  const turnTo = (spread: number) => setTurned({ spread, forSelection: selectedId });
  const spread =
    selectedSpread !== null && selectedId !== turned.forSelection
      ? selectedSpread
      : turned.spread;
  const current = Math.min(spread, spreadCount - 1);
  const start = current * PER_SPREAD;
  const onSpread = ranked.slice(start, start + PER_SPREAD);
  const pages = [
    { entries: onSpread.slice(0, PER_PAGE), firstRank: start + 1, number: current * 2 + 1 },
    {
      entries: onSpread.slice(PER_PAGE),
      firstRank: start + PER_PAGE + 1,
      number: current * 2 + 2,
    },
  ];
  const lastOnSpread = start + onSpread.length;

  return (
    <main className="mx-auto max-w-[1560px] px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Prospect Ledger</p>
          <h1 className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
            The Book
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Every prospect on the board, printed in rank order. Open a line to read the
            full entry beside it.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-tint px-3 py-1.5 font-display text-[12px] font-semibold text-brand-dark">
          {ranked.length} {ranked.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* ── The open book ──────────────────────────────── */}
      <div className="relative mt-6 overflow-hidden rounded-[16px] bg-white shadow-panel ring-1 ring-hairline/60">
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
                  <p className="eyebrow">
                    Ranks {page.firstRank}–{page.firstRank + page.entries.length - 1}
                  </p>
                  <div className="mt-2 flex-1">
                    {page.entries.map((candidate, j) => (
                      <BookEntry
                        key={candidate.id}
                        candidate={candidate}
                        rank={page.firstRank + j}
                        active={candidate.id === selectedId}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-[13px] text-ink-faint">End of the book</p>
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
            <span className="hidden sm:inline">
              {" "}
              · ranks {start + 1}–{lastOnSpread} of {ranked.length}
            </span>
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
      title={active ? `Showing ${candidate.name}'s entry` : `Open ${candidate.name}'s entry`}
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
            (candidate.scoreChange > 0 ? "text-tier-strong-fg" : "text-tier-poor")
          }
        >
          {candidate.scoreChange > 0 ? "▲" : "▼"} {Math.abs(candidate.scoreChange)}
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
          style={{ width: `${candidate.score}%`, backgroundColor: style.accent }}
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
