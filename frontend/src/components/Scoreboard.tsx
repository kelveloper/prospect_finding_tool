"use client";

import { useEffect, useRef, useState } from "react";
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
        ranked.length,
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
  }, [rowHeight, cardHeight, ranked.length]);

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
      <aside className="border-l border-hairline/60 px-6 py-8 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <h2 className="font-display text-[16px] font-bold text-ink">
          All Prospects
        </h2>
        <p className="eyebrow mt-3">Ranked by fit score</p>

        {/* New-arrivals alert — only rendered when there is something new */}
        {newCount > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-tier-strong-bg px-4 py-3">
            <span className="font-display text-[13px] font-semibold text-tier-strong-fg">
              ✨ {newCount} new prospect{newCount === 1 ? "" : "s"} since the
              last ingest — look for the NEW badge below.
            </span>
          </div>
        ) : null}

        <div
          ref={listRef}
          className="relative mt-3"
          style={{ height: ranked.length * rowHeight - CARD_GAP }}
        >
          {ranked.slice(range.start, range.end).map((candidate, i) => {
            const index = range.start + i;
            return (
              <div
                key={candidate.id}
                className="absolute inset-x-0"
                style={{ top: index * rowHeight }}
              >
                <CandidateCard
                  candidate={candidate}
                  rank={index + 1}
                  active={candidate.id === featured.id}
                  onSelect={() => void show(candidate.id, true)}
                />
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
