import type { MatchEvidenceItem } from "@/lib/data";

type TierKey = "license" | "name" | "initial" | "single" | "npi" | "attach-name";

const IDENTITY_TIERS: { key: TierKey; label: string; score: string; note: string }[] = [
  {
    key: "license",
    label: "License number match",
    score: "1.0",
    note: "Shared government ID — certainty",
  },
  {
    key: "name",
    label: "Exact first + last name, same state",
    score: "0.95",
    note: "+0.15 if specialty matches, capped at 1.0",
  },
  {
    key: "initial",
    label: "First initial + last name, same state",
    score: "0.85",
    note: "Needs the specialty bonus to clear the 0.80 merge bar",
  },
  {
    key: "single",
    label: "Single source — no corroboration",
    score: "0.6",
    note: "NPPES only; license number found no IDFPR row",
  },
];

const ATTACH_TIERS: { key: TierKey; label: string; score: string; note: string }[] = [
  {
    key: "npi",
    label: "NPI match",
    score: "1.0",
    note: "Zero name-match risk (PECOS entities)",
  },
  {
    key: "attach-name",
    label: "Exact first + last name, same state",
    score: "0.9",
    note: "Deeds — anything less exact is dropped, never guessed",
  },
];

function tierOf(m: MatchEvidenceItem): TierKey {
  if (m.reason === "license number match") return "license";
  if (m.reason === "NPI match") return "npi";
  if (m.reason.includes("exact first and last name")) return "attach-name";
  if (m.reason.startsWith("exact first name")) return "name";
  if (m.reason.startsWith("first initial")) return "initial";
  return "single";
}

function TierRow({
  tier,
  used,
}: {
  tier: { label: string; score: string; note: string };
  used: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between gap-4 rounded-[10px] px-4 py-3 " +
        (used ? "bg-tier-strong-bg" : "bg-canvas opacity-60")
      }
    >
      <div className="min-w-0">
        <p
          className={
            "font-display text-[14px] font-semibold " +
            (used ? "text-tier-strong-fg" : "text-ink-muted")
          }
        >
          {tier.label}
          {used && <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.5px]">✓ how this one matched</span>}
        </p>
        <p className="text-[12px] text-ink-faint">{tier.note}</p>
      </div>
      <span
        className={
          "shrink-0 rounded-full px-2.5 py-1 font-display text-[13px] font-bold " +
          (used ? "bg-white text-tier-strong-fg" : "bg-surface-soft text-ink-faint")
        }
      >
        {tier.score}
      </span>
    </div>
  );
}

/** The tier ladder with this prospect's actual tiers highlighted, plus the
 *  raw audit rows from identity_matches. */
export default function MatchEvidencePanel({
  matches,
  identityConfidence,
}: {
  matches: MatchEvidenceItem[];
  identityConfidence: number;
}) {
  const used = new Set<TierKey>(matches.map(tierOf));
  // No person-merge evidence at all → the single-source default applied
  const hasIdentityMerge = used.has("license") || used.has("name") || used.has("initial");
  if (!hasIdentityMerge) used.add("single");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">Identity — how records became one person</p>
        <div className="mt-2 flex flex-col gap-2">
          {IDENTITY_TIERS.map((t) => (
            <TierRow key={t.key} tier={t} used={used.has(t.key)} />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">
          Merge threshold is 0.80 — anything below becomes a separate
          prospect. Identity confidence for this prospect:{" "}
          <span className="font-semibold text-ink-muted">
            {Math.round(identityConfidence * 100)}%
          </span>{" "}
          (the weakest link among its merges).
        </p>
      </div>

      <div>
        <p className="eyebrow">Attachments — how entities &amp; deeds joined</p>
        <div className="mt-2 flex flex-col gap-2">
          {ATTACH_TIERS.map((t) => (
            <TierRow key={t.key} tier={t} used={used.has(t.key)} />
          ))}
        </div>
      </div>

      {matches.length > 0 && (
        <div>
          <p className="eyebrow">Audit trail — every recorded decision</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.5px] text-ink-faint">
                  <th className="py-2 pr-4 font-semibold">Sources</th>
                  <th className="py-2 pr-4 font-semibold">Reason</th>
                  <th className="py-2 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} className="border-t border-surface-soft">
                    <td className="py-2.5 pr-4 font-display font-semibold text-ink">
                      {m.sourceA.toUpperCase()} ↔ {m.sourceB.toUpperCase()}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-muted">{m.reason}</td>
                    <td className="py-2.5 text-right font-display font-semibold text-ink">
                      {m.score.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
