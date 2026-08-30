import type { ReactNode } from "react";
import type { MatchEvidenceItem } from "@/lib/data";

type TierKey = "license" | "name" | "initial" | "single" | "npi" | "deed-name";

/** One rung of a matching ladder, written for a reader, not a maintainer. */
type Tier = { key: TierKey; label: string; score: string; note: string };

type Outcome = {
  /** The "What we found" cell — short enough to scan in a row. */
  found: string;
  /** The longer version, in the drawer. */
  effect: string;
};

type Join = {
  key: string;
  where: string;
  whereSub: string;
  tiers: Tier[];
  /** Any of these tiers opens the same door — the gate is binary. */
  openers: TierKey[];
  matched: Outcome;
  missed: Outcome;
  /** How this source reads inside a sentence, not as a column label. */
  inSentence: string;
  footnote?: string;
};

const JOINS: Join[] = [
  {
    key: "licence",
    where: "State licence",
    whereSub: "Illinois medical board",
    tiers: [
      {
        key: "license",
        label: "Same licence number",
        score: "1.0",
        note: "Both records carry the same licence number, so it is the same person.",
      },
      {
        key: "name",
        label: "Same full name, same state",
        score: "0.95",
        note: "Add 0.15 if the specialty matches too, up to a maximum of 1.0.",
      },
      {
        key: "initial",
        label: "First initial and last name, same state",
        score: "0.85",
        note: "Only 0.70 on its own — it needs the specialty to match as well.",
      },
      {
        key: "single",
        label: "Nothing matched",
        score: "0.6",
        note: "We could not find him in the state register, so we only have the national record.",
      },
    ],
    openers: ["license", "name", "initial"],
    matched: {
      found: "Licence confirmed in the state register",
      effect:
        "Because we confirmed his licence, he can earn the full 40 points for being a licensed doctor, and his licence date counts toward timing — up to another 40.",
    },
    missed: {
      found: "Not found in the state register",
      effect:
        "Without a confirmed licence he would top out at 28 points instead of 40, and his licence date would not count at all.",
    },
    inSentence: "the state licence register",
    footnote:
      "We only treat two records as the same person if the match scores 0.80 or better. Below that, they stay two separate people.",
  },
  {
    key: "medicare",
    where: "Medicare billing",
    whereSub: "Medicare's provider records",
    tiers: [
      {
        key: "npi",
        label: "Same NPI number",
        score: "1.0",
        note: "The only way in. We look Medicare up by NPI, so it either matches exactly or not at all.",
      },
    ],
    openers: ["npi"],
    matched: {
      found: "Billing records attached",
      effect:
        "With his billing records we can tell whether he owns his practice — up to 20 points — and spot job changes from the next monthly update, up to another 15.",
    },
    missed: {
      found: "No billing records for him",
      effect:
        "So he gets 0 out of 25 for owning a practice and 0 out of 15 for job changes. This is normal for doctors who do not bill Medicare through a group.",
    },
    inSentence: "Medicare billing",
    footnote:
      "We never fall back to matching by name here, which keeps this link free of name mix-ups.",
  },
  {
    key: "deed",
    where: "Property deed",
    whereSub: "Cook County records",
    tiers: [
      {
        key: "deed-name",
        label: "Same full name, same state",
        score: "0.9",
        note: "Deeds do not list an NPI, so the name is all we have. If it is close but not exact, we drop it rather than guess.",
      },
    ],
    openers: ["deed-name"],
    matched: {
      found: "A home purchase in his name",
      effect:
        "His purchase date counts toward timing — up to 30 points, worth less the older the sale gets.",
    },
    missed: {
      found: "No purchase in his name",
      effect:
        "He gets 0 out of 30 for property. If a buyer name is close but not exact, we drop it rather than guess.",
    },
    inSentence: "Cook County property records",
    footnote:
      "This is our least certain link. We only look at homes over $100k, and we drop anything we are not sure about.",
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

/* ── Shared pieces ──────────────────────────────────────────────── */

/** A panel-weight disclosure. `Collapsible` is a full white card with its own
 *  shadow — too heavy to nest inside a drawer — so this borrows the same
 *  native <details> idea at the smaller scale. */
export function Fold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-[10px] border border-hairline bg-canvas">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden className="ml-auto transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-surface-soft px-2.5 pb-2.5 pt-2">
        {children}
      </div>
    </details>
  );
}

