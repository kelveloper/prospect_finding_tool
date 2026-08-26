import type { MatchEvidenceItem } from "@/lib/data";

type TierKey = "license" | "name" | "initial" | "single" | "npi" | "deed-name";

type Tier = { key: TierKey; label: string; score: string; note: string };

/** Tier ladders organized per connection — each join has its own rules. */
const JOINS: {
  title: string;
  subtitle: string;
  tiers: Tier[];
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
          {used && (
            <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.5px]">
              ✓ how this one matched
            </span>
          )}
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

/** Per-connection tier ladders with this prospect's tiers highlighted,
 *  plus the raw audit rows from identity_matches. */
export default function MatchEvidencePanel({
  matches,
  identityConfidence,
}: {
  matches: MatchEvidenceItem[];
  identityConfidence: number;
}) {
  const used = new Set<TierKey>(matches.map(tierOf));
  // No IDFPR merge evidence → the single-source default applied
  if (!used.has("license") && !used.has("name") && !used.has("initial")) {
    used.add("single");
  }

  return (
    <div className="flex flex-col gap-5">
      {JOINS.map((join) => (
        <div key={join.title}>
          <p className="eyebrow">
            {join.title}{" "}
            <span className="normal-case text-ink-faint">· {join.subtitle}</span>
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {join.tiers.map((t) => (
              <TierRow key={t.key} tier={t} used={used.has(t.key)} />
            ))}
          </div>
          {join.footnote && (
            <p className="mt-1.5 text-[12px] text-ink-faint">{join.footnote}</p>
          )}
        </div>
      ))}

      <div>
        <p className="eyebrow">
          PECOS ↔ itself over time{" "}
          <span className="normal-case text-ink-faint">· career move detection</span>
        </p>
        <p className="mt-1.5 rounded-[10px] bg-canvas px-4 py-3 text-[13px] leading-[20px] text-ink-muted">
          Not a scored match — an exact NPI-keyed diff. Each sync compares
          today&apos;s billing groups and facilities against the stored
          baseline; anything new becomes a career event. That&apos;s why the
          career signal can never fire on a first ingest.
        </p>
      </div>

      <p className="text-[12px] text-ink-faint">
        Identity confidence for this prospect:{" "}
        <span className="font-semibold text-ink-muted">
          {Math.round(identityConfidence * 100)}%
        </span>{" "}
        — the weakest link among its merges.
      </p>

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
