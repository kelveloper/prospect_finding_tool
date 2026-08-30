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
 *  The advisor's job is done further up the page: who this is, why now, how to
 *  reach them, and logging what happened. What follows is the record the score
 *  was read from — worth having when someone asks "how do you know?", noise
 *  when they don't. So it ships collapsed, each heading carrying enough (a
 *  field count, the score) to be skipped without being opened. */
export default function CandidateDossier({
  candidate,
  profile,
  fieldChanges,
  scoreHistory,
}: Props) {
  const fieldCount = profile.sections.reduce((n, s) => n + s.rows.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <Collapsible
        title="Full Record"
        hint="Licence, practice and property detail behind this prospect"
        badge={`${fieldCount} fields`}
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
        >
          <WhatChangedCard changes={fieldChanges} />
        </Collapsible>
      ) : null}

      {scoreHistory.length > 1 ? (
        <Collapsible
          title="Score History"
          hint="How this score has moved across ingests"
          badge={`${scoreHistory.length} snapshots`}
        >
          <ScoreBreakdownCard
            qualificationScore={candidate.qualificationScore}
            timingScore={candidate.timingScore}
            totalScore={candidate.score}
            history={scoreHistory}
          />
        </Collapsible>
      ) : null}
    </div>
  );
}