export type RowStatus = "found" | "none" | "pending" | "passed";

const STATUS: Record<RowStatus, { label: string; className: string }> = {
  found: { label: "✓ Found him", className: "bg-tier-strong-bg text-tier-strong-fg" },
  none: { label: "✗ No match", className: "bg-tier-neutral-bg text-tier-neutral-fg" },
  pending: { label: "— Can't check yet", className: "bg-surface-soft text-ink-muted" },
  passed: { label: "✓ Passed", className: "bg-surface-soft text-ink-muted" },
};

/** The ledger's column template, shared by the header and every row so the
 *  columns actually line up. */
const COLS =
  "md:grid-cols-[128px_minmax(140px,1.05fr)_minmax(170px,1.5fr)_minmax(160px,1.4fr)_54px_18px]";

export type LedgerRowData = {
  key: string;
  status: RowStatus;
  /** Where we looked, in the reader's words. */
  where: string;
  whereSub: string;
  /** What came back. */
  found: string;
  /** What it is worth — the quieter half of the same cell. */
  worth?: string;
  /** How we checked. */
  how: string;
  /** Optional sentence-form name, for prose that lists rows. */
  inSentence?: string;
  score?: string;
  drawer: ReactNode;
};

export function LedgerRow({ row }: { row: LedgerRowData }) {
  const s = STATUS[row.status];
  return (
    <details className="group border-b border-surface-soft last:border-b-0">
      <summary
        className={
          "grid cursor-pointer list-none grid-cols-1 items-center gap-2 rounded-[10px] px-3.5 py-3.5 transition-colors hover:bg-canvas md:gap-4 [&::-webkit-details-marker]:hidden " +
          COLS
        }
      >
        <span>
          <span
            className={
              "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-display text-[11.5px] font-bold " +
              s.className
            }
          >
            {s.label}
          </span>
        </span>

        <span>
          <span className="block font-display text-[14.5px] font-bold tracking-[-0.2px] text-ink">
            {row.where}
          </span>
          <span className="block text-[11.5px] text-ink-muted">{row.whereSub}</span>
        </span>

        <span className="text-[13.5px] leading-[19px] text-ink">
          {row.found}
          {row.worth ? <span className="text-ink-muted"> · {row.worth}</span> : null}
        </span>

        <span className="text-[13px] leading-[19px] text-ink-muted">{row.how}</span>

        <span className="font-display text-[14.5px] font-bold tabular-nums text-ink md:text-right">
          {row.score ?? <span className="font-normal text-ink-muted">—</span>}
        </span>

        <span
          aria-hidden
          className="font-display text-[12px] text-brand transition-transform group-open:rotate-180 md:text-right"
        >
          ▾
        </span>
      </summary>

      <div className="grid grid-cols-1 gap-3.5 px-3.5 pb-5 pt-1 lg:grid-cols-2">
        {row.drawer}
      </div>
    </details>
  );
}

