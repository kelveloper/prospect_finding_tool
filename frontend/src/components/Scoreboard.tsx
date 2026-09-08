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
    if (q === "") return ranked;
    return ranked.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q),
    );
  }, [ranked, query]);

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
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    }
    update();
    // capture:true hears the aside's own scroll as well as the page's
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [rowHeight, cardHeight, shown.length]);

  // A new query means a shorter list under a scroll position measured
  // against the old one. Without this you type and land past the end,
  // looking at blank space where the matches are.
  const railRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setRange({ start: 0, end: INITIAL_WINDOW });
    railRef.current?.scrollTo({ top: 0 });
    // Mobile scrolls the page rather than the rail.
    if (window.innerWidth < 1024) railRef.current?.scrollIntoView();
  }, [query]);

  // Fall back to the ranked row for the selected id while its dossier loads.
  const featured =
    dossier?.detail?.candidate ??
    ranked.find((c) => c.id === selectedId) ??
    ranked[0];
  const detail = dossier?.detail;
  const rank = ranked.findIndex((c) => c.id === featured.id) + 1;

  // Fresh arrivals (last 48h) get the NEW badge and the list-top alert
  const newCount = ranked.filter((c) => c.isNew).length;

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
        <h2 className="pt-8 font-display text-[16px] font-bold text-ink">
          All Prospects
        </h2>
        <p className="eyebrow mt-3">Ranked by fit score</p>

        {/* ── Search ──────────────────────────────────
            Sticky, because the rail scrolls 219 cards under it and a field
            you have to scroll back up to reach is a field you stop using. */}
        <search className="sticky top-0 z-10 -mx-6 mt-3 bg-canvas px-6 pb-3 pt-1">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, specialty or city"
              aria-label="Search prospects by name, specialty or city"
              // The native search clear sits on top of ours; only one × should show.
              className="w-full appearance-none rounded-[8px] border border-hairline bg-white px-3 py-2 pr-8 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
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
              {shown.length} of {ranked.length} match “{query.trim()}”
            </p>
          ) : null}
        </search>

        {/* New-arrivals alert — only rendered when there is something new */}
        {newCount > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-tier-strong-bg px-4 py-3">
            <span className="font-display text-[13px] font-semibold text-tier-strong-fg">
              ✨ {newCount} new prospect{newCount === 1 ? "" : "s"} since the
              last ingest — look for the NEW badge below.
            </span>
          </div>
        ) : null}

        {shown.length === 0 ? (
          <div className="mt-3 rounded-[12px] border border-dashed border-hairline px-4 py-6 text-center">
            <p className="text-[13px] text-ink-muted">
              No prospects match “{query.trim()}”.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 text-[13px] font-semibold text-brand hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div
            ref={listRef}
            className="relative mt-3"
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
