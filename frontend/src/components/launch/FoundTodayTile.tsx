import LaunchTile from "./LaunchTile";

type Props = {
  /** Prospects ingestion first located on today's date. */
  count: number;
  /** Everyone on the board, today's included. */
  total: number;
};

/** Bottom-left square: how many candidates were located today. */
export default function FoundTodayTile({ count, total }: Props) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <LaunchTile
      eyebrow="Located today"
      footer={
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full bg-brand-light"
              style={{ width: `${share}%` }}
            />
          </div>
          <p className="mt-2.5 text-[12px] text-ink-faint">
            {count === 0
              ? `No new prospects yet today — ${total} on the board`
              : `${share}% of the ${total} prospects on the board`}
          </p>
        </>
      }
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[64px] font-bold leading-none tracking-[-2px] text-brand tabular-nums">
          {count}
        </span>
        <span className="font-display text-[14px] font-semibold text-ink-muted">
          {count === 1 ? "new candidate" : "new candidates"}
        </span>
      </div>
    </LaunchTile>
  );
}
