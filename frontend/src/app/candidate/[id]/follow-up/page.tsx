import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import FeedbackPanel from "@/components/FeedbackPanel";
import { fetchCandidateDetail, fetchFeedbackHistory } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FollowUpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchCandidateDetail(id);
  if (!detail) notFound();
  const { candidate, profile, signals } = detail;
  const history = await fetchFeedbackHistory(id);

  const ringAccent =
    candidate.score >= 75
      ? "var(--color-tier-strong)"
      : candidate.score >= 50
        ? "var(--color-tier-neutral)"
        : "var(--color-tier-poor)";

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[
          { label: candidate.name, href: `/candidate/${candidate.id}` },
          { label: "Review & Feedback" },
        ]}
        back={{ label: "Back to Profile", href: `/candidate/${candidate.id}` }}
      />

      <div className="mx-auto max-w-[860px] px-8 py-8">
        <p className="eyebrow">Review &amp; Feedback</p>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          Prospect Assessment
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          {candidate.name} — {profile.practice}
        </p>

        {/* ── Assessment ─────────────────────────────────── */}
        <section className="mt-6 flex flex-col items-start gap-8 rounded-[16px] bg-white p-6 shadow-card sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing
              score={candidate.score}
              size={92}
              stroke={7}
              accent={ringAccent}
              caption="/ 100"
              valueSize={24}
            />
            <span className="rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[11px] font-semibold text-tier-strong-fg">
              {candidate.tierLabel}
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="eyebrow">Why This Prospect Ranked Here</h2>
            <p className="mt-2 text-[14px] leading-[22px] text-ink-muted">{candidate.summary}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: "Qualification", value: `${candidate.qualificationScore}/100` },
                { label: "Timing", value: `${candidate.timingScore}/100` },
                { label: "Licence Held", value: candidate.licenceHeld },
              ].map((stat) => (
                <div key={stat.label} className="min-w-[110px] rounded-[12px] bg-canvas px-4 py-3">
                  <p className="eyebrow">{stat.label}</p>
                  <p className="mt-1 font-display text-[16px] font-semibold text-ink">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Signal evidence ────────────────────────────── */}
        <section className="mt-6 rounded-[16px] bg-white shadow-card">
          <div className="flex items-center gap-2 border-b border-surface-soft px-6 py-4">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-tier-strong" />
            <h2 className="eyebrow">Supporting Signals</h2>
          </div>

          <ol className="flex flex-col gap-3 p-4">
            {signals.map((signal, i) => (
              <li key={`${signal.type}-${signal.source}`} className="flex gap-3 rounded-[12px] bg-canvas p-4">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand font-display text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[14px] font-bold text-ink">
                      {signal.type.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-surface-tint px-2 py-[2px] font-display text-[11px] font-semibold text-brand-dark">
                      {signal.source.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">{signal.description}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.round(signal.strength * 100)}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-ink-faint">
                      {Math.round(signal.strength * 100)}% strength ·{" "}
                      {Math.round(signal.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Advisor feedback (live endpoint) ───────────── */}
        <FeedbackPanel prospectId={candidate.id} initialHistory={history} />
      </div>
    </div>
  );
}
