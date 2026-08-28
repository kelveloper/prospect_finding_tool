import Link from "next/link";
import Header from "@/components/Header";
import CandidateCard from "@/components/CandidateCard";
import BookViewTable from "@/components/BookViewTable";
import { fetchRankedCandidates } from "@/lib/api";

export const dynamic = "force-dynamic";

/** How many prospects the cards view shows. It answers "who do I call today",
 *  so it is a shortlist — the whole book lives in the table. */
const TOP_N = 16;

/** Table vs. cards. Lives in the URL so a view is linkable and survives a
 *  refresh. Both show the same board — one dense, one visual. */
function ViewToggle({ view }: { view: "cards" | "table" }) {
  const tabs = [
    { key: "table", label: "Book view", href: "/" },
    { key: "cards", label: "Cards", href: "/?view=cards" },
  ] as const;

  return (
    <div
      role="tablist"
      aria-label="Prospect list layout"
      className="inline-flex gap-1 rounded-[10px] bg-surface-soft p-1"
    >
      {tabs.map((tab) => {
        const active = tab.key === view;
        return (
          <Link
            key={tab.key}
            href={tab.href}
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
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const ranked = await fetchRankedCandidates();

  if (ranked.length === 0) {
    return (
      <div className="min-h-screen">
        <Header pill="Scoreboard" candidateCount={0} />
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

  // Book view is the default landing screen; cards are opt-in via ?view=cards.
  // Neither needs per-candidate detail — that lives on /candidate/[id].
  const cards = view === "cards";

  return (
    <div className="min-h-screen">
      <Header pill={cards ? "Cards" : "Book View"} candidateCount={ranked.length} />

      <main className="mx-auto max-w-[1560px] px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Your Book</p>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
              {cards ? "Top Prospects" : "All Prospects"}
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              {cards
                ? `The ${TOP_N} strongest leads on your book right now. Click a card to open the full profile.`
                : "Sort any column, filter by specialty or tier, then click a row to open the full profile."}
            </p>
          </div>
          <ViewToggle view={cards ? "cards" : "table"} />
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
                href="/"
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
