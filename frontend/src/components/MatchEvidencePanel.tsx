import type { MatchEvidenceItem } from "@/lib/data";

type TierKey = "license" | "name" | "initial" | "single" | "npi" | "deed-name";

type Tier = { key: TierKey; label: string; score: string; note: string };

type Gate = {
  /** Any tier ≥ the bar opens the same door — the gate is binary. */
  open: { label: string; detail: string };
  closed: { label: string; detail: string };
};

/** Tier ladders organized per connection — each join has its own rules. */
const JOINS: {
  title: string;
  subtitle: string;
  tiers: Tier[];
  gate: Gate;
  openers: TierKey[];
  /** Which scoring group the cross-link jumps to. */
  scoringTarget: "qualification" | "timing";
  footnote?: string;
}[] = [
  {
    title: "NPPES ↔ IDFPR",
    subtitle: "Merging two records into one person",
    tiers: [
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
        note: "0.70 alone — needs the specialty bonus to clear the bar",
      },
      {
        key: "single",
        label: "No match found — single source",
        score: "0.6",
        note: "License number found no IDFPR row; NPPES stands alone",
      },
    ],
    gate: {
      open: {
        label: "Gate cleared — IDFPR data unlocked",
        detail:
          "License verified: Physician standing can reach 1.00 × 40, and License recency is active (up to 40 timing pts). Any tier ≥ 0.80 opens this same door.",
      },
      closed: {
        label: "Gate not cleared — NPPES stands alone",
        detail:
          "License unverified: Physician standing capped at 0.70 × 40 = 28, and License recency locked at 0 / 40 timing pts.",
      },
    },
    openers: ["license", "name", "initial"],
    scoringTarget: "timing",
    footnote:
      "Merge threshold is 0.80 — anything below becomes a separate prospect.",
  },
  {
    title: "NPPES ↔ PECOS",
    subtitle: "Attaching billing entities & career data",
    tiers: [
      {
        key: "npi",
        label: "NPI match",
        score: "1.0",
        note: "The only tier — PECOS is queried by NPI, so it's exact or nothing",
      },
    ],
    gate: {
      open: {
        label: "Gate cleared — billing data attached",
        detail:
          "Practice ownership can earn up to 20 qual pts (own PLLC × 0.8), and career-move tracking is armed (up to 15 timing pts from the next sync).",
      },
      closed: {
        label: "Gate not cleared — no PECOS rows for this NPI",
        detail:
          "Practice ownership locked at 0 / 25 and Career advancement at 0 / 15. Common for physicians who don't bill Medicare under a group.",
      },
    },
    openers: ["npi"],
    scoringTarget: "qualification",
    footnote: "No name fallback by design: zero name-match risk on this join.",
  },
  {
    title: "NPPES ↔ Cook County",
    subtitle: "Attaching property deeds",
    tiers: [
      {
        key: "deed-name",
        label: "Exact first + last name, same state",
        score: "0.9",
        note: "The only tier — deeds carry no NPI; a near-miss is dropped, never guessed",
      },
    ],
    gate: {
      open: {
        label: "Gate cleared — deed attached",
        detail:
          "Property purchase recency is active: up to 30 timing pts, decaying with the sale date.",
      },
      closed: {
        label: "Gate not cleared — no deed matched",
        detail:
          "Property purchase recency locked at 0 / 30. A near-miss on the buyer name is dropped, never guessed.",
      },
    },
    openers: ["deed-name"],
    scoringTarget: "timing",
    footnote:
      "Weakest join in the system — mitigated by the $100k price floor and drop-don't-guess matching.",
  },
];

function tierOf(m: MatchEvidenceItem): TierKey {
  if (m.reason === "license number match") return "license";
  if (m.reason === "NPI match") return "npi";
  if (m.reason.includes("exact first and last name")) return "deed-name";
  if (m.reason.startsWith("exact first name")) return "name";
  if (m.reason.startsWith("first initial")) return "initial";
  return "single";
}

