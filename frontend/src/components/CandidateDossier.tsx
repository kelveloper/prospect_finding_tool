import ContactKitCard from "./ContactKitCard";
import ScoreBreakdownCard from "./ScoreBreakdownCard";
import SectionCard from "./SectionCard";
import WhatChangedCard from "./WhatChangedCard";
import type { ContactKit } from "@/lib/api";
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
  contactKit?: ContactKit;
};

/** The full dossier grid — Career Signal / Ownership & Practice / Financial
 *  Activity, plus what changed, the contact kit and the score summary.
 *  Rendered inline under the scoreboard's featured panel; two-up once the
 *  viewport is wide enough for the panel to carry two cards. */
export default function CandidateDossier({
  candidate,
  profile,
  fieldChanges,
  scoreHistory,
  contactKit,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {profile.sections.map((section) => (
        <SectionCard key={section.title} section={section} />
      ))}
      {fieldChanges.length > 0 && <WhatChangedCard changes={fieldChanges} />}
      {contactKit && <ContactKitCard kit={contactKit} />}
      <ScoreBreakdownCard
        prospectId={candidate.id}
        qualificationScore={candidate.qualificationScore}
        timingScore={candidate.timingScore}
        totalScore={candidate.score}
        history={scoreHistory}
      />
    </div>
  );
}
