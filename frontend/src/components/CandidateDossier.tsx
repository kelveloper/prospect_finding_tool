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
export default function CandidateDossier({
  fieldChanges,
  scoreHistory,
}: Props) {
  const hasChanges = fieldChanges.length > 0;
  // One snapshot is a dot, not a trajectory — there is nothing to plot yet.
  const hasTrajectory = scoreHistory.length > 1;
  // A flat line across eight sweeps is real information, and it is "nothing
  // happened" — which does not deserve a section and a chart above the
  // reason to call. Folded away until the fit has actually moved.
  const moved =
    hasTrajectory &&
    scoreHistory.some((s) => s.total !== scoreHistory[0].total);

  // Nothing here until an ingest gives it something to say, so the whole
  // band disappears rather than standing empty under a heading.
  if (!hasChanges && !hasTrajectory) return null;

  return (
    <div className="mt-5 flex flex-col gap-3">
      {hasTrajectory ? (
        <details className="group/fit">
          {/* Two hundred pixels of chart to show a point or two of drift was
              the worst value per pixel on the page, and it sat between the
              advisor and the rest of the profile. The summary carries the
              only part most readers want — where it is now, and whether it
              moved — and the chart is one click away for the times it is
              the question. */}
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-ink-muted [&::-webkit-details-marker]:hidden">
            <span className="font-display font-semibold text-ink">
              Fit {scoreHistory[scoreHistory.length - 1].total}
            </span>
            <span>
              {moved
                ? `moved across ${scoreHistory.length} ingests`
                : `steady across ${scoreHistory.length} ingests`}
            </span>
            <span className="font-display text-[12px] font-semibold text-brand group-open/fit:hidden">
              Show history
            </span>
            <span className="hidden font-display text-[12px] font-semibold text-brand group-open/fit:inline">
              Hide history
            </span>
          </summary>

          <div className="mt-3 rounded-[16px] bg-white px-6 py-4 shadow-card">
            <p className="text-[12px] text-ink-muted">
              Hover a point for that ingest&rsquo;s scores and why they moved
              &middot; {scoreHistory.length} snapshots
            </p>
            <div className="mt-3">
              <ScoreSparkline history={scoreHistory} changes={fieldChanges} />
            </div>
          </div>
        </details>
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
