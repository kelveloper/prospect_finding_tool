import CandidateDossier from "./CandidateDossier";
import SectionCard from "./SectionCard";
import ContactKitCard from "./ContactKitCard";
import Citation from "./Citation";
import EvidenceBadge from "./EvidenceBadge";
import ScoreRing from "./ScoreRing";
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
  headingLevel = 1,
}: Props) {
  const style = tierStyle(candidate.tier);
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const Subheading = headingLevel === 2 ? "h3" : "h2";
  const percentile =
    rank && total ? Math.max(1, Math.ceil((rank / total) * 100)) : null;

  // The record itself, rendered inside the trust line's disclosure.
  const dossierRecord = profile ? (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {profile.sections.map((section) => (
        <SectionCard key={section.title} section={section} />
      ))}
    </div>
  ) : null;

  return (
    <>
      {/* ── WHO — name, identity, score. The whole block opens the record. ── */}
      <details className="group -mx-3 -mt-2">
        <summary
          title="Show the licence, practice and property records behind this prospect"
          className="flex cursor-pointer list-none items-start justify-between gap-8 rounded-[12px] px-3 py-2 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden"
        >
          <div className="min-w-0">
            <p className="eyebrow">{candidate.category}</p>
            <Heading className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
              {candidate.name}
            </Heading>
            <p className="mt-1 text-[16px] text-ink-muted">
              {candidate.location}
            </p>

            {/* Trust line: how sure we are these records are one person. */}
            {profile ? (
              <p className="mt-3 flex flex-wrap items-center gap-2">
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

                {/* The affordance for the whole block, not a control of its own —
                  it sits inside the summary, so the click is already handled. */}
                <span className="inline-flex items-center gap-1 font-display text-[12px] font-semibold text-brand opacity-80 transition-opacity group-hover:opacity-100">
                  <span className="group-open:hidden">See the records</span>
                  <span className="hidden group-open:inline">
                    Hide the records
                  </span>
                  <span
                    aria-hidden
                    className="text-[9px] transition-transform group-open:rotate-180"
                  >
                    ▼
                  </span>
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2.5">
            <ScoreRing
              score={candidate.score}
              size={112}
              stroke={8}
              accent={style.accent}
              caption="Score"
              valueSize={24}
            />
            <EvidenceBadge
              evidence={candidate.evidence}
              qualification={candidate.qualificationScore}
              timing={candidate.timingScore}
            />
            {percentile !== null ? (
              <p className="font-display text-[12px] font-semibold text-ink-muted">
                #{rank} of {total} · Top {percentile}%
              </p>
            ) : null}
          </div>
        </summary>

        {dossierRecord ? (
          <div className="px-3 pt-5">{dossierRecord}</div>
        ) : null}
      </details>

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

      {/* ── What changed, and how the score has moved ─── */}
      {dossier && profile ? (
        <CandidateDossier
          candidate={candidate}
          fieldChanges={dossier.fieldChanges}
          scoreHistory={dossier.scoreHistory}
        />
      ) : (
        <p className="mt-8 rounded-[12px] bg-canvas px-4 py-4 text-[13px] text-ink-muted">
          The full dossier for this prospect could not be loaded — the ranked
          summary above is all the API returned.
        </p>
      )}

      {/* The advisor's actual next step — call, write, log the outcome —
          lives in the Reach Out block above. This only answers "how do you
          know?", so it is cited, not offered as a button. */}
      <div className="sources-note mt-8 border-t border-surface-soft pt-4">
        <p className="eyebrow">How we know</p>
        <div className="mt-2">
          <Citation
            href={`/prospect/${candidate.id}/how-we-know`}
            label="The facts, how we matched them, and what each was worth"
          />
        </div>
      </div>
    </>
  );
}
