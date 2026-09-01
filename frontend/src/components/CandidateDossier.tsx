import Collapsible from "./Collapsible";
import ScoreSparkline from "./ScoreSparkline";
import WhatChangedCard from "./WhatChangedCard";
import type { FieldChangeItem, ScoreSnapshotItem } from "@/lib/data";

type Props = {
  fieldChanges: FieldChangeItem[];
  scoreHistory: ScoreSnapshotItem[];
};

/** What has happened to this prospect since the last ingest.
 *
 *  The trajectory is shown, not folded away: it is one line, it answers
 *  "is this prospect rising or cooling?" at a glance, and a chart behind a
 *  Show button is a chart nobody opens. Each point carries its own snapshot
 *  on hover, so the detail is there without a second panel to hold it.
 *
 *  The field list stays collapsed — it is a long read for the one advisor in
 *  ten who asks which values moved, not a glance.
 *
 *  What the score is *made of* is deliberately absent here; the "?" beside
 *  the ring at the top of the profile already carries the qualification and
 *  timing split, and printing it twice made this look like new information
 *  when half of it was a copy. */
export default function CandidateDossier({ fieldChanges, scoreHistory }: Props) {
  const hasChanges = fieldChanges.length > 0;
  // One snapshot is a dot, not a trajectory — there is nothing to plot yet.
  const hasTrajectory = scoreHistory.length > 1;

  // Nothing here until an ingest gives it something to say, so the whole
  // band disappears rather than standing empty under a heading.
  if (!hasChanges && !hasTrajectory) return null;

  return (
    <div className="mt-8 flex flex-col gap-4">
      {hasTrajectory ? (
        <section className="rounded-[16px] bg-white px-6 py-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
            <h2 className="eyebrow">Score Across Ingests</h2>
            <span className="ml-auto rounded-full bg-canvas px-2.5 py-1 font-display text-[11px] font-semibold text-ink-muted">
              {scoreHistory.length} snapshots
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Hover a point for that ingest&rsquo;s scores
          </p>

          <div className="mt-3">
            <ScoreSparkline history={scoreHistory} />
          </div>
        </section>
      ) : null}

      {hasChanges ? (
        <Collapsible
          title="What Changed"
          hint="Fields that moved since an earlier ingest"
          badge={`${fieldChanges.length} update${fieldChanges.length === 1 ? "" : "s"}`}
        >
          <WhatChangedCard changes={fieldChanges} />
        </Collapsible>
      ) : null}
    </div>
  );
}
