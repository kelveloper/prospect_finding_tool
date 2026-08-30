import Collapsible from "./Collapsible";
import ScoreBreakdownCard from "./ScoreBreakdownCard";
import WhatChangedCard from "./WhatChangedCard";
import type { Candidate, FieldChangeItem, ScoreSnapshotItem } from "@/lib/data";

type Props = {
  candidate: Candidate;
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
  fieldChanges,
  scoreHistory,
}: Props) {
  // Nothing here until an ingest gives it something to say, so the whole
  // band disappears rather than standing empty under a heading.
  if (fieldChanges.length === 0 && scoreHistory.length <= 1) return null;

  return (
    <div className="mt-8 flex flex-col gap-4">
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
