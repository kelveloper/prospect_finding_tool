import { TIER_META, describeIdentity, type IdentityAudit } from "@/lib/audit";

/** The merge-evidence tier of one row, in the evidence chip's voice.
 *  Only rendered in identity-audit mode; never advisor-facing.
 *
 *  Barely shows its weakest score, because 0.85 and 0.80 are not the same
 *  risk and the number is the whole point. Hover reads the stored reason
 *  verbatim, and says when the home purchase was matched by name alone. */
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
    </span>
  );
}
