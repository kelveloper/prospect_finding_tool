"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CandidateCard from "./CandidateCard";
import CandidateDetail from "./CandidateDetail";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchOutreachHistory,
  type ContactKit,
} from "@/lib/api";
import {
  AUDIT_CHIPS,
  auditCounts,
  describeTiers,
  isWeakIdentity,
  matchesAuditFilter,
  useAuditMode,
  type AuditFilter,
} from "@/lib/audit";
import {
  changedSinceSweep,
  describeChanges,
  summarizeChanges,
} from "@/lib/changes";
import type { Candidate, OutreachEntry } from "@/lib/data";

type DetailData = NonNullable<Awaited<ReturnType<typeof fetchCandidateDetail>>>;

/* Virtualized list geometry. Cards are structurally identical, so one
 * measured height positions every row; the estimate only covers the
 * server render and the first client frame. */
const CARD_GAP = 12;
const CARD_ESTIMATE = 150;
const OVERSCAN = 8;
const INITIAL_WINDOW = 30;

/** Everything the featured panel needs for one prospect, fetched together. */
type Dossier = {
  detail?: DetailData;
  contactKit?: ContactKit;
  outreach?: OutreachEntry[];
};

type Props = {
  ranked: Candidate[];
  /** Which prospect the panel opens on; the top of the board otherwise. */
  initialSelectedId: string | null;
  /** Server-fetched dossier for the initial prospect, so the first paint
   *  is complete without a client round-trip. */
  initialDossier: Dossier;
};

/** The board layout: featured panel beside the ranked list. Selection is
 *  pure client state — clicking a card swaps the panel and fetches only
 *  that prospect's dossier (a few KB) instead of navigating the server,
 *  which re-rendered and re-sent all ~1,200 cards on every click. The URL
 *  still tracks the selection via pushState, so links stay shareable and
 *  back/forward still walk the history. */
