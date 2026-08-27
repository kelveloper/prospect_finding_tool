import type { ScoreComponentItem } from "@/lib/data";

/** Width of each segment = the signal's weight; its fill = the strength.
 *  So the filled area of each bar is the subtotal, and the blend bar's
 *  filled area is the final score. */

function Bar({ items, color }: { items: ScoreComponentItem[]; color: string }) {
  return (
    <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-[6px]">
      {items.map((item) => (
        <div
          key={item.label}
          title={`${item.label} — ${item.points}/${item.maxPoints} pts`}
          className="relative bg-surface-soft"
          style={{ width: `${item.maxPoints}%` }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: `${item.strength * 100}%`, backgroundColor: color }}
          />
        </div>
      ))}
    </div>
  );
}

function Group({
  title,
  items,
  subtotal,
  color,
}: {
  title: string;
  items: ScoreComponentItem[];
  subtotal: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{title}</p>
        <p className="font-display text-[14px] font-bold text-ink tabular-nums">
          {subtotal}
          <span className="font-normal text-ink-faint"> / 100</span>
        </p>
      </div>

      <div className="mt-2">
        <Bar items={items} color={color} />
      </div>

      <dl className="mt-2">
        {items.map((item) => {
          const empty = item.points === 0;
          return (
            <div key={item.label} className="flex items-baseline justify-between gap-4 py-1">
              <dt className={`truncate text-[13px] ${empty ? "text-ink-faint" : "text-ink-muted"}`}>
                {item.label}
              </dt>
              <dd
                className={
                  "shrink-0 font-display text-[13px] tabular-nums " +
                  (empty ? "text-ink-faint" : "text-ink")
                }
              >
                {item.strength.toFixed(2)} × {item.maxPoints} ={" "}
                <span className={empty ? "" : "font-bold"}>{item.points}</span>
              </dd>
            </div>
          );
        })}
      </dl>
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
  const QUAL = "var(--color-brand)";
  const TIMING = "var(--color-tier-strong)";
  const qualPart = Math.round(qualificationScore * 6) / 10;
  const timingPart = Math.round(timingScore * 4) / 10;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-ink-muted">
        Each signal: <span className="font-semibold text-ink">strength × weight = points</span>.
        Bar segments are drawn to scale — width is the weight, fill is the strength.
      </p>

      <Group
        title="Qualification · 60% of total"
        items={qual}
        subtotal={qualificationScore}
        color={QUAL}
      />

      <Group
        title="Timing · 40% of total"
        items={timing}
        subtotal={timingScore}
        color={TIMING}
      />

      <div className="border-t border-surface-soft pt-4">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Total</p>
          <p className="font-display text-[14px] font-bold text-ink tabular-nums">
            {totalScore}
            <span className="font-normal text-ink-faint"> / 100</span>
          </p>
        </div>

        <div className="mt-2 flex h-6 w-full gap-[2px] overflow-hidden rounded-[6px]">
          <div className="relative bg-surface-soft" style={{ width: "60%" }}>
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${qualificationScore}%`, backgroundColor: QUAL }}
            />
          </div>
          <div className="relative bg-surface-soft" style={{ width: "40%" }}>
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${timingScore}%`, backgroundColor: TIMING }}
            />
          </div>
        </div>

        <p className="mt-2 text-right font-display text-[13px] text-ink-muted tabular-nums">
          {qualificationScore} × 0.6 + {timingScore} × 0.4 ={" "}
          <span className="font-bold text-ink">{totalScore}</span>
        </p>
      </div>
    </div>
  );
}
