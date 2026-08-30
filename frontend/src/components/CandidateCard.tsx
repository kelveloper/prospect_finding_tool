import Link from "next/link";
import ScoreRing from "./ScoreRing";
import { EvidenceChip, MovementChip, TriggerChip } from "./RowChips";
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
          <span
            title={`${candidate.specialty} · ${candidate.location}`}
            className="block truncate text-[12px] text-ink-faint"
          >
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

      {/* One row, three different facts: how good, how sure, why now. The
          fit bar and the "Fit score" caption said what the ring already
          said, and the three coverage chips are the evidence chip's job at
          a size you could actually read. */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-surface-soft pt-2.5">
        <span
          title={`Tier — ${candidate.tierLabel}, from the fit score.`}
          className="cursor-help"
        >
          <Badge bg={style.badgeBg} fg={style.badgeFg}>
            {candidate.tier}
          </Badge>
        </span>

        <EvidenceChip evidence={candidate.evidence} />
        <TriggerChip trigger={candidate.trigger} />

        <span className="ml-auto">
          <MovementChip change={candidate.scoreChange} />
        </span>
      </div>
    </Link>
  );
}
