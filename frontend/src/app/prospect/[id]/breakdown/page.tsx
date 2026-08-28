import { notFound } from "next/navigation";
import BreakdownExplorer from "@/components/BreakdownExplorer";
import Header from "@/components/Header";
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
  const { candidate, scoreComponents, matches, identityConfidence, signals } = detail;
  const signalTypesCount = new Set(signals.map((s) => s.type)).size;

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[
          { label: candidate.name, href: `/?id=${candidate.id}` },
          { label: "Score & Match Breakdown" },
        ]}
        back={{ label: "Back to Profile", href: `/?id=${candidate.id}` }}
      />

      <div className="mx-auto max-w-[1124px] px-8 py-8">
        <p className="eyebrow">{candidate.specialty}</p>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          {candidate.name} — {candidate.score} / 100
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          In pipeline order: the gates decide what exists on this dossier,
          then the scoreboard weighs it.
        </p>

        <BreakdownExplorer
          qualificationScore={candidate.qualificationScore}
          timingScore={candidate.timingScore}
          totalScore={candidate.score}
          components={scoreComponents}
          matches={matches}
          identityConfidence={identityConfidence}
          signalTypesCount={signalTypesCount}
          signals={signals}
        />
      </div>
    </div>
  );
}
