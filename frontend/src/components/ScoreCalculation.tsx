import type { ScoreComponentItem } from "@/lib/data";

/** The math, made visible:
 *  Step 1 — every signal earns points: strength (0–1) × weight = points.
 *  Step 2 — the two subtotals blend: total = qual × 0.6 + timing × 0.4.
 *  The segmented bars are drawn to scale: segment width = the weight,
 *  fill = the strength, so filled area literally IS the score. */

function FormulaRow({ item, color }: { item: ScoreComponentItem; color: string }) {
  const empty = item.points === 0;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`min-w-0 truncate text-[13px] ${empty ? "text-ink-faint" : "text-ink-muted"}`}>
        {item.label}
      </span>
      <span
        className={
          "shrink-0 font-display text-[13px] tabular-nums " +
          (empty ? "text-ink-faint" : "text-ink")
        }
      >
        <span className={empty ? "" : "font-semibold"} style={empty ? undefined : { color }}>
          {item.strength.toFixed(2)}
        </span>
        <span className="text-ink-faint"> × {item.maxPoints} = </span>
        <span className={empty ? "" : "font-bold"}>{item.points}</span>
        <span className="text-ink-faint"> pts</span>
      </span>
    </div>
  );
}

function SegmentedBar({
  items,
  color,
}: {
  items: ScoreComponentItem[];
  color: string;
}) {
  return (
    <div>
      <div className="flex h-7 w-full gap-[3px]">
        {items.map((item) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.points} of ${item.maxPoints} pts`}
            className="relative overflow-hidden rounded-[6px] bg-surface-soft"
            style={{ width: `${item.maxPoints}%` }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${item.strength * 100}%`, backgroundColor: color }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {items.map((item) => (
          <span
            key={item.label}
            className="truncate text-center text-[10px] text-ink-faint"
            style={{ width: `${item.maxPoints}%` }}
          >
            {item.maxPoints}
          </span>
        ))}
      </div>
    </div>
  );
}

function Step({
  step,
  title,
  explainer,
  items,
  subtotal,
  color,
}: {
  step: string;
  title: string;
  explainer: string;
  items: ScoreComponentItem[];
  subtotal: number;
  color: string;
}) {
  return (
    <div className="rounded-[12px] bg-canvas px-4 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">
          <span style={{ color }}>{step}</span> {title}
        </p>
        <p className="shrink-0 font-display text-[15px] font-bold text-ink tabular-nums">
          {subtotal} <span className="text-[12px] font-normal text-ink-faint">/ 100</span>
        </p>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-faint">{explainer}</p>

      <div className="mt-3">
        <SegmentedBar items={items} color={color} />
      </div>

      <div className="mt-3 border-t border-surface-soft pt-2">
        {items.map((item) => (
          <FormulaRow key={item.label} item={item} color={color} />
        ))}
      </div>
    </div>
  );
}

export default function ScoreCalculation({
  qualificationScore,
  timingScore,
  totalScore,
  components,
}: {
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
}) {
  const qual = components.filter((c) => c.category === "qualification");
  const timing = components.filter((c) => c.category === "timing");
  const QUAL_COLOR = "var(--color-brand)";
  const TIMING_COLOR = "var(--color-tier-strong)";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-[20px] text-ink-muted">
        Every signal earns points the same way:{" "}
        <span className="font-semibold text-ink">strength × weight = points</span>.
        Strength (0–1) comes from the signal itself — how recent, what tier,
        what kind of entity. Weight is fixed in code. Segment width below = the
        weight; how full it is = the strength.
      </p>

      <Step
        step="STEP 1a"
        title="Qualification — should we care?"
        explainer="Three signals can earn up to 100: physician 40 + specialty 35 + ownership 25."
        items={qual}
        subtotal={qualificationScore}
        color={QUAL_COLOR}
      />

      <Step
        step="STEP 1b"
        title="Timing — why now?"
        explainer="Four signals can earn up to 100: license 40 + enumeration 15 + property 30 + career 15. These fade as events age."
        items={timing}
        subtotal={timingScore}
        color={TIMING_COLOR}
      />

      {/* Step 2 — the blend: a 100-wide bar split 60/40; filled area = total */}
      <div className="rounded-[12px] bg-canvas px-4 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">
            <span className="text-ink">STEP 2</span> Blend — 60% worth, 40% urgency
          </p>
          <p className="shrink-0 font-display text-[15px] font-bold text-ink tabular-nums">
            {totalScore} <span className="text-[12px] font-normal text-ink-faint">/ 100</span>
          </p>
        </div>
        <p className="mt-0.5 text-[12px] text-ink-faint">
          The bar is 100 wide, split 60/40. Each side fills to its subtotal —
          the total filled area is the final score.
        </p>

        <div className="mt-3 flex h-9 w-full gap-[3px]">
          <div
            className="relative overflow-hidden rounded-[6px] bg-surface-soft"
            style={{ width: "60%" }}
            title={`Qualification ${qualificationScore}/100 × 0.6 = ${Math.round(qualificationScore * 0.6 * 10) / 10} pts`}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${qualificationScore}%`, backgroundColor: QUAL_COLOR }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-bold text-white mix-blend-difference">
              {qualificationScore} × 0.6 = {Math.round(qualificationScore * 6) / 10}
            </span>
          </div>
          <div
            className="relative overflow-hidden rounded-[6px] bg-surface-soft"
            style={{ width: "40%" }}
            title={`Timing ${timingScore}/100 × 0.4 = ${Math.round(timingScore * 0.4 * 10) / 10} pts`}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${timingScore}%`, backgroundColor: TIMING_COLOR }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-bold text-white mix-blend-difference">
              {timingScore} × 0.4 = {Math.round(timingScore * 4) / 10}
            </span>
          </div>
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-ink-faint">
          <span className="text-center" style={{ width: "60%" }}>
            Qualification (60% of total)
          </span>
          <span className="text-center" style={{ width: "40%" }}>
            Timing (40%)
          </span>
        </div>

        <p className="mt-3 text-center font-display text-[13px] text-ink-muted">
          {Math.round(qualificationScore * 6) / 10} + {Math.round(timingScore * 4) / 10} ={" "}
          <span className="font-bold text-ink">{totalScore}</span>
        </p>
      </div>
    </div>
  );
}
