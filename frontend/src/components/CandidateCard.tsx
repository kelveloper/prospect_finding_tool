import Link from "next/link";
import ScoreRing from "./ScoreRing";
import Badge from "./Badge";
import { tierStyle } from "@/lib/tier";
import type { Candidate } from "@/lib/data";

type Props = {
  candidate: Candidate;
  rank: number;
  /** Highlights the row the detail panel is currently showing. */
  active?: boolean;
};

export default function CandidateCard({ candidate, rank, active }: Props) {
  const style = tierStyle(candidate.tier);

  return (
    <Link
      // One click opens the whole profile in the panel beside this list.
      href={`/?id=${candidate.id}`}
      // Switching candidates must not yank the list back to the top of the page.
      scroll={false}
      aria-current={active ? "true" : undefined}
      title={
        active
          ? `Showing ${candidate.name}'s profile`
          : `Open ${candidate.name}'s profile`
      }
      className={
        "block rounded-[12px] bg-white p-4 shadow-raised transition-shadow hover:shadow-float " +
        (active ? "border-2 border-brand" : "border-2 border-transparent")
      }
    >
      <div className="flex w-full items-center gap-3">
        <span className="w-5 shrink-0 text-center font-display text-[11px] font-bold text-ink-faint">
          {rank}
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light font-display text-[12px] font-bold text-white">
          {candidate.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block truncate font-display text-[14px] font-semibold text-ink">
              {candidate.name}
            </span>
            {candidate.isNew && (
              <span
                title="Entered the book within the last 48 hours"
                className="shrink-0 rounded-full bg-tier-strong-bg px-1.5 py-0.5 font-display text-[9px] font-bold tracking-[0.5px] text-tier-strong-fg"
              >
                NEW
              </span>
            )}
          </span>
          <span className="block truncate text-[12px] text-ink-faint">
            {candidate.specialty}
          </span>
        </span>
        <ScoreRing
          score={candidate.score}
          size={68}
          stroke={5}
          accent={style.accent}
          valueSize={14}
        />
      </div>

      <div className="pt-[10px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Badge bg={style.badgeBg} fg={style.badgeFg}>
              {candidate.tier}
            </Badge>
            {/* Movement since the last ingest */}
            {candidate.scoreChange !== null && candidate.scoreChange !== 0 && (
              <span
                title={`Score moved ${candidate.scoreChange > 0 ? "up" : "down"} ${Math.abs(candidate.scoreChange)} points since the last ingest`}
                className={
                  "font-display text-[11px] font-bold tabular-nums " +
                  (candidate.scoreChange > 0 ? "text-tier-strong-fg" : "text-tier-poor")
                }
              >
                {candidate.scoreChange > 0 ? "▲" : "▼"} {Math.abs(candidate.scoreChange)}
              </span>
            )}
          </span>
          <span className="text-[11px] text-ink-faint">
            {active ? "Showing profile →" : "Fit score"}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full"
            style={{ width: `${candidate.score}%`, backgroundColor: style.accent }}
          />
        </div>

        {/* Quick overview: signal coverage per category */}
        <div className="mt-2 flex gap-1.5">
          {candidate.categories.map(({ label, captured, total }) => {
            const full = captured === total;
            const none = captured === 0;
            return (
              <span
                key={label}
                title={
                  none
                    ? `No ${label.toLowerCase()} signals found yet`
                    : `${captured} of ${total} ${label.toLowerCase()} signal types captured`
                }
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-semibold " +
                  (none
                    ? "bg-surface-soft text-ink-faint"
                    : full
                      ? "bg-tier-strong-bg text-tier-strong-fg"
                      : "bg-surface-tint text-brand-dark")
                }
              >
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (none
                      ? "bg-ink-faint/40"
                      : full
                        ? "bg-tier-strong"
                        : "bg-brand")
                  }
                />
                {label}
                <span className={none ? "font-normal" : "font-bold"}>
                  {captured}/{total}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
