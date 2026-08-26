import { notFound } from "next/navigation";
import Header from "@/components/Header";
import MatchEvidencePanel from "@/components/MatchEvidencePanel";
import ScoreCalculation from "@/components/ScoreCalculation";
import { fetchCandidateDetail } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ScoreBreakdownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchCandidateDetail(id);
  if (!detail) notFound();
  const { candidate, scoreComponents, matches, identityConfidence } = detail;

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[{ label: "Score & Match Breakdown" }]}
        back={{ label: "Back to Profile", href: `/candidate/${candidate.id}` }}
      />

      <div className="mx-auto max-w-[1124px] px-8 py-8">
        <p className="eyebrow">{candidate.specialty}</p>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          {candidate.name} — {candidate.score} / 100
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Every point traced to a public record, and every record traced to the
          match rule that connected it.
        </p>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">The Calculation</h2>
            </div>
            <ScoreCalculation
              qualificationScore={candidate.qualificationScore}
              timingScore={candidate.timingScore}
              totalScore={candidate.score}
              components={scoreComponents}
            />
          </section>

          <section className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">How We Matched This Person</h2>
            </div>
            <MatchEvidencePanel
              matches={matches}
              identityConfidence={identityConfidence}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
