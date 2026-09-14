import Collapsible from "./Collapsible";
import WhatChangedCard from "./WhatChangedCard";
import type { FieldChangeItem } from "@/lib/data";

type Props = {
  fieldChanges: FieldChangeItem[];
};

/** Which recorded facts changed since the last ingest.
 *
 *  The trajectory used to live here too, and now sits beside the fit number
 *  in the header — under the figure it is the history of, rather than in a
 *  band of its own further down the page.
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
}: Props) {
  const hasChanges = fieldChanges.length > 0;
  // One snapshot is a dot, not a trajectory — there is nothing to plot yet.
  // The trajectory moved up beside the fit number it explains, so this band
  // is only the field changes now — and disappears when there are none.
  if (!hasChanges) return null;

  return (
    <div className="mt-7 flex flex-col gap-3">
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
