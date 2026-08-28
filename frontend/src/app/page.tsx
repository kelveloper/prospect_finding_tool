import { cookies } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import Badge from "@/components/Badge";
import CandidateCard from "@/components/CandidateCard";
import CandidateDossier from "@/components/CandidateDossier";
import ContactKitCard from "@/components/ContactKitCard";
import LaunchOverlay from "@/components/LaunchOverlay";
import { ChartIcon, InfoIcon } from "@/components/icons";
import { locatedToday } from "@/lib/data";
import { LAUNCH_COOKIE, LAUNCH_PARAM } from "@/lib/session";
import { tierStyle } from "@/lib/tier";
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
  searchParams: Promise<{ id?: string; launch?: string }>;
}) {
  const { id, launch } = await searchParams;
  // The opening screen is a session-level decision, not component state:
  // it shows on the first visit, and after that only when the wordmark is
  // used to ask for it. Every other route back here lands on the board.
  const started = (await cookies()).has(LAUNCH_COOKIE);
  const showLaunch = launch === "1" || !started;
  const ranked = await fetchRankedCandidates();

  if (ranked.length === 0) {
    return (
      <div className="min-h-screen">
        {showLaunch ? <LaunchOverlay locatedToday={0} total={0} /> : null}
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

  const featuredId = id && ranked.some((c) => c.id === id) ? id : ranked[0].id;
  // One click on a card shows the whole dossier here, so the featured panel
  // needs everything the old standalone profile page fetched.
  const [detail, contactKit, outreach] = await Promise.all([
    fetchCandidateDetail(featuredId),
    fetchContactKit(featuredId),
    fetchOutreachHistory(featuredId),
  ]);
  // Fall back to the ranked row for the selected id, never to whoever is first.
  const featured =
    detail?.candidate ?? ranked.find((c) => c.id === featuredId) ?? ranked[0];
  const profile = detail?.profile;
  const style = tierStyle(featured.tier);

  // Score context: where this prospect sits in the advisor's whole book.
  // "61.6" means nothing alone; "#1 of 194 · Top 1%" is the actual pitch.
  const rank = ranked.findIndex((c) => c.id === featured.id) + 1;
  const percentile = Math.max(1, Math.ceil((rank / ranked.length) * 100));

  // Fresh arrivals (last 48h) get the NEW badge and the list-top alert
  const newCount = ranked.filter((c) => c.isNew).length;

  return (
    <div className="min-h-screen">
      {/* Opening page — covers the scoreboard until the advisor starts.
          Keyed so asking for it again by wordmark remounts it open. */}
      {showLaunch ? (
        <LaunchOverlay
          key={launch === "1" ? LAUNCH_PARAM : "first-visit"}
          locatedToday={locatedToday(ranked)}
          total={ranked.length}
        />
      ) : null}

      <Header pill="Scoreboard" candidateCount={ranked.length} />

      <div className="mx-auto grid max-w-[1560px] grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Featured candidate ─────────────────────────── */}
        <main className="min-h-[calc(100vh-4rem)] bg-white px-8 py-8">
          {/* ── WHO — name, one identity line, score with context ── */}
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <p className="eyebrow">{featured.category}</p>
              <h1 className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
                {featured.name}
              </h1>
              <p className="mt-1 text-[16px] text-ink-muted">{featured.location}</p>

              {/* Trust line: how sure we are these records are the same person */}
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
                    {profile.identityVerified ? "✓" : "◌"} {profile.identityLine}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2.5">
              <ScoreRing
                score={featured.score}
                size={112}
                stroke={8}
                accent={style.accent}
                caption="Score"
                valueSize={24}
              />
              <Badge bg={style.badgeBg} fg={style.badgeFg} variant="plain">
                {featured.tierLabel}
              </Badge>
              <p className="font-display text-[12px] font-semibold text-ink-muted">
                #{rank} of {ranked.length} · Top {percentile}%
              </p>
            </div>
          </div>

          <hr className="my-6 border-surface-soft" />

          {/* ── WHY NOW — the one paragraph that makes the case ── */}
          <section>
            <h2 className="eyebrow">Why This Prospect, Now</h2>
            <p className="mt-2 max-w-[680px] text-[15px] leading-[24px] text-ink-muted">
              {featured.summary}
            </p>
          </section>

          {/* ── ACT — contact details and outcome capture in one block ── */}
          {contactKit ? (
            <ContactKitCard
              kit={contactKit}
              prospectId={featured.id}
              outreach={outreach}
            />
          ) : null}

          {/* ── Dossier ──────────────────────────────────── */}
          {detail && profile ? (
            <div className="-mx-8 mt-8 bg-canvas px-8 py-8">
              <h2 className="eyebrow">Prospect Profile</h2>
              <div className="mt-4">
                <CandidateDossier
                  candidate={featured}
                  profile={profile}
                  fieldChanges={detail.fieldChanges}
                  scoreHistory={detail.scoreHistory}
                />
              </div>
            </div>
          ) : (
            <p className="mt-8 rounded-[12px] bg-canvas px-4 py-4 text-[13px] text-ink-muted">
              The full dossier for this prospect could not be loaded — the ranked
              summary above is all the API returned.
            </p>
          )}

          {/* Actions — the two pages that go deeper than this dossier */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href={`/prospect/${featured.id}/follow-up`}
              className="flex items-center justify-center gap-2 rounded-[8px] bg-brand px-6 py-3.5 font-display text-[14px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
            >
              <InfoIcon className="size-4" />
              Supporting Signal Evidence
            </Link>
            <Link
              href={`/prospect/${featured.id}/breakdown`}
              className="flex items-center justify-center gap-2 rounded-[8px] border border-hairline bg-white px-6 py-3.5 font-display text-[14px] font-semibold text-brand transition-colors hover:bg-surface-soft"
            >
              <ChartIcon className="size-4" />
              Full Score &amp; Match Breakdown
            </Link>
          </div>
        </main>

        {/* ── Ranked list ────────────────────────────────── */}
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
                active={candidate.id === featured.id}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
