import Board from "@/components/Board";
import Header from "@/components/Header";
import LaunchOverlay from "@/components/LaunchOverlay";
import ViewToggle from "@/components/ViewToggle";
import { locatedToday } from "@/lib/data";
import { LAUNCH_PARAM } from "@/lib/session";
import { BOOK_VIEW, parseView } from "@/lib/view";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchOutreachHistory,
  fetchRankedCandidates,
} from "@/lib/api";

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    launch?: string;
    view?: string;
    entry?: string;
  }>;
}) {
  const { id, launch, view, entry } = await searchParams;
  // The opening screen is the front door: it is rendered on every visit and
  // the overlay itself decides whether to stay. A tab that has already begun
  // its review closes it before it paints, so a refresh or a route back from
  // a prospect page still lands on the board.

  // Board or book, and who the reader is placed on — the state store writes
  // all of it to the URL, so a layout survives a refresh and travels with a
  // shared link. This is the only time it is read back; from the first click
  // onwards the client leads and the URL follows.
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

  // Ignore an id or entry naming nobody on the board — a stale link should
  // land on the board, not on an empty panel.
  const placedId = id && ranked.some((c) => c.id === id) ? id : null;
  const openId =
    layout === BOOK_VIEW && entry && ranked.some((c) => c.id === entry)
      ? entry
      : null;
  const state = { layout, id: placedId, entry: openId };

  // The board always has someone in the panel; the book opens one only when
  // the URL asks for it, so the spread is readable on its own.
  const seedId = layout === BOOK_VIEW ? openId : (placedId ?? ranked[0].id);
  // One click shows the whole dossier, so the panel needs everything the old
  // standalone profile page fetched.
  const [detail, contactKit, outreach] = seedId
    ? await Promise.all([
        fetchCandidateDetail(seedId),
        fetchContactKit(seedId),
        fetchOutreachHistory(seedId),
      ])
    : [undefined, undefined, undefined];

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
        viewToggle={<ViewToggle initial={state} />}
      />

      <Board
        ranked={ranked}
        initial={state}
        seedId={seedId}
        seed={{ detail, contactKit, outreach }}
      />
    </div>
  );
}