/** One box inside a row's drawer. */
export function Drawer({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] bg-canvas px-4 py-3.5">
      <p className="eyebrow">{title}</p>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function DrawerNote({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[20px] text-ink-muted">{children}</p>;
}

function TierRow({ tier, used }: { tier: Tier; used: boolean }) {
  return (
    <div
      className={
        "flex items-start justify-between gap-4 rounded-[8px] px-3 py-2.5 " +
        (used ? "bg-tier-strong-bg" : "bg-white")
      }
    >
      <div className="min-w-0">
        <p
          className={
            "font-display text-[13px] font-semibold " +
            (used ? "text-tier-strong-fg" : "text-ink")
          }
        >
          {tier.label}
          {used && (
            <span className="ml-1.5 text-[11px] font-bold uppercase tracking-[0.5px]">
              ✓ this one
            </span>
          )}
        </p>
        <p className="text-[12.5px] leading-[18px] text-ink-muted">{tier.note}</p>
      </div>
      <span
        className={
          "shrink-0 rounded-full px-2 py-0.5 font-display text-[12px] font-bold tabular-nums " +
          (used ? "bg-white text-tier-strong-fg" : "bg-surface-soft text-ink-muted")
        }
      >
        {tier.score}
      </span>
    </div>
  );
}

/* ── The identity rows of the ledger ─────────────────────────────── */

/** The three outside sources we try to attach to a physician, one ledger row
 *  each. Job changes are a separate row: a comparison over time rather than a
 *  match, so it has no ladder. */
export function identityRows(
  matches: MatchEvidenceItem[],
  scoringHref?: string,
): LedgerRowData[] {
  const used = new Set<TierKey>(matches.map(tierOf));
  // No state-register evidence at all → the single-source default applied.
  if (!used.has("license") && !used.has("name") && !used.has("initial")) {
    used.add("single");
  }

  return JOINS.map((join) => {
    const isOpen = join.openers.some((k) => used.has(k));
    const landed = join.tiers.find((t) => used.has(t.key));
    const others = join.tiers.filter((t) => t !== landed);
    const outcome = isOpen ? join.matched : join.missed;
    const hit = matches.find((m) => join.tiers.some((t) => t.key === tierOf(m)));

    return {
      key: join.key,
      status: (isOpen ? "found" : "none") as RowStatus,
      where: join.where,
      whereSub: join.whereSub,
      found: outcome.found,
      how: landed ? landed.label : "Nothing matched",
      inSentence: join.inSentence,
      score: hit ? hit.score.toFixed(2) : undefined,
      drawer: (
        <>
          <Drawer title={isOpen ? "How we checked" : "What would have matched"}>
            {landed ? <TierRow tier={landed} used /> : null}
            {others.length > 0 ? (
              <Fold
                label={
                  landed
                    ? `Other ways this could have matched (${others.length})`
                    : `What we looked for (${others.length})`
                }
              >
                {others.map((t) => (
                  <TierRow key={t.key} tier={t} used={false} />
                ))}
              </Fold>
            ) : null}
            {join.footnote ? <DrawerNote>{join.footnote}</DrawerNote> : null}
          </Drawer>

          <Drawer title={isOpen ? "What this is worth" : "What we lost"}>
            <DrawerNote>{outcome.effect}</DrawerNote>
            <Fold label={isOpen ? "If it had not matched" : "If it had matched"}>
              <DrawerNote>{(isOpen ? join.missed : join.matched).effect}</DrawerNote>
            </Fold>
            {scoringHref ? (
              <a
                href={scoringHref}
                className="self-start font-display text-[12px] font-semibold text-brand hover:underline"
              >
                See how it scored →
              </a>
            ) : null}
          </Drawer>
        </>
      ),
    };
  });
}

/** Not a match at all — a month-to-month comparison. */
export const careerRow: LedgerRowData = {
  key: "career",
  status: "pending",
  where: "Job changes",
  whereSub: "Medicare records, month to month",
  found: "Needs a second look",
  how: "Not a match — a comparison",
  drawer: (
    <>
      <Drawer title="How it works">
        <DrawerNote>
          Every month we check his Medicare record against last month&apos;s.
          Anything new — a different practice, a new hospital — counts as a job
          change.
        </DrawerNote>
      </Drawer>
      <Drawer title="Why it is empty">
        <DrawerNote>
          The first pull only saves a starting point, so there is nothing to
          compare against yet. And with no billing records attached, there is
          nothing to compare at all.
        </DrawerNote>
      </Drawer>
    </>
  ),
};

/* ── The ledger shell ────────────────────────────────────────────── */

export function Ledger({ rows }: { rows: LedgerRowData[] }) {
  return (
    <div>
      <div
        className={
          "hidden gap-4 border-b border-surface-soft px-3.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted md:grid " +
          COLS
        }
      >
        <span>Status</span>
        <span>Where we looked</span>
        <span>What we found</span>
        <span>How we checked</span>
        <span className="text-right">Score</span>
        <span />
      </div>
      {rows.map((row) => (
        <LedgerRow key={row.key} row={row} />
      ))}
    </div>
  );
}

/** The raw decision log — the audit record, kept verbatim. */
export function AuditTrail({
  matches,
  identityConfidence,
}: {
  matches: MatchEvidenceItem[];
  identityConfidence: number;
}) {
  return (
    <div className="mt-5 border-t border-surface-soft pt-4">
      <p className="text-[13px] text-ink-muted">
        How sure we are this is all one person:{" "}
        <span className="font-semibold text-ink">
          {Math.round(identityConfidence * 100)}%
        </span>{" "}
        — that is the weakest of the links above.
      </p>

      {matches.length > 0 ? (
        <div className="mt-3">
          <Fold label={`Every decision we recorded (${matches.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-[0.5px] text-ink-muted">
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
          </Fold>
        </div>
      ) : null}
    </div>
  );
}
