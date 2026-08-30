import Badge from "./Badge";
import CandidateDossier from "./CandidateDossier";
import ContactKitCard from "./ContactKitCard";
import Citation from "./Citation";
import ScoreRing from "./ScoreRing";
import ScoreTooltip from "./ScoreTooltip";
import type { ContactKit } from "@/lib/api";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  OutreachEntry,
  ScoreSnapshotItem,
} from "@/lib/data";
import { tierStyle } from "@/lib/tier";

type Props = {
  candidate: Candidate;
  profile?: CandidateProfile;
  /** History cards; omitted when the detail call failed. */
  dossier?: {
    fieldChanges: FieldChangeItem[];
    scoreHistory: ScoreSnapshotItem[];
  };
  contactKit?: ContactKit;
  /** Logged outcomes, shown under the outreach buttons. */
  outreach?: OutreachEntry[];
  /** Where this prospect sits in the whole book. "61.6" means nothing
   *  alone; "#1 of 194 · Top 1%" is the actual pitch. */
  rank?: number;
  total?: number;
  /** Horizontal padding of the panel around this — the dossier band bleeds
   *  out to its edges, so it has to match. */
  gutter?: 6 | 8;
  /** 1 on the board, where the name titles the page; 2 in the slide-over,
   *  which sits under the book's own heading. */
  headingLevel?: 1 | 2;
};

/** Everything the scoreboard knows about one prospect: who they are, the
 *  score in context, why they matter now, how to reach them, what happened
 *  when you did, and the full dossier. Shared by the board's fixed panel
 *  and the book's slide-over, which differ only in how much room they
 *  have. */
export default function CandidateDetail({
  candidate,
  profile,
  dossier,
  contactKit,
  outreach,
  rank,
  total,
  gutter = 8,
  headingLevel = 1,
}: Props) {
  const style = tierStyle(candidate.tier);
  const bleed = gutter === 6 ? "-mx-6 px-6" : "-mx-8 px-8";
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const Subheading = headingLevel === 2 ? "h3" : "h2";
  const percentile =
    rank && total ? Math.max(1, Math.ceil((rank / total) * 100)) : null;

  return (
    <>
      {/* ── WHO — name, one identity line, score with context ── */}
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="eyebrow">{candidate.category}</p>
          <Heading className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
            {candidate.name}
          </Heading>
          <p className="mt-1 text-[16px] text-ink-muted">
            {candidate.location}
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

        <div className="flex shrink-0 flex-col items-center gap-2.5">
          <ScoreTooltip
            qualification={candidate.qualificationScore}
            timing={candidate.timingScore}
          >
            <ScoreRing
              score={candidate.score}
              size={112}
              stroke={8}
              accent={style.accent}
              caption="Score"
              valueSize={24}
            />
          </ScoreTooltip>
          <Badge bg={style.badgeBg} fg={style.badgeFg} variant="plain">
            {candidate.tierLabel}
          </Badge>
          {percentile !== null ? (
            <p className="font-display text-[12px] font-semibold text-ink-muted">
              #{rank} of {total} · Top {percentile}%
            </p>
          ) : null}
        </div>
      </div>

      <hr className="my-6 border-surface-soft" />

      {/* ── WHY NOW — the one paragraph that makes the case ── */}
      <section>
        <Subheading className="eyebrow">Why This Prospect, Now</Subheading>
        <p className="mt-2 max-w-[680px] text-[15px] leading-[24px] text-ink-muted">
          {candidate.summary}
        </p>
      </section>

      {/* ── ACT — contact details and outcome capture in one block ── */}
      {contactKit ? (
        <ContactKitCard
          kit={contactKit}
          prospectId={candidate.id}
          outreach={outreach}
        />
      ) : null}

      {/* ── Dossier ──────────────────────────────────── */}
      {dossier && profile ? (
        <div className={`mt-8 bg-canvas py-8 ${bleed}`}>
          <Subheading className="eyebrow">Prospect Profile</Subheading>
          <div className="mt-4">
            <CandidateDossier
              candidate={candidate}
              profile={profile}
              fieldChanges={dossier.fieldChanges}
              scoreHistory={dossier.scoreHistory}
            />
          </div>
        </div>
      ) : (
        <p className="mt-8 rounded-[12px] bg-canvas px-4 py-4 text-[13px] text-ink-muted">
          The full dossier for this prospect could not be loaded — the ranked
          summary above is all the API returned.
        </p>
      )}

      {/* Sources. The advisor's actual next step — call, write, log the
          outcome — lives in the Reach Out block above; these two only answer
          "how do you know?", so they are cited, not offered as buttons. */}
      <div className="sources-note mt-8 border-t border-surface-soft pt-4">
        <p className="eyebrow">Sources</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-8">
          <Citation
            href={`/prospect/${candidate.id}/follow-up`}
            label="The signals behind this prospect"
          />
          <Citation
            href={`/prospect/${candidate.id}/breakdown`}
            label="How this score was built — weights, rules and match evidence"
          />
        </div>
      </div>
    </>
  );
}
