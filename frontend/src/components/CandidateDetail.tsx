import Link from "next/link";
import Badge from "./Badge";
import CandidateDossier from "./CandidateDossier";
import ScoreRing from "./ScoreRing";
import { ChartIcon, InfoIcon } from "./icons";
import type { ContactKit } from "@/lib/api";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  ScoreSnapshotItem,
} from "@/lib/data";
import { tierStyle } from "@/lib/tier";

type Props = {
  candidate: Candidate;
  profile?: CandidateProfile;
  /** History cards; omitted when the detail call failed. */
  dossier?: { fieldChanges: FieldChangeItem[]; scoreHistory: ScoreSnapshotItem[] };
  contactKit?: ContactKit;
  /** Horizontal padding of the panel around this — the dossier band bleeds
   *  out to its edges, so it has to match. */
  gutter?: 6 | 8;
  /** 1 on the board, where the name titles the page; 2 in the slide-over,
   *  which sits under the book's own heading. */
  headingLevel?: 1 | 2;
};

/** Everything the scoreboard knows about one prospect: the identity block,
 *  score ring, key stats, summary, tags, the full dossier and the two links
 *  that go deeper. Shared by the board's fixed panel and the book's
 *  slide-over, which differ only in how much room they have. */
export default function CandidateDetail({
  candidate,
  profile,
  dossier,
  contactKit,
  gutter = 8,
  headingLevel = 1,
}: Props) {
  const style = tierStyle(candidate.tier);
  const bleed = gutter === 6 ? "-mx-6 px-6" : "-mx-8 px-8";
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const Subheading = headingLevel === 2 ? "h3" : "h2";

  return (
    <>
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="eyebrow">{candidate.category}</p>
          <Heading className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
            {candidate.name}
          </Heading>
          <p className="mt-1 text-[16px] text-ink-muted">{candidate.practiceLine}</p>
          <p className="mt-2 text-[14px] text-ink-muted">
            📍 {profile?.address ?? candidate.location}
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
          score={candidate.score}
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
          {candidate.tierLabel}
        </Badge>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full"
            style={{ width: `${candidate.score}%`, backgroundColor: style.accent }}
          />
        </div>
        <span className="shrink-0 font-display text-[14px] font-semibold text-ink-muted">
          {candidate.score}/100
        </span>
      </div>

      <hr className="my-6 border-surface-soft" />

      {/* Key stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Licence Held", value: candidate.licenceHeld },
          { label: "Qualification", value: `${candidate.qualificationScore}/100` },
          { label: "Timing", value: `${candidate.timingScore}/100` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[12px] bg-canvas px-4 py-4">
            <p className="eyebrow">{stat.label}</p>
            <p className="mt-1 font-display text-[16px] font-semibold text-ink">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <section className="mt-6">
        <Subheading className="eyebrow">Candidate Summary</Subheading>
        <p className="mt-2 max-w-[620px] text-[14px] leading-[22px] text-ink-muted">
          {candidate.summary}
        </p>
      </section>

      {/* Tags */}
      {candidate.tags.length > 0 ? (
        <section className="mt-6">
          <Subheading className="eyebrow">Tags</Subheading>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidate.tags.map((tag) => (
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
      {dossier && profile ? (
        <div className={`mt-8 bg-canvas py-8 ${bleed}`}>
          <Subheading className="eyebrow">Candidate Profile</Subheading>
          <div className="mt-4">
            <CandidateDossier
              candidate={candidate}
              profile={profile}
              fieldChanges={dossier.fieldChanges}
              scoreHistory={dossier.scoreHistory}
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
    </>
  );
}
