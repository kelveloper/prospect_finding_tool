import { cookies } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import Badge from "@/components/Badge";
import CandidateCard from "@/components/CandidateCard";
import CandidateDossier from "@/components/CandidateDossier";
import LaunchOverlay from "@/components/LaunchOverlay";
import { ChartIcon, InfoIcon } from "@/components/icons";
import { locatedToday } from "@/lib/data";
import { LAUNCH_COOKIE, LAUNCH_PARAM } from "@/lib/session";
import { tierStyle } from "@/lib/tier";
import { fetchCandidateDetail, fetchContactKit, fetchRankedCandidates } from "@/lib/api";

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
  const [detail, contactKit] = await Promise.all([
    fetchCandidateDetail(featuredId),
    fetchContactKit(featuredId),
  ]);
  // Fall back to the ranked row for the selected id, never to whoever is first.
  const featured =
    detail?.candidate ?? ranked.find((c) => c.id === featuredId) ?? ranked[0];
  const profile = detail?.profile;
  const style = tierStyle(featured.tier);

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
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <p className="eyebrow">{featured.category}</p>
              <h1 className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
                {featured.name}
              </h1>
              <p className="mt-1 text-[16px] text-ink-muted">{featured.practiceLine}</p>
              <p className="mt-2 text-[14px] text-ink-muted">
                📍 {profile?.address ?? featured.location}
              </p>

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
            <ScoreRing
              score={featured.score}
              size={112}
              stroke={8}
              accent={style.accent}
              caption="Score"
              valueSize={24}
            />
          </div>

          {/* Tier + fit bar */}
          <div className="mt-6 flex items-center gap-6">
            <Badge bg={style.badgeBg} fg={style.badgeFg} variant="plain">
              {featured.tierLabel}
            </Badge>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
              <div
                className="h-full rounded-full"
                style={{ width: `${featured.score}%`, backgroundColor: style.accent }}
              />
            </div>
            <span className="shrink-0 font-display text-[14px] font-semibold text-ink-muted">
              {featured.score}/100
            </span>
          </div>

          <hr className="my-6 border-surface-soft" />

          {/* Key stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Licence Held", value: featured.licenceHeld },
              { label: "Qualification", value: `${featured.qualificationScore}/100` },
              { label: "Timing", value: `${featured.timingScore}/100` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[12px] bg-canvas px-4 py-4"
              >
                <p className="eyebrow">{stat.label}</p>
                <p className="mt-1 font-display text-[16px] font-semibold text-ink">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <section className="mt-6">
            <h2 className="eyebrow">Candidate Summary</h2>
            <p className="mt-2 max-w-[620px] text-[14px] leading-[22px] text-ink-muted">
              {featured.summary}
            </p>
          </section>

          {/* Tags */}
          {featured.tags.length > 0 ? (
            <section className="mt-6">
              <h2 className="eyebrow">Tags</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {featured.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-soft px-3 py-1.5 text-[12px] text-brand-dark"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Dossier ──────────────────────────────────── */}
          {detail && profile ? (
            <div className="-mx-8 mt-8 bg-canvas px-8 py-8">
              <h2 className="eyebrow">Candidate Profile</h2>
              <div className="mt-4">
                <CandidateDossier
                  candidate={featured}
                  profile={profile}
                  fieldChanges={detail.fieldChanges}
                  scoreHistory={detail.scoreHistory}
                  contactKit={contactKit}
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
              href={`/candidate/${featured.id}/follow-up`}
              className="flex items-center justify-center gap-2 rounded-[8px] bg-brand px-6 py-3.5 font-display text-[14px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
            >
              <InfoIcon className="size-4" />
              Review &amp; Give Feedback
            </Link>
            <Link
              href={`/candidate/${featured.id}/breakdown`}
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
            <h2 className="font-display text-[16px] font-bold text-ink">All Candidates</h2>
            <span className="rounded-full bg-surface-tint px-2 py-1 font-display text-[11px] font-semibold text-brand-dark">
              {ranked.length} total
            </span>
          </div>
          <p className="eyebrow mt-3">Ranked by fit score</p>

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
