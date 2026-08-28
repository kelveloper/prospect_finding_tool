import Link from "next/link";
import ScoreRing from "./ScoreRing";
import { percentileOf, tierStyle } from "@/lib/tier";
import type { Candidate } from "@/lib/data";

type Props = {
  candidate: Candidate;
  rank: number;
  /** Board size, so the card can say where this prospect stands on it. */
  total: number;
  /** Defaults to the prospect's own page. The scoreboard overrides it to
   *  select into its side panel instead of navigating away. */
  href?: string;
  /** Marks the card the scoreboard's detail panel is currently showing. */
  active?: boolean;
};

/** A browse card, not a dossier — enough to decide whether to open it.
 *  The full picture lives on /candidate/[id]. */
export default function CandidateCard({
  candidate,
  rank,
  total,
  href,
  active,
}: Props) {
  const style = tierStyle(candidate.tier);
  const pct = percentileOf(rank, total);

  return (
    <Link
      href={href ?? `/candidate/${candidate.id}`}
      // Selecting a card must not yank the list back to the top of the page.
      scroll={!href}
      aria-current={active ? "true" : undefined}
      title={
        active
          ? `Showing ${candidate.name}`
          : `Open ${candidate.name}'s profile`
      }
      className={
        "flex h-full flex-col rounded-[12px] bg-white p-5 shadow-raised transition-shadow hover:shadow-float " +
        (active ? "ring-2 ring-brand" : "")
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light font-display text-[12px] font-bold text-white">
          {candidate.initials}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-display text-[11px] font-bold text-ink-faint">
            #{rank}
          </span>
          <span className="mt-0.5 block truncate font-display text-[14px] font-semibold text-ink">
            {candidate.name}
          </span>
          <span className="block truncate text-[12px] text-ink-faint">
            {candidate.specialty}
          </span>
        </span>

        <ScoreRing
          score={candidate.score}
          size={64}
          stroke={5}
          accent={style.accent}
          valueSize={13}
        />
      </div>

      <p className="mt-2.5 truncate text-[12px] text-ink-muted">
        {candidate.location}
      </p>

      {/* mt-auto pins this to the bottom so every card in a row ends level. */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 font-display text-[11px] font-semibold"
          style={{ backgroundColor: style.badgeBg, color: style.badgeFg }}
        >
          Top {pct}%
        </span>

        {/* Movement since the last ingest */}
        {candidate.scoreChange !== null && candidate.scoreChange !== 0 && (
          <span
            title={`Score moved ${candidate.scoreChange > 0 ? "up" : "down"} ${Math.abs(candidate.scoreChange)} points since the last ingest`}
            className={
              "font-display text-[11px] font-bold tabular-nums " +
              (candidate.scoreChange > 0
                ? "text-tier-strong-fg"
                : "text-tier-poor")
            }
          >
            {candidate.scoreChange > 0 ? "▲" : "▼"}{" "}
            {Math.abs(candidate.scoreChange)}
          </span>
        )}
      </div>
    </Link>
  );
}
