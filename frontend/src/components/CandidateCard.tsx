import ScoreRing from "./ScoreRing";
import { EvidenceChip, MovementChip, TriggerChip } from "./RowChips";
import Badge from "./Badge";
import IdentityBadge from "./IdentityBadge";
import { isLicenseGated, standingLabel, tierStyle } from "@/lib/tier";
import { workedState } from "@/lib/outreach";
import type { Candidate } from "@/lib/data";

type Props = {
  candidate: Candidate;
  rank: number;
  /** Highlights the row the detail panel is currently showing. */
  active?: boolean;
  /** Rings the row once, on the render where the reader lands back on it
   *  after being somewhere else. The lasting mark is `active`; this is only
   *  the arrival, and the class is withdrawn once the animation is spent. */
  arriving?: boolean;
  /** Swap the panel in place — a server navigation here re-rendered and
   *  re-sent the entire board on every click. */
  onSelect: () => void;
  /** Identity-audit mode: show the merge-evidence badge. Operator only. */
  audit?: boolean;
};

export default function CandidateCard({
  candidate,
  rank,
  active,
  arriving = false,
  onSelect,
  audit = false,
}: Props) {
  const style = tierStyle(candidate.tier);
  const gated = isLicenseGated(candidate.licenseStatus);
  /* What the advisor already did about this one. The book has printed it
     per row for a while; the board never did, so the one question being
     asked while scanning this list — who is left to call — was the one
     thing it would not answer. Same helper, same words, so the two views
     cannot drift apart on it. */
  const worked = workedState(candidate.outreachStatus);
  // A settled prospect recedes so the untouched ones stand out. Only the
  // supporting cells fade: the name, the rank and the figure stay at full
  // strength, because a worked row is still a row you must be able to find.
  const recede = worked?.settled ? "opacity-50" : "";

  return (
    <a
      // One click opens the whole profile in the panel beside this list.
      // The href keeps the row linkable (copy, middle-click, new tab);
      // a plain left click is handled in place instead.
      href={`/?id=${candidate.id}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
          return;
        e.preventDefault();
        onSelect();
      }}
      aria-current={active ? "true" : undefined}
      title={
        active
          ? `Showing ${candidate.name}'s profile`
          : `Open ${candidate.name}'s profile`
      }
      className={
        // No press state here: clicking a card selects it, and the brand
        // border lands instantly, which is the same signal a press would be.
        "block rounded-[12px] bg-white p-4 shadow-raised transition-[box-shadow,border-color] hover:shadow-float " +
        (arriving ? "animate-row-arrive " : "") +
        (active
          ? "border-2 border-brand"
          : // Hover was a shadow and nothing else. The border is already
            // reserved at 2px and transparent, so lighting it cannot shift
            // a single row of the list.
            "border-2 border-transparent hover:border-hairline")
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
            {worked ? (
              <span
                title={worked.spoken}
                className={
                  "shrink-0 rounded-[4px] px-1.5 py-[1px] font-display text-[9.5px] font-bold uppercase tracking-[0.6px] " +
                  (worked.won
                    ? "bg-tier-strong-bg text-tier-strong-fg"
                    : "bg-tier-neutral-bg text-tier-neutral-fg")
                }
              >
                {worked.label}
              </span>
            ) : null}
          </span>
          <span
            title={`${candidate.specialty} · ${candidate.location}`}
            className={"block truncate text-[12px] text-ink-faint " + recede}
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
      <div
        className={
          "mt-3 flex items-center gap-1.5 border-t border-surface-soft pt-2.5 " +
          recede
        }
      >
        <span
          title={
            gated
              ? `${candidate.tierLabel} — fit 0, sorted last.`
              : `${candidate.tierLabel} — ${standingLabel(candidate.rank, candidate.bookSize)}. Bands come from standing in the book: the top 5% are Top Prospects.`
          }
          className="cursor-help"
        >
          <Badge bg={style.badgeBg} fg={style.badgeFg}>
            {gated ? "not ranked" : candidate.tier}
          </Badge>
        </span>
        {/* No "Top N%" chip here. The badge beside it already names the
            band, its tooltip gives the full standing, and the panel prints
            "#4 · Top 1%" beside the ring — a percentile on every row was a
            third telling, competing with the chips that carry the facts. */}

        <EvidenceChip evidence={candidate.evidence} />
        <TriggerChip trigger={candidate.trigger} />

        <span className="ml-auto">
          <MovementChip
            change={candidate.scoreChange}
            isNew={candidate.isNew}
            valueChange={candidate.valueChange}
            timingChange={candidate.timingChange}
            note={candidate.scoreChangeNote}
          />
        </span>
      </div>

      {/* Operator-only: the merge evidence behind the profile, on its own
          line so it never squeezes the advisor's chips. Every card gets
          it or none does, so the virtualized row height stays uniform. */}
      {audit ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.5px] text-ink-faint">
            identity
          </span>
          <IdentityBadge audit={candidate.identity} />
        </div>
      ) : null}
    </a>
  );
}
