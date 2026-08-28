import Collapsible from "./Collapsible";
import ScoreBreakdownCard from "./ScoreBreakdownCard";
import SectionCard from "./SectionCard";
import WhatChangedCard from "./WhatChangedCard";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  ScoreSnapshotItem,
} from "@/lib/data";

type Props = {
  candidate: Candidate;
  profile: CandidateProfile;
  fieldChanges: FieldChangeItem[];
  scoreHistory: ScoreSnapshotItem[];
};

/** Everything behind the decision, folded away by default.
 *
 *  The advisor's job is done by the overview and the Reach Out panel above:
 *  who this is, why now, how to contact them. What follows is the evidence —
 *  useful when someone asks "how do you know?", noise when they don't. So it
 *  ships collapsed, split into the record itself and the scoring that read it.
 */
export default function CandidateDossier({
  candidate,
  profile,
  fieldChanges,
  scoreHistory,
}: Props) {
  const rowCount = profile.sections.reduce((n, s) => n + s.rows.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <Collapsible
        title="Full Record"
        hint="Licence, practice, ownership and property detail behind this prospect"
        badge={`${rowCount} fields`}
        contentClassName="bg-canvas px-6 py-5"
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {profile.sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>
      </Collapsible>

      {fieldChanges.length > 0 ? (
        <Collapsible
          title="What Changed"
          hint="Fields that moved since an earlier ingest"
          badge={`${fieldChanges.length}`}
          contentClassName="bg-canvas px-6 py-5"
        >
          <WhatChangedCard changes={fieldChanges} />
        </Collapsible>
      ) : null}

      <Collapsible
        title="How This Score Was Calculated"
        hint="Model explainability — not needed to work the prospect"
        badge={`${candidate.score}/100`}
        contentClassName="bg-canvas px-6 py-5"
      >
        <ScoreBreakdownCard
          prospectId={candidate.id}
          qualificationScore={candidate.qualificationScore}
          timingScore={candidate.timingScore}
          totalScore={candidate.score}
          history={scoreHistory}
        />
      </Collapsible>
    </div>
  );
}
