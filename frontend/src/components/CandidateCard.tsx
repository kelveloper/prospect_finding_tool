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
      href={`/candidate/${candidate.id}`}
      aria-current={active ? "true" : undefined}
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
          <span className="block truncate font-display text-[14px] font-semibold text-ink">
            {candidate.name}
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
          <Badge bg={style.badgeBg} fg={style.badgeFg}>
            {candidate.tier}
          </Badge>
          <span className="text-[11px] text-ink-faint">Fit score</span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full"
            style={{ width: `${candidate.score}%`, backgroundColor: style.accent }}
          />
        </div>
      </div>
    </Link>
  );
}
