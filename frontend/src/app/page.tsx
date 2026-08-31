import BookView from "@/components/BookView";
import CandidateDetail from "@/components/CandidateDetail";
import CandidateSlideOver from "@/components/CandidateSlideOver";
import Scoreboard from "@/components/Scoreboard";
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
          <h1 className="font-display text-[24px] font-bold text-ink">
            No prospects yet
          </h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            The backend returned no prospects and ingestion produced nothing.
            Check that the API is running, then POST /ingest/run.
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
    ? (detail?.candidate ??
      ranked.find((c) => c.id === featuredId) ??
      ranked[0])
    : undefined;
  const dossier = detail
    ? { fieldChanges: detail.fieldChanges, scoreHistory: detail.scoreHistory }
    : undefined;
  const rank = featured ? ranked.findIndex((c) => c.id === featured.id) + 1 : 0;

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
        /* Selection lives client-side: clicking a card swaps the panel and
           fetches one dossier instead of re-rendering the whole board. */
        <Scoreboard
          ranked={ranked}
          initialSelectedId={selectedId}
          initialDossier={{ detail, contactKit, outreach }}
        />
      )}
    </div>
  );
}
