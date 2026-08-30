import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ScoreRing from "@/components/ScoreRing";
import { fetchCandidateDetail } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Signals below this strength still score points, but they never earn a
 *  sentence in the written summary — the same floor app/scoring uses. */
const NARRATION_FLOOR = 0.3;

/** "PROPERTY_EVENT" → "Property event". The type is the least informative
 *  part of a row, so it reads as a quiet label rather than a shout. */
function typeLabel(type: string): string {
  const words = type.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function FollowUpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchCandidateDetail(id);
  if (!detail) notFound();
  const { candidate, profile, signals } = detail;
  // Strongest first: the raw order is whatever the database returned,
  // which buried the $1.1M deed below a 0.10 enumeration date.
  const ordered = [...signals].sort((a, b) => b.strength - a.strength);

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
          { label: candidate.name, href: `/?id=${candidate.id}` },
          { label: "Signal Evidence" },
        ]}
        back={{ label: "Back to Profile", href: `/?id=${candidate.id}` }}
      />

      <div className="mx-auto max-w-[1560px] px-8 py-8">
        <p className="eyebrow">Signal Evidence</p>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          Prospect Assessment
        </h1>
        <p className="mt-1 max-w-[78ch] text-[14px] text-ink-muted">
          {candidate.name} — {profile.practice}
        </p>

        {/* Two columns: the score is the claim, the signals are the record
            behind it — so they sit side by side rather than stacked. */}
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* ── Assessment rail ──────────────────────────── */}
          <section className="rounded-[16px] bg-white p-6 shadow-card lg:sticky lg:top-20">
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
                <p className="mt-2 text-[13px] text-ink-muted">
                  {ordered.length} signal{ordered.length === 1 ? "" : "s"} on record
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {[
                { label: "Qualification", value: `${candidate.qualificationScore}/100` },
                { label: "Timing", value: `${candidate.timingScore}/100` },
                { label: "Licence Held", value: candidate.licenceHeld },
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

            <div className="mt-5 border-t border-surface-soft pt-4">
              <h2 className="eyebrow">Why This Prospect Ranked Here</h2>
              <p className="mt-2 text-[14px] leading-[22px] text-ink-muted">
                {candidate.summary}
              </p>
            </div>
          </section>

          <section className="rounded-[16px] bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-soft px-6 py-4">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-tier-strong" />
            <h2 className="eyebrow">Supporting Signals</h2>
            <span className="rounded-full bg-surface-tint px-2 py-[2px] font-display text-[11px] font-semibold text-brand-dark">
              {ordered.length}
            </span>
            <p className="ml-auto text-[12px] text-ink-muted">Strongest first</p>
          </div>

          {ordered.length === 0 ? (
            <p className="px-6 py-8 text-[13px] text-ink-muted">
              No signals were recorded for this prospect. The score above rests
              on the scoring rules alone — see the score breakdown for how.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 p-4">
              {ordered.map((signal) => {
                const narrated = signal.strength >= NARRATION_FLOOR;
                return (
                  <li
                    key={`${signal.type}-${signal.source}`}
                    className={
                      "rounded-[12px] px-4 py-3.5 " +
                      (narrated ? "bg-canvas" : "border border-surface-soft")
                    }
                  >
                    {/* The sentence a person can read leads the row; the type
                        code is a label, not a headline. */}
                    <p
                      className={
                        "max-w-[78ch] text-[14px] leading-[21px] " +
                        (narrated ? "font-medium text-ink" : "text-ink-muted")
                      }
                    >
                      {signal.description}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="eyebrow">{typeLabel(signal.type)}</span>
                      <span className="rounded-full bg-surface-tint px-2 py-[2px] font-display text-[11px] font-semibold text-brand-dark">
                        {signal.source.toUpperCase()}
                      </span>
                      {!narrated && (
                        <span className="text-[12px] text-ink-muted">
                          Scored — too weak for the summary
                        </span>
                      )}

                      <div className="ml-auto flex items-center gap-3">
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
                );
              })}
            </ul>
          )}
          </section>
        </div>
      </div>
    </div>
  );
}
