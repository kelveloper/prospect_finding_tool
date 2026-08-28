import Link from "next/link";
import Header from "@/components/Header";
import Badge from "@/components/Badge";
import BookViewTable from "@/components/BookViewTable";
import CandidateCard from "@/components/CandidateCard";
import CandidateDossier from "@/components/CandidateDossier";
import ReachOutPanel from "@/components/ReachOutPanel";
import ScoreRing from "@/components/ScoreRing";
import { ChartIcon, InfoIcon } from "@/components/icons";
import { percentileOf, tierStyle } from "@/lib/tier";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchRankedCandidates,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/** How many prospects the cards view shows. It answers "who do I call today",
 *  so it is a shortlist — the whole book lives in the table. */
const TOP_N = 16;

type View = "table" | "cards" | "scoreboard";

const TABS: { key: View; label: string }[] = [
  { key: "scoreboard", label: "Scoreboard" },
  { key: "table", label: "Book view" },
  { key: "cards", label: "Cards" },
];

/** Which layout the board is drawn in. Lives in the URL so a view is linkable
 *  and survives a refresh. */
function ViewToggle({ view, id }: { view: View; id?: string }) {
  function hrefFor(key: View): string {
    if (key === "table") return "/?view=table";
    if (key === "cards") return "/?view=cards";
    // Only the scoreboard has a selection to carry across a toggle.
    return id ? `/?id=${id}` : "/";
  }

  return (
    <div
      role="tablist"
      aria-label="Prospect list layout"
      className="inline-flex gap-1 rounded-[10px] bg-surface-soft p-1"
    >
      {TABS.map((tab) => {
        const active = tab.key === view;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            role="tab"
            aria-selected={active}
            className={
              "rounded-[8px] px-3.5 py-1.5 font-display text-[13px] font-semibold transition-colors " +
              (active
                ? "bg-white text-brand shadow-raised"
                : "text-ink-muted hover:text-brand")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; id?: string }>;
}) {
  const { view: rawView, id } = await searchParams;
  const ranked = await fetchRankedCandidates();

  if (ranked.length === 0) {
    return (
      <div className="min-h-screen">
        <Header pill="Scoreboard" candidateCount={0} />
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

  // Scoreboard is the landing view; the other two are opt-in via ?view=.
  const view: View =
    rawView === "cards"
      ? "cards"
      : rawView === "table"
        ? "table"
        : "scoreboard";

  /* ── Scoreboard: one prospect open beside the ranked list ─────────── */
  if (view === "scoreboard") {
    // Fall back to the ranked row for the selected id, never to whoever is first.
    const featuredId =
      id && ranked.some((c) => c.id === id) ? id : ranked[0].id;
    const [detail, contactKit] = await Promise.all([
      fetchCandidateDetail(featuredId),
      fetchContactKit(featuredId),
    ]);

    const featured =
      detail?.candidate ?? ranked.find((c) => c.id === featuredId) ?? ranked[0];
    const profile = detail?.profile;
    const style = tierStyle(featured.tier);
    const rank = ranked.findIndex((c) => c.id === featured.id) + 1;

    return (
      <div className="min-h-screen">
        <Header
          candidateCount={ranked.length}
          viewToggle={<ViewToggle view="scoreboard" id={featured.id} />}
        />

        <main className="mx-auto max-w-[1560px] px-8 py-8">
          <div>
            <p className="eyebrow text-ink-muted">Your Book</p>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
              Scoreboard
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              Ranked by fit score. Pick a prospect on the right to open them
              here.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* ── Featured prospect ──────────────────────── */}
            <div className="flex flex-col gap-6">
              <div className="rounded-[16px] bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-8">
                  <div className="min-w-0">
                    <p className="eyebrow text-ink-muted">
                      {featured.category}
                    </p>
                    <h2 className="mt-1 font-display text-[22px] font-bold tracking-[-0.5px] text-ink">
                      {featured.name}
                    </h2>
                    <p className="mt-1 text-[16px] text-ink-muted">
                      {featured.practiceLine}
                    </p>
                    <p className="mt-2 text-[14px] text-ink-muted">
                      {profile?.address ?? featured.location}
                    </p>

                    {/* Trust line: how sure we are these records are one person */}
                    {profile ? (
                      <p className="mt-3">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold " +
                            (profile.identityVerified
                              ? "bg-tier-strong-bg text-tier-strong-fg"
                              : "bg-tier-neutral-bg text-tier-neutral-fg")
                          }
                        >
                          {profile.identityVerified ? "✓" : "◌"}{" "}
                          {profile.identityLine}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-center">
                    <ScoreRing
                      score={featured.score}
                      size={112}
                      stroke={8}
                      accent={style.accent}
                      caption="Score"
                      valueSize={24}
                    />
                    {rank > 0 ? (
                      <span className="mt-2 block font-display text-[12px] font-semibold text-ink-muted">
                        #{rank} of {ranked.length}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Standing + fit bar */}
                <div className="mt-6 flex items-center gap-6">
                  <Badge bg={style.badgeBg} fg={style.badgeFg} variant="plain">
                    {rank > 0
                      ? `Top ${percentileOf(rank, ranked.length)}% of your book`
                      : featured.tierLabel}
                  </Badge>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${featured.score}%`,
                        backgroundColor: style.accent,
                      }}
                    />
                  </div>
                  <span className="shrink-0 font-display text-[14px] font-semibold text-ink-muted">
                    {featured.score}/100
                  </span>
                </div>

                {/* Summary */}
                <section className="mt-6">
                  <h3 className="eyebrow text-ink-muted">Candidate Summary</h3>
                  <p className="mt-2 max-w-[68ch] text-[14px] leading-[22px] text-ink-muted">
                    {featured.summary}
                  </p>
                </section>
              </div>

              {/* The next action, then the evidence behind it */}
              {contactKit ? <ReachOutPanel kit={contactKit} /> : null}

              {detail && profile ? (
                <div>
                  <CandidateDossier
                    candidate={featured}
                    profile={profile}
                    fieldChanges={detail.fieldChanges}
                    scoreHistory={detail.scoreHistory}
                  />
                </div>
              ) : (
                <p className="rounded-[12px] bg-white px-4 py-4 text-[13px] text-ink-muted shadow-card">
                  The full dossier for this prospect could not be loaded — the
                  ranked summary above is all the API returned.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Link
                  href={`/candidate/${featured.id}`}
                  className="flex items-center justify-center gap-2 rounded-[8px] bg-brand px-6 py-3.5 font-display text-[14px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
                >
                  Open Full Profile
                </Link>
                <Link
                  href={`/candidate/${featured.id}/follow-up`}
                  className="flex items-center justify-center gap-2 rounded-[8px] border border-hairline bg-white px-6 py-3.5 font-display text-[14px] font-semibold text-brand transition-colors hover:bg-surface-soft"
                >
                  <InfoIcon className="size-4" />
                  Give Feedback
                </Link>
                <Link
                  href={`/candidate/${featured.id}/breakdown`}
                  className="flex items-center justify-center gap-2 rounded-[8px] border border-hairline bg-white px-6 py-3.5 font-display text-[14px] font-semibold text-brand transition-colors hover:bg-surface-soft"
                >
                  <ChartIcon className="size-4" />
                  Score Breakdown
                </Link>
              </div>
            </div>

            {/* ── Ranked list ────────────────────────────── */}
            <aside className="rounded-[16px] bg-white p-5 shadow-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-[15px] font-bold text-ink">
                  All Prospects
                </h2>
                <span className="rounded-full bg-surface-tint px-2 py-1 font-display text-[11px] font-semibold text-brand-dark">
                  {ranked.length} total
                </span>
              </div>

              <ul className="mt-4 flex flex-col gap-3">
                {ranked.map((candidate, i) => (
                  <li key={candidate.id}>
                    <CandidateCard
                      candidate={candidate}
                      rank={i + 1}
                      total={ranked.length}
                      href={`/?id=${candidate.id}`}
                      active={candidate.id === featured.id}
                    />
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </main>
      </div>
    );
  }

  /* ── Book view and cards ──────────────────────────────────────────── */
  const cards = view === "cards";

  return (
    <div className="min-h-screen">
      <Header
        candidateCount={ranked.length}
        viewToggle={<ViewToggle view={view} />}
      />

      <main className="mx-auto max-w-[1560px] px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-ink-muted">Your Book</p>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
              {cards ? "Top Prospects" : "All Prospects"}
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              {cards
                ? `The ${TOP_N} strongest leads on your book right now. Click a card to open the full profile.`
                : "Sort any column, filter by specialty or tier, then click a row to open the full profile."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          {cards ? (
            <>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ranked.slice(0, TOP_N).map((candidate, i) => (
                  <li key={candidate.id}>
                    <CandidateCard
                      candidate={candidate}
                      rank={i + 1}
                      total={ranked.length}
                    />
                  </li>
                ))}
              </ul>

              <Link
                href="/?view=table"
                className="mt-6 inline-flex items-center gap-2 rounded-[8px] border border-hairline bg-white px-5 py-3 font-display text-[14px] font-semibold text-brand shadow-raised transition-colors hover:bg-surface-soft"
              >
                See all {ranked.length} prospects in book view →
              </Link>
            </>
          ) : (
            <BookViewTable candidates={ranked} />
          )}
        </div>
      </main>
    </div>
  );
}
