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
    if (audit && auditFilter !== "all")
      list = list.filter((c) => matchesAuditFilter(c.identity, auditFilter));
    if (audit && weakestFirst)
      // Stable: ties keep rank order, so the weakest books come first and
      // the best-ranked of them lead
      list = [...list].sort(
        (a, b) => a.identity.identityConfidence - b.identity.identityConfidence,
      );
    return list;
  }, [ranked, onlyChanged, audit, auditFilter, weakestFirst]);
  // Cards keep their true rank even when the list is filtered
  const rankOf = useMemo(
    () => new Map(ranked.map((c, i) => [c.id, i + 1])),
    [ranked],
  );

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
        visible.length,
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
  }, [rowHeight, cardHeight, visible.length, audit]);

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
      <aside className="border-l border-hairline/60 px-6 py-8 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <h2 className="font-display text-[16px] font-bold text-ink">
          All Prospects
        </h2>
        <p className="eyebrow mt-3">Ranked by fit score</p>

        {/* What changed since the last sweep — the alert is the filter.
            Only rendered when something did; the unchanged majority is the
            default list, not a view of its own. */}
        {changes.total > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-tier-strong-bg px-4 py-2.5">
            <span className="font-display text-[13px] font-semibold text-tier-strong-fg">
              ✨ {describeChanges(changes)} since the last sweep
            </span>
            <button
              type="button"
              onClick={() => setOnlyChanged((v) => !v)}
              aria-pressed={onlyChanged}
              title={
                onlyChanged
                  ? `Back to all ${ranked.length} prospects`
                  : "Show only the prospects that are new or whose score moved"
              }
              className={
                "shrink-0 rounded-full border px-2.5 py-1 font-display text-[11px] font-semibold transition-colors " +
                (onlyChanged
                  ? "border-tier-strong-fg bg-tier-strong-fg text-white"
                  : "border-tier-strong-fg/40 bg-white text-tier-strong-fg hover:bg-tier-strong-bg")
              }
            >
              {onlyChanged ? "Show all" : "Only these"}
            </button>
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

        <div
          ref={listRef}
          className="relative mt-3"
          style={{ height: visible.length * rowHeight - CARD_GAP }}
        >
          {visible.slice(range.start, range.end).map((candidate, i) => {
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
      </aside>
    </div>
  );
}
