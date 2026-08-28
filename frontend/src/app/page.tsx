import BookView from "@/components/BookView";
import CandidateCard from "@/components/CandidateCard";
import CandidateDetail from "@/components/CandidateDetail";
import CandidateSlideOver from "@/components/CandidateSlideOver";
import Header from "@/components/Header";
import LaunchOverlay from "@/components/LaunchOverlay";
import ViewToggle from "@/components/ViewToggle";
import { locatedToday } from "@/lib/data";
import { LAUNCH_PARAM } from "@/lib/session";
import { BOOK_VIEW, parseView, viewHref } from "@/lib/view";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchOutreachHistory,
  fetchRankedCandidates,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; launch?: string; view?: string }>;
}) {
  const { id, launch, view } = await searchParams;
  // The opening screen is the front door: it is rendered on every visit and
  // the overlay itself decides whether to stay. A tab that has already begun
  // its review closes it before it paints, so a refresh or a route back from
  // a prospect page still lands on the board.
  // Board or book — the nav toggle writes it to the URL, so the layout
  // survives a refresh and travels with a shared link.
  const layout = parseView(view);
  const ranked = await fetchRankedCandidates();

  if (ranked.length === 0) {
    return (
      <div className="min-h-screen">
        <LaunchOverlay locatedToday={0} total={0} />
        <Header candidateCount={0} />
        <main className="mx-auto max-w-[720px] px-8 py-16 text-center">
          <h1 className="font-display text-[24px] font-bold text-ink">No prospects yet</h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            The backend returned no prospects and ingestion produced nothing. Check that the
            API is running, then POST /ingest/run.
          </p>
        </main>
      </div>
    );
  }

  const selectedId = id && ranked.some((c) => c.id === id) ? id : null;
  // The board always has someone in the panel; the book only opens an entry
  // when one has been asked for, so the spread is readable on its own.
  const featuredId = selectedId ?? (layout === BOOK_VIEW ? null : ranked[0].id);
  // One click shows the whole dossier, so the featured panel needs
  // everything the old standalone profile page fetched.
  const [detail, contactKit, outreach] = featuredId
    ? await Promise.all([
        fetchCandidateDetail(featuredId),
        fetchContactKit(featuredId),
        fetchOutreachHistory(featuredId),
      ])
    : [undefined, undefined, undefined];
  // Fall back to the ranked row for the selected id, never to whoever is first.
  const featured = featuredId
    ? (detail?.candidate ?? ranked.find((c) => c.id === featuredId) ?? ranked[0])
    : undefined;
  const dossier = detail
    ? { fieldChanges: detail.fieldChanges, scoreHistory: detail.scoreHistory }
    : undefined;
  const rank = featured ? ranked.findIndex((c) => c.id === featured.id) + 1 : 0;

  // Fresh arrivals (last 48h) get the NEW badge and the list-top alert
  const newCount = ranked.filter((c) => c.isNew).length;

  return (
    <div className="min-h-screen">
      {/* Opening page — covers the scoreboard until the advisor starts.
          Keyed so asking for it again by wordmark remounts it open. */}
      <LaunchOverlay
        key={launch === "1" ? LAUNCH_PARAM : "visit"}
        locatedToday={locatedToday(ranked)}
        total={ranked.length}
      />

      <Header
        candidateCount={ranked.length}
        viewToggle={<ViewToggle current={layout} candidateId={selectedId} />}
      />

      {layout === BOOK_VIEW ? (
        <>
          <BookView ranked={ranked} selectedId={selectedId} />

          {/* ── Entry panel ────────────────────────────── */}
          {featured ? (
            <CandidateSlideOver
              label={featured.name}
              rank={rank}
              closeHref={viewHref(BOOK_VIEW)}
            >
              <CandidateDetail
                candidate={featured}
                profile={detail?.profile}
                dossier={dossier}
                contactKit={contactKit}
                outreach={outreach}
                rank={rank}
                total={ranked.length}
                headingLevel={2}
              />
            </CandidateSlideOver>
          ) : null}
        </>
      ) : (
        <div className="mx-auto grid max-w-[1560px] grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── Featured candidate ───────────────────────── */}
          <main className="min-h-[calc(100vh-4rem)] bg-white px-8 py-8">
            {featured ? (
              <CandidateDetail
                candidate={featured}
                profile={detail?.profile}
                dossier={dossier}
                contactKit={contactKit}
                outreach={outreach}
                rank={rank}
                total={ranked.length}
              />
            ) : null}
          </main>

          {/* ── Ranked list ──────────────────────────────── */}
          <aside className="border-l border-hairline/60 px-6 py-8 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-ink">All Prospects</h2>
              <span className="rounded-full bg-surface-tint px-2 py-1 font-display text-[11px] font-semibold text-brand-dark">
                {ranked.length} total
              </span>
            </div>
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

            <div className="mt-3 flex flex-col gap-3">
              {ranked.map((candidate, i) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  rank={i + 1}
                  active={candidate.id === featured?.id}
                />
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
