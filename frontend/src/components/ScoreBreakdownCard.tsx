import Link from "next/link";

type Props = {
  prospectId: string;
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
};

/** Summary panel — clicking it opens the full breakdown page (calculation,
 *  scoring rules per tier, and how the identity was matched). */
export default function ScoreBreakdownCard({
  prospectId,
  qualificationScore,
  timingScore,
  totalScore,
}: Props) {
  return (
    <Link
      href={`/candidate/${prospectId}/breakdown`}
      className="block rounded-[16px] bg-white shadow-card transition-shadow hover:shadow-float"
    >
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span
          className="h-4 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: "var(--color-brand)" }}
        />
        <h2 className="eyebrow">Score Breakdown</h2>
      </div>

      <dl className="px-6">
        {[
          { label: "Qualification (60%)", value: `${qualificationScore} / 100` },
          { label: "Timing (40%)", value: `${timingScore} / 100` },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-6 border-b border-surface-soft py-3.5"
          >
            <dt className="text-[14px] text-ink-muted">{row.label}</dt>
            <dd className="text-right font-display text-[14px] font-semibold text-ink">
              {row.value}
            </dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-6 py-3.5">
          <dt className="text-[14px] text-ink-muted">Total Score</dt>
          <dd className="text-right">
            <span className="inline-block rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[13px] font-semibold text-tier-strong-fg">
              {totalScore} / 100
            </span>
          </dd>
        </div>
      </dl>

      <p className="px-6 pb-6 pt-1 text-center font-display text-[13px] font-semibold text-brand">
        Full calculation, scoring rules &amp; match evidence →
      </p>
    </Link>
  );
}