export default function Scoreboard({
  ranked,
  initialSelectedId,
  initialDossier,
}: Props) {
  const defaultId = initialSelectedId ?? ranked[0].id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [dossier, setDossier] = useState<Dossier | null>(initialDossier);
  const cache = useRef(new Map<string, Dossier>([[defaultId, initialDossier]]));
  const selectedRef = useRef(defaultId);

  // A refresh (a sweep landed, an outcome was logged) re-renders the page
  // with a fresh dossier for the prospect in the URL — which is the one on
  // screen, since every click writes the URL. Adopt it and drop everything
  // cached from before, or the panel keeps showing last week's score.
  const [seenDossier, setSeenDossier] = useState(initialDossier);
  if (initialDossier !== seenDossier) {
    setSeenDossier(initialDossier);
    setSelectedId(defaultId);
    setDossier(initialDossier);
  }
  useEffect(() => {
    cache.current = new Map([[defaultId, initialDossier]]);
    selectedRef.current = defaultId;
  }, [initialDossier, defaultId]);

  // "What changed" — new arrivals and movers. The alert above the list
  // doubles as the toggle; nothing renders when nothing changed.
  const changes = useMemo(() => summarizeChanges(ranked), [ranked]);
  const [onlyChanged, setOnlyChanged] = useState(false);

  // Why now — filter by the tag each card shows. Counts follow the tag,
  // not the underlying signal, so the list never shows a card whose chip
  // disagrees with the filter that produced it.
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const triggerChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of ranked)
      if (c.trigger)
        counts.set(c.trigger.label, (counts.get(c.trigger.label) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        hint:
          ranked.find((c) => c.trigger?.label === label)?.trigger?.hint ?? "",
      }));
  }, [ranked]);

  // Identity audit — operator only, off by default (see lib/audit.ts).
  // With it off none of this renders and the board is the advisor's.
  const audit = useAuditMode();
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [weakestFirst, setWeakestFirst] = useState(false);
  const counts = useMemo(
    () => auditCounts(ranked.map((c) => c.identity)),
    [ranked],
  );
  // The payoff: where a high score meets weak evidence — the exact rows
  // where a wrong congratulations call could happen
  const weakInTop20 = useMemo(
    () => ranked.slice(0, 20).filter((c) => isWeakIdentity(c.identity)).length,
    [ranked],
  );

  const visible = useMemo(() => {
    let list = onlyChanged ? ranked.filter(changedSinceSweep) : ranked;
    if (triggerFilter !== "all")
      list = list.filter((c) => c.trigger?.label === triggerFilter);
    if (audit && auditFilter !== "all")
      list = list.filter((c) => matchesAuditFilter(c.identity, auditFilter));
    if (audit && weakestFirst)
      // Stable: ties keep rank order, so the weakest books come first and
      // the best-ranked of them lead
      list = [...list].sort(
        (a, b) => a.identity.identityConfidence - b.identity.identityConfidence,
      );
    return list;
  }, [ranked, onlyChanged, triggerFilter, audit, auditFilter, weakestFirst]);

  async function show(id: string, pushUrl: boolean) {
    selectedRef.current = id;
    setSelectedId(id);
    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      window.history.pushState(null, "", url);
    }
    const cached = cache.current.get(id);
    if (cached) {
      setDossier(cached);
      return;
    }
    setDossier(null); // ranked-row fallback renders immediately
    const [detail, contactKit, outreach] = await Promise.all([
      fetchCandidateDetail(id),
      fetchContactKit(id),
      fetchOutreachHistory(id),
    ]);
    const loaded: Dossier = { detail, contactKit, outreach };
    cache.current.set(id, loaded);
    // A faster click may have moved on — never overwrite its panel.
    if (selectedRef.current === id) setDossier(loaded);
  }

  // Back/forward re-selects from the URL instead of reloading the page.
  useEffect(() => {
    function onPopState() {
      const id = new URL(window.location.href).searchParams.get("id");
      const valid = id && ranked.some((c) => c.id === id) ? id : defaultId;
      void show(valid, false);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ranked, defaultId]);

  // ── Search ──────────────────────────────────────────────
  // Same fields and placeholder as the Book's search, so the two tabs
  // answer the same typing the same way.
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return visible;
    return visible.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q),
    );
  }, [visible, query]);

  // Which controls are actually narrowing the list. The empty state has to
  // name the real cause: four things can empty this rail, and offering to
  // clear the search when the search is blank is a button that does nothing.
  const narrowing: string[] = [];
  if (onlyChanged) narrowing.push("Only new or moved");
  if (triggerFilter !== "all") narrowing.push(triggerFilter);
  if (audit && auditFilter !== "all") narrowing.push("Identity audit");
  const searching = query.trim() !== "";
  function clearAll() {
    setQuery("");
    setOnlyChanged(false);
    setTriggerFilter("all");
    setAuditFilter("all");
  }

  // A card's rank is its place in the whole book, not in the search result.
  // Filtering to three cardiologists must not renumber them 1-2-3.
  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    ranked.forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [ranked]);

  // ── List virtualization ─────────────────────────────────
  // Only the cards near the viewport exist in the DOM; server-rendering
  // all ~1,200 made the first load a multi-megabyte page.
  const listRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATE);
  const [range, setRange] = useState({ start: 0, end: INITIAL_WINDOW });
  const rowHeight = cardHeight + CARD_GAP;

  useEffect(() => {
    const measured = listRef.current?.querySelector("a");
    if (measured) {
      const h = measured.getBoundingClientRect().height;
      if (h > 0 && Math.abs(h - cardHeight) > 1) setCardHeight(h);
    }
    // getBoundingClientRect is viewport-relative, so the same math works
    // whether the aside scrolls (desktop) or the whole page does (mobile).
    function update() {
      const list = listRef.current;
      if (!list) return;
      const top = list.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor(-top / rowHeight) - OVERSCAN);
      const end = Math.min(
        shown.length,
        Math.ceil((window.innerHeight - top) / rowHeight) + OVERSCAN,
      );
      setRange((r) =>
        r.start === start && r.end === end ? r : { start, end },
      );
    }
    update();
    // capture:true hears the aside's own scroll as well as the page's
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // `audit` adds a line to every card, so the measured height must follow it
  }, [rowHeight, cardHeight, shown.length, audit]);

  // A new query or filter means a shorter list under a scroll position
  // measured against the old one. Without this you type and land past the end,
  // looking at blank space where the matches are. The window resets during
  // the render that sees the change (React's adjust-on-prop-change pattern)
  // and only the scrolling waits for the commit.
  const listKey = `${query}\u0000${onlyChanged}\u0000${triggerFilter}\u0000${auditFilter}`;
  const [seenListKey, setSeenListKey] = useState(listKey);
  if (listKey !== seenListKey) {
    setSeenListKey(listKey);
    setRange({ start: 0, end: INITIAL_WINDOW });
  }
  const railRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    railRef.current?.scrollTo({ top: 0 });
    // Mobile scrolls the page rather than the rail.
    if (window.innerWidth < 1024) railRef.current?.scrollIntoView();
  }, [listKey]);

  // Fall back to the ranked row for the selected id while its dossier loads.
  const featured =
    dossier?.detail?.candidate ??
    ranked.find((c) => c.id === selectedId) ??
    ranked[0];
  const detail = dossier?.detail;
  const rank = ranked.findIndex((c) => c.id === featured.id) + 1;

  return (
    <div className="mx-auto grid max-w-[1560px] grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* ── Featured candidate ───────────────────────── */}
      <main className="min-h-[calc(100vh-4rem)] bg-white px-8 py-8">
        <CandidateDetail
          key={featured.id}
          candidate={featured}
          profile={detail?.profile}
          dossier={
            detail
              ? {
                  fieldChanges: detail.fieldChanges,
                  scoreHistory: detail.scoreHistory,
                }
              : undefined
          }
          contactKit={dossier?.contactKit}
          outreach={dossier?.outreach}
          rank={rank}
          total={ranked.length}
        />
      </main>

      {/* ── Ranked list ──────────────────────────────── */}
      <aside
        ref={railRef}
        // No top padding here: `top-0` pins to the padding box, so any pt on
        // the rail becomes a transparent band above the pinned search that
        // the cards scroll through. The heading carries the spacing instead.
        className="border-l border-hairline/60 px-6 pb-8 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto"
      >
        {/* One left edge for the whole column: heading, subtitle, search,
            filter and the cards all start at the same x. The subtitle sat
            right-aligned opposite the heading for a while, which read as a
            second column that nothing below it continued. Stacked tight —
            a 2px gap, not the 12px it used to take. */}
        <div className="pt-5">
          <h2 className="font-display text-[16px] font-bold text-ink">
            All Prospects
          </h2>
          <p className="eyebrow mt-0.5">Ranked by fit score</p>
        </div>

        {/* ── Search ──────────────────────────────────
            Sticky, because the rail scrolls 219 cards under it and a field
            you have to scroll back up to reach is a field you stop using. */}
        <search className="sticky top-0 z-10 -mx-6 mt-2 bg-canvas px-6 pb-2.5 pt-1">
          <div className="relative">
            {/* The field looked like any other text input: the placeholder
                named what you could type but never said it would search.
                The glyph and the verb answer that before you click in. */}
            <svg
              aria-hidden
              viewBox="0 0 14 14"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
            >
              <circle
                cx="6"
                cy="6"
                r="4.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M9.2 9.2 12.2 12.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, specialty or city"
              aria-label="Search prospects by name, specialty or city"
              // The native search clear sits on top of ours; only one × should show.
              className="w-full appearance-none rounded-[8px] border border-hairline bg-white py-2 pl-8 pr-8 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                title="Clear search"
                className="absolute inset-y-0 right-0 px-2.5 text-[15px] leading-none text-ink-faint hover:text-ink"
              >
                ×
              </button>
            ) : null}
          </div>
          {/* Only speaks up once it has something to say about the list. */}
          {query ? (
            <p aria-live="polite" className="mt-2 text-[12px] text-ink-faint">
              {shown.length} of {visible.length} match “{query.trim()}”
            </p>
          ) : null}
        </search>

        {/* ── Filters ──────────────────────────────────────
            Two controls, both of them obviously controls. The tags were
            five filled pills and the sweep was a coloured alert whose
            headline doubled as a button — you could read either without
            realising it did anything. A select and a checkbox say what
            they are before you touch them, and hold any number of tags
            without spending a line each. */}
        {triggerChips.length > 0 || changes.total > 0 ? (
          <div className="mt-2 flex flex-col gap-2 border-b border-hairline/60 pb-2.5">
            {triggerChips.length > 0 ? (
              <div className="relative">
                {/* The label sits inside the box, so this control keeps the
                    same left and right edges as the search above it —
                    an outside label pushed the select in and gave the
                    column a second, ragged edge. Prefixing every option
                    instead would repeat "Why now" five times in the open
                    menu; here it is written once and always visible. */}
                <span
                  aria-hidden
                  // Sentence case, not the eyebrow's uppercase tracking: set
                  // in caps it read as a system tag stamped on the control
                  // rather than the question the advisor is actually asking.
                  // The colon carries it into the value, so the closed
                  // control reads as one phrase — "Why now: Bought a home".
                  className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[12px] text-ink-faint"
                >
                  Why now:
                </span>
                <select
                  value={triggerFilter}
                  onChange={(e) => setTriggerFilter(e.target.value)}
                  aria-label="Filter by why now"
                  title="Show only prospects carrying this trigger"
                  // appearance-none so the caret below is the only one; the
                  // native arrow differs on every platform and the rail is
                  // too narrow to lose the width twice.
                  className="w-full appearance-none rounded-[8px] border border-hairline bg-white py-1.5 pl-[66px] pr-7 font-display text-[12px] font-semibold text-ink focus:border-brand focus:outline-none"
                >
                  <option value="all">Any reason · {ranked.length}</option>
                  {triggerChips.map((chip) => (
                    <option key={chip.label} value={chip.label}>
                      {chip.label} · {chip.count}
                    </option>
                  ))}
                </select>
                {/* An SVG, not a ▾ glyph — that character carries so much of
                    its own whitespace that it reads as a speck at this size,
                    and growing the font to fix it drags the line height with
                    it. A stroked chevron is exactly the size it is set to. */}
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted"
                >
                  <path
                    d="M2.5 4.5 6 8l3.5-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : null}

            {/* Only when a sweep actually moved something. The headline it
                used to shout — "2 new · 3 moved" — is the tooltip now; the
                checkbox says what ticking it does, which the headline
                never did. */}
            {changes.total > 0 ? (
              <label
                title={`${describeChanges(changes)} since the last sweep`}
                // Full width, so the whole line is the target: a checkbox
                // and six words is a small thing to hit, and the empty
                // space beside them was doing nothing. select-none because
                // a click that lands a fraction long otherwise highlights
                // the label instead of reading as a press.
                className="flex w-full cursor-pointer select-none items-center gap-2 text-[12px] text-ink-muted transition-colors hover:text-ink"
              >
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 accent-brand"
                />
                <span>
                  Only new or moved
                  <span className="ml-1 tabular-nums text-ink-faint">
                    · {changes.total}
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {/* ── Identity audit — operator only ───────────── */}
        {audit ? (
          <div className="mt-3 rounded-[12px] border border-dashed border-hairline bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Identity audit</span>
              <button
                type="button"
                onClick={() => setWeakestFirst((v) => !v)}
                aria-pressed={weakestFirst}
                title="Order by identity confidence, weakest merges first"
                className={
                  "shrink-0 rounded-full border px-2 py-0.5 font-display text-[10px] font-semibold transition-colors " +
                  (weakestFirst
                    ? "border-brand bg-brand text-white"
                    : "border-hairline bg-white text-ink-muted hover:bg-surface-soft")
                }
              >
                Weakest first
              </button>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              {describeTiers(counts)}
            </p>

            {/* Chips carry counts, and only tiers with anyone in them get
                one — an empty class is not a filter */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AUDIT_CHIPS.filter(
                (chip) => chip.key === "all" || counts[chip.key] > 0,
              ).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setAuditFilter(chip.key)}
                  aria-pressed={auditFilter === chip.key}
                  title={chip.hint}
                  className={
                    "rounded-full border px-2.5 py-1 font-display text-[11px] font-semibold transition-colors " +
                    (auditFilter === chip.key
                      ? "border-brand bg-brand text-white"
                      : "border-hairline bg-white text-ink-muted hover:bg-surface-soft")
                  }
                >
                  {chip.label}{" "}
                  <span
                    className={
                      auditFilter === chip.key
                        ? "text-white/70"
                        : "text-ink-faint"
                    }
                  >
                    · {counts[chip.key]}
                  </span>
                </button>
              ))}
              {auditFilter === "weak" ? (
                <button
                  type="button"
                  onClick={() => setAuditFilter("all")}
                  aria-pressed
                  title="Barely and single-source together — the top-20 check. Click to clear."
                  className="rounded-full border border-tier-poor bg-tier-poor px-2.5 py-1 font-display text-[11px] font-semibold text-white"
                >
                  Weak identity{" "}
                  <span className="text-white/70">· {counts.weak} ✕</span>
                </button>
              ) : null}
            </div>

            {auditFilter === "all" ? (
              weakInTop20 > 0 ? (
                <button
                  type="button"
                  onClick={() => setAuditFilter("weak")}
                  className="mt-2.5 w-full rounded-[8px] bg-tier-poor-bg px-3 py-2 text-left font-display text-[11px] font-semibold text-tier-poor-fg transition-colors hover:bg-tier-poor-bg/70"
                >
                  ⚠ {weakInTop20} of the top 20 rest on barely or single-source
                  identity — show them
                </button>
              ) : (
                <p className="mt-2.5 text-[11px] text-tier-strong-fg">
                  ✓ All of the top 20 are held together by a licence, an NPI, or
                  a corroborated name.
                </p>
              )
            ) : null}
          </div>
        ) : null}

        {shown.length === 0 ? (
          <div className="mt-3 rounded-[12px] border border-dashed border-hairline px-4 py-6 text-center">
            {/* An empty book is not a filtered-out book: with nothing set
                there is nothing to clear, so no button is offered. */}
            {/* The sentence is a fixed length; what is switched on goes on
                its own line below. Inlining the filter names grew the
                sentence by whatever you happened to pick, so in a rail this
                narrow it habitually left one word stranded on line two. */}
            <p className="text-balance text-[13px] text-ink-muted">
              {!searching && narrowing.length === 0
                ? "No prospects in this book yet."
                : searching
                  ? "Nothing matches your search."
                  : "Nothing matches these filters."}
            </p>
            {searching || narrowing.length > 0 ? (
              <>
                <p className="mt-1.5 break-words text-[12px] leading-[17px] text-ink-faint">
                  {[
                    ...(searching ? [`“${query.trim()}”`] : []),
                    ...narrowing,
                  ].join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-2 text-[13px] font-semibold text-brand hover:underline"
                >
                  {searching && narrowing.length > 0
                    ? "Clear search and filters"
                    : searching
                      ? "Clear search"
                      : "Clear filters"}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <div
            ref={listRef}
            className="relative mt-2.5"
            style={{ height: Math.max(0, shown.length * rowHeight - CARD_GAP) }}
          >
            {shown.slice(range.start, range.end).map((candidate, i) => {
              const index = range.start + i;
              return (
                <div
                  key={candidate.id}
                  className="absolute inset-x-0"
                  style={{ top: index * rowHeight }}
                >
                  <CandidateCard
                    candidate={candidate}
                    rank={rankOf.get(candidate.id) ?? index + 1}
                    active={candidate.id === featured.id}
                    onSelect={() => void show(candidate.id, true)}
                    audit={audit}
                  />
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