function TierRow({ tier, used }: { tier: Tier; used: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-between gap-4 rounded-[10px] px-3.5 py-2.5 " +
        (used ? "bg-tier-strong-bg" : "bg-canvas opacity-60")
      }
    >
      <div className="min-w-0">
        <p
          className={
            "font-display text-[13px] font-semibold " +
            (used ? "text-tier-strong-fg" : "text-ink-muted")
          }
        >
          {tier.label}
          {used && (
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.5px]">
              ✓ this one
            </span>
          )}
        </p>
        <p className="text-[11px] leading-[16px] text-ink-faint">{tier.note}</p>
      </div>
      <span
        className={
          "shrink-0 rounded-full px-2 py-0.5 font-display text-[12px] font-bold " +
          (used ? "bg-white text-tier-strong-fg" : "bg-surface-soft text-ink-faint")
        }
      >
        {tier.score}
      </span>
    </div>
  );
}

function GateOutcome({
  gate,
  isOpen,
  onSeeScoring,
}: {
  gate: Gate;
  isOpen: boolean;
  onSeeScoring?: () => void;
}) {
  const rows = [
    { ...gate.open, active: isOpen, tone: "open" as const },
    { ...gate.closed, active: !isOpen, tone: "closed" as const },
  ];
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className={
            "rounded-[10px] border px-3.5 py-2.5 " +
            (row.active
              ? row.tone === "open"
                ? "border-tier-strong/40 bg-tier-strong-bg"
                : "border-tier-neutral-fg/30 bg-tier-neutral-bg"
              : "border-transparent bg-canvas opacity-50")
          }
        >
          <p
            className={
              "font-display text-[12px] font-semibold " +
              (row.active
                ? row.tone === "open"
                  ? "text-tier-strong-fg"
                  : "text-tier-neutral-fg"
                : "text-ink-muted")
            }
          >
            {row.tone === "open" ? "🔓" : "🔒"} {row.label}
            {row.active && (
              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.5px]">
                ← this prospect
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] leading-[17px] text-ink-muted">{row.detail}</p>
          {row.active && onSeeScoring && (
            <button
              type="button"
              onClick={onSeeScoring}
              className="mt-1.5 font-display text-[11px] font-semibold text-brand"
            >
              See it in scoring →
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Gate 2 — Identity: per-connection tier ladders side by side, the gate
 *  outcomes, and the raw audit rows from identity_matches. */
export default function MatchEvidencePanel({
  matches,
  identityConfidence,
  onSeeScoring,
}: {
  matches: MatchEvidenceItem[];
  identityConfidence: number;
  onSeeScoring?: (group: "qualification" | "timing") => void;
}) {
  const used = new Set<TierKey>(matches.map(tierOf));
  // No IDFPR merge evidence → the single-source default applied
  if (!used.has("license") && !used.has("name") && !used.has("initial")) {
    used.add("single");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
        {JOINS.map((join) => (
          <div key={join.title}>
            <p className="eyebrow">{join.title}</p>
            <p className="text-[11px] text-ink-faint">{join.subtitle}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {join.tiers.map((t) => (
                <TierRow key={t.key} tier={t} used={used.has(t.key)} />
              ))}
            </div>
            <GateOutcome
              gate={join.gate}
              isOpen={join.openers.some((k) => used.has(k))}
              onSeeScoring={
                onSeeScoring ? () => onSeeScoring(join.scoringTarget) : undefined
              }
            />
            {join.footnote && (
              <p className="mt-1.5 text-[11px] leading-[16px] text-ink-faint">
                {join.footnote}
              </p>
            )}
          </div>
        ))}

        {/* 4th column: the unscored join */}
        <div>
          <p className="eyebrow">PECOS ↔ itself over time</p>
          <p className="text-[11px] text-ink-faint">Career move detection</p>
          <p className="mt-2 rounded-[10px] bg-canvas px-3.5 py-2.5 text-[12px] leading-[19px] text-ink-muted">
            Not a scored match — an exact NPI-keyed diff. Each sync compares
            today&apos;s billing groups and facilities against the stored
            baseline; anything new becomes a career event. That&apos;s why the
            career signal can never fire on a first ingest.
          </p>
        </div>
      </div>

      <div>
        <p className="text-[12px] text-ink-faint">
          Identity confidence:{" "}
          <span className="font-semibold text-ink-muted">
            {Math.round(identityConfidence * 100)}%
          </span>{" "}
          — the weakest link among this prospect&apos;s merges.
        </p>

        {matches.length > 0 && (
          <div className="mt-3">
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
    </div>
  );
}
