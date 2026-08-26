import type { ScoreComponentItem } from "@/lib/data";

function ComponentBar({ item }: { item: ScoreComponentItem }) {
  const pct = item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0;
  const empty = item.points === 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-[13px] ${empty ? "text-ink-faint" : "text-ink-muted"}`}>
          {item.label}
        </span>
        <span
          className={
            "shrink-0 font-display text-[13px] font-semibold " +
            (empty ? "text-ink-faint" : "text-ink")
          }
        >
          {empty ? `0 / ${item.maxPoints} · no signal` : `${item.points} / ${item.maxPoints}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Group({
  title,
  weight,
  subtotal,
  items,
}: {
  title: string;
  weight: string;
  subtotal: number;
  items: ScoreComponentItem[];
}) {
  return (
    <div className="rounded-[12px] bg-canvas px-4 py-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">
          {title} <span className="normal-case text-ink-faint">· {weight} of total</span>
        </p>
        <p className="font-display text-[14px] font-semibold text-ink">{subtotal} / 100</p>
      </div>
      <div className="mt-1">
        {items.map((item) => (
          <ComponentBar key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

/** The full point-by-point calculation, shown on the breakdown page. */
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

  return (
    <div className="flex flex-col gap-3">
      <Group
        title="Qualification — should we care?"
        weight="60%"
        subtotal={qualificationScore}
        items={qual}
      />
      <Group
        title="Timing — why now?"
        weight="40%"
        subtotal={timingScore}
        items={timing}
      />
      <p className="text-center text-[12px] text-ink-faint">
        Total = {qualificationScore} × 0.6 + {timingScore} × 0.4 ={" "}
        <span className="font-semibold text-ink-muted">{totalScore}</span>
      </p>
    </div>
  );
}
