import Link from "next/link";
import { notFound } from "next/navigation";
import CandidateDossier from "@/components/CandidateDossier";
import ReachOutPanel from "@/components/ReachOutPanel";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import Badge from "@/components/Badge";
import { ChartIcon, InfoIcon, PinIcon } from "@/components/icons";
import { percentileOf, tierStyle } from "@/lib/tier";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchRankedCandidates,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/** The prospect's own page. Reached from a row in the book view or a card in
 *  the grid, and the parent of the breakdown and follow-up screens. */
export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, contactKit, ranked] = await Promise.all([
    fetchCandidateDetail(id),
    fetchContactKit(id),
    fetchRankedCandidates(),
  ]);
  if (!detail) notFound();

  const { candidate, profile, fieldChanges, scoreHistory } = detail;
  const style = tierStyle(candidate.tier);
  const rank = ranked.findIndex((c) => c.id === id) + 1;
  const standing =
    rank > 0 ? `Top ${percentileOf(rank, ranked.length)}%` : null;

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[{ label: candidate.name }]}
        back={{ label: "Back to Book View", href: "/" }}
        candidateCount={ranked.length}
      />

      <div className="mx-auto max-w-[1560px] px-8 py-8">
        {/* ── Portrait + overview ────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[290px_minmax(0,1fr)]">
          <div className="relative h-[265px] overflow-hidden rounded-[16px] bg-gradient-to-b from-brand-light to-brand shadow-card">
            <span className="absolute inset-0 flex items-center justify-center font-display text-[64px] font-bold text-white/80">
              {candidate.initials}
            </span>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-4 pt-10">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.55px] text-white backdrop-blur-sm">
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      profile.status === "Active"
                        ? "var(--color-tier-strong)"
                        : "var(--color-tier-neutral)",
                  }}
                />
                {profile.status}
              </span>
              {standing ? (
                <p className="font-display text-[18px] font-bold text-white">
                  {standing} of your book
                </p>
              ) : null}
              <p className="text-[12px] text-white/75">
                Ranked {rank > 0 ? `#${rank}` : "—"} of {ranked.length}{" "}
                prospects
              </p>
            </div>
          </div>

          <div className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="eyebrow">Prospect Profile</p>
                <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
                  {candidate.name}
                </h1>
                <p className="mt-1 text-[14px] text-ink-muted">
                  {candidate.practiceLine}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-muted">
                  <PinIcon className="size-4 shrink-0 text-tier-poor" />
                  {profile.address}
                </p>
              </div>

              <div className="shrink-0 text-center">
                <ScoreRing
                  score={candidate.score}
                  size={92}
                  stroke={7}
                  accent={style.accent}
                  caption="Score"
                  valueSize={22}
                />
                <span className="mt-2 block">
                  <Badge bg={style.badgeBg} fg={style.badgeFg} variant="plain">
                    {candidate.tierLabel}
                  </Badge>
                </span>
              </div>
            </div>

            {/* Trust line: how sure we are these records are the same person */}
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

            <div className="mt-5">
              <p className="eyebrow">Why This Score</p>
              <p className="mt-1 text-[14px] leading-[22px] text-ink-muted">
                {candidate.summary}
              </p>
            </div>

            {candidate.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.tags
                  .filter((tag) => tag !== "Identity Verified")
                  .map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface-soft px-3 py-1.5 text-[12px] text-brand-dark"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── The next action, ahead of the background ───── */}
        {contactKit ? (
          <div className="mt-6">
            <ReachOutPanel kit={contactKit} />
          </div>
        ) : null}

        {/* ── Dossier ────────────────────────────────────── */}
        <div className="mt-6">
          <CandidateDossier
            candidate={candidate}
            profile={profile}
            fieldChanges={fieldChanges}
            scoreHistory={scoreHistory}
          />
        </div>

        {/* ── The two screens that go deeper ─────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            href={`/candidate/${candidate.id}/follow-up`}
            className="flex items-center justify-center gap-2 rounded-[8px] bg-brand px-6 py-3.5 font-display text-[14px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
          >
            <InfoIcon className="size-4" />
            Review &amp; Give Feedback
          </Link>
          <Link
            href={`/candidate/${candidate.id}/breakdown`}
            className="flex items-center justify-center gap-2 rounded-[8px] border border-hairline bg-white px-6 py-3.5 font-display text-[14px] font-semibold text-brand transition-colors hover:bg-surface-soft"
          >
            <ChartIcon className="size-4" />
            Full Score &amp; Match Breakdown
          </Link>
        </div>
      </div>
    </div>
  );
}
