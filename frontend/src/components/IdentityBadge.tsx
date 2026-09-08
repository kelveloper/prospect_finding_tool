import { TIER_META, describeIdentity, type IdentityAudit } from "@/lib/audit";

/** The merge-evidence tier of one row, in the evidence chip's voice.
 *  Only rendered in identity-audit mode; never advisor-facing.
 *
 *  Barely shows its weakest score, because 0.85 and 0.80 are not the same
 *  risk and the number is the whole point. A name-only event earns a
 *  second mark: a certain profile can still carry the one attach most
 *  exposed to a near-miss. Hover reads the stored reason verbatim. */
export default function IdentityBadge({ audit }: { audit: IdentityAudit }) {
  const meta = TIER_META[audit.identityTier];
  const label =
    audit.identityTier === "barely" && audit.weakestLink
      ? `${meta.badge} ${audit.weakestLink.score.toFixed(2)}`
      : meta.badge;

  return (
    <span
      title={describeIdentity(audit)}
      className="inline-flex shrink-0 cursor-help items-center gap-1"
    >
      <span
        className={
          "inline-flex items-center gap-1 rounded-full px-2 py-[3px] font-display text-[11px] font-semibold " +
          meta.tone
        }
      >
        <span aria-hidden>{meta.mark}</span>
        {label}
      </span>
      {audit.hasNameOnlyEvents ? (
        <span
          aria-label="Has an event attached by name alone"
          className="inline-flex items-center rounded-full bg-tier-neutral-bg px-1.5 py-[3px] font-display text-[10px] font-bold text-tier-neutral-fg"
        >
          ⌂ name-only
        </span>
      ) : null}
    </span>
  );
}
