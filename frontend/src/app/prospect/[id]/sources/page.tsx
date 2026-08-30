import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import SourcesDocument from "@/components/SourcesDocument";
import { fetchCandidateDetail } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One document answering one question: how do we know this? It reads in
 *  pipeline order — the raw facts, then how we knew they were his, then what
 *  each was worth. These used to be two pages and two tabs. */
export default async function SourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchCandidateDetail(id);
  if (!detail) notFound();
  const { candidate, profile, scoreComponents, matches, identityConfidence, signals } =
    detail;
  const signalTypesCount = new Set(signals.map((s) => s.type)).size;

  const ringAccent =
    candidate.score >= 75
      ? "var(--color-tier-strong)"
      : candidate.score >= 50
        ? "var(--color-tier-neutral)"
        : "var(--color-tier-poor)";

  const contents = [
    { href: "#what-we-found", label: "What we found" },
    { href: "#how-we-matched", label: "How we knew it was him" },
    { href: "#how-it-scored", label: "What it was worth" },
  ];

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[
          { label: candidate.name, href: `/?id=${candidate.id}` },
          { label: "Sources" },
        ]}
        back={{ label: "Back to Profile", href: `/?id=${candidate.id}` }}
      />

      <div className="mx-auto max-w-[1560px] px-8 py-8">
        <p className="eyebrow">Sources</p>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          How we know this about {candidate.name}
        </h1>
        <p className="mt-1 max-w-[78ch] text-[14px] text-ink-muted">
          Every fact behind his {candidate.score} out of 100 — where it came
          from, how we knew it was him, and what it was worth.
        </p>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* ── The score, pinned while you read the evidence ────── */}
          <aside className="rounded-[16px] bg-white p-6 shadow-card lg:sticky lg:top-20">
            <div className="flex items-center gap-4">
              <ScoreRing
                score={candidate.score}
                size={92}
                stroke={7}
                accent={ringAccent}
                caption="/ 100"
                valueSize={24}
              />
              <div className="min-w-0">
                <span className="rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[11px] font-semibold text-tier-strong-fg">
                  {candidate.tierLabel}
                </span>
                <p className="mt-2 text-[13px] text-ink-muted">{profile.practice}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {[
                { label: "Worth approaching", value: `${candidate.qualificationScore}/100` },
                { label: "Right time now", value: `${candidate.timingScore}/100` },
                { label: "Licence held", value: candidate.licenceHeld },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-baseline justify-between gap-4 rounded-[10px] bg-canvas px-3.5 py-2.5"
                >
                  <span className="eyebrow">{stat.label}</span>
                  <span className="font-display text-[14px] font-semibold text-ink tabular-nums">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            <nav aria-label="On this page" className="mt-5 border-t border-surface-soft pt-4">
              <p className="eyebrow">On this page</p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {contents.map((c, i) => (
                  <li key={c.href}>
                    <a
                      href={c.href}
                      className="flex gap-2 text-[13px] text-ink-muted transition-colors hover:text-brand"
                    >
                      <span className="font-display font-semibold text-ink-muted">
                        {i + 1}
                      </span>
                      {c.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-5 border-t border-surface-soft pt-4">
              <p className="eyebrow">Why this prospect ranked here</p>
              <p className="mt-2 text-[14px] leading-[22px] text-ink-muted">
                {candidate.summary}
              </p>
            </div>
          </aside>

          <SourcesDocument
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
    </div>
  );
}
