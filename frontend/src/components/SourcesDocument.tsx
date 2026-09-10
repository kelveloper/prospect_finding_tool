import type {
  MatchEvidenceItem,
  ScoreComponentItem,
  SignalItem,
} from "@/lib/data";
import { isLicenseGated } from "@/lib/tier";
import {
  AuditTrail,
  Drawer,
  DrawerNote,
  Ledger,
  identityRows,
  type LedgerRowData,
} from "./MatchEvidencePanel";

/* ── Gate 3 rules, judged against this prospect's own records ────── */

function entityFrom(description: string): string | null {
  const m = description.match(/'([^']+)'/);
  return m ? m[1] : null;
}

/* ── The scoring rulebook, mirrored from app/scoring/detector.py ──── */

type Rule = { label: string; value: number | null };

/** An event loses half its value every year (0.5 ^ months/12). These rows
 *  are landmarks on that curve; a signal lands on the nearest one. */
const HALF_LIFE_LADDER: Rule[] = [
  { label: "This month", value: 1.0 },
  { label: "About six months ago", value: 0.71 },
  { label: "About a year ago", value: 0.5 },
  { label: "About two years ago", value: 0.25 },
  { label: "Three years ago or more", value: 0.13 },
  { label: "Nothing on record", value: 0 },
];

const RULEBOOK: Record<string, Rule[]> = {
  // Medscape over-$5M wealth share, scaled so the top is 1.0
  "Specialty wealth tier": [
    { label: "Radiology, orthopedic or neurological surgery", value: 1.0 },
    { label: "Cardiology", value: 0.9 },
    { label: "Anesthesiology", value: 0.8 },
    { label: "Plastic surgery", value: 0.75 },
    { label: "Otolaryngology", value: 0.7 },
    { label: "Ob/gyn, urology or general surgery", value: 0.65 },
    { label: "Gastroenterology or ophthalmology", value: 0.6 },
    { label: "Nephrology, pathology or public health", value: 0.55 },
    {
      label: "Emergency medicine, or a specialty not on the chart",
      value: 0.5,
    },
    { label: "Allergy and immunology", value: 0.45 },
    { label: "Internal medicine and its subspecialties", value: 0.4 },
    { label: "Dermatology, oncology or neurology", value: 0.35 },
    { label: "Psychiatry, critical care or family medicine", value: 0.3 },
    { label: "Pediatrics, rehabilitation or rheumatology", value: 0.25 },
  ],
  // entity strength × tenure factor (under 10 yrs 1.0 · 10–20 yrs 0.6 · 20+ yrs 0.3)
  "Practice ownership": [
    { label: "His own practice, under ten years in", value: 1.0 },
    { label: "His own practice, ten to twenty years in", value: 0.6 },
    {
      label: "His own company (not a medical practice), under ten years in",
      value: 0.6,
    },
    { label: "His own practice, over twenty years in", value: 0.3 },
    {
      label: "Discounted further — inactive entity, or tenure unknown",
      value: null,
    },
    { label: "No practice in his own name", value: 0 },
  ],
  // points out of 30 by years since NPI enumeration
  "Career stage": [
    { label: "5 to 15 years in — peak accumulation years", value: 1.0 },
    { label: "15 to 20 years in — established", value: 0.67 },
    {
      label: "3 to 5 years in — early attending, or years unknown",
      value: 0.5,
    },
    { label: "Over 20 years in — late career", value: 0.33 },
    { label: "Under 3 years in — first attending years", value: 0.17 },
  ],
  "License recency": [
    {
      label: "Relocation this month (3+ years already in practice)",
      value: 1.0,
    },
    { label: "Relocation about six months ago", value: 0.71 },
    {
      label: "Relocation about a year ago, or a first license this month",
      value: 0.5,
    },
    { label: "A first license about six months ago", value: 0.35 },
    { label: "Older than that", value: null },
    { label: "No license date on record", value: 0 },
  ],
  "Property purchase recency": HALF_LIFE_LADDER,
  "Career advancement": [
    { label: "Formed his own practice this month", value: 1.0 },
    { label: "Formed his own company (not a practice) this month", value: 0.6 },
    { label: "Formed his own practice about a year ago", value: 0.5 },
    { label: "Changed billing group this month", value: 0.3 },
    { label: "Changed billing group about a year ago", value: 0.15 },
    { label: "Older than that", value: null },
    { label: "No move yet — we need next month\u2019s data", value: 0 },
  ],
};

/** Where a fact came from, named the way a person would say it. */
const SOURCE_NAMES: Record<string, string> = {
  idfpr: "Illinois medical board",
  npi: "National provider registry",
  nppes: "National provider registry",
  cook_county: "Cook County records",
  pecos: "Medicare records",
};

function sourceName(source: string): string {
  return SOURCE_NAMES[source.toLowerCase()] ?? source.replaceAll("_", " ");
}

/** Signals below this still add points, but never earn a sentence in the
 *  written summary — the same floor app/scoring uses. */
const NARRATION_FLOOR = 0.3;

/** What each scored line actually asks, in the reader's words. The keys are
 *  the internal labels the API sends. */
const QUESTIONS: Record<string, string> = {
  "Specialty wealth tier": "How wealthy does his specialty get?",
  "Practice ownership": "Does he own his practice?",
  "Career stage": "Where is he in his career?",
  "License recency": "How new is his Illinois license?",
  "Property purchase recency": "How recently did he buy a home?",
  "Career advancement": "Has he changed jobs?",
};

/** Which rulebook row this component's strength lands on: an exact match
 *  when there is one, otherwise the nearest landmark — the half-life curve
 *  is continuous, so most timing rows land between two. */
function currentRow(label: string, strength: number): number {
  const rules = RULEBOOK[label] ?? [];
  const exact = rules.findIndex(
    (r) => r.value !== null && Math.abs(r.value - strength) < 0.005,
  );
  if (exact >= 0) return exact;
  if (strength === 0) return rules.findIndex((r) => r.value === 0);
  const wildcard = rules.findIndex((r) => r.value === null);
  let best = -1;
  let bestGap = Infinity;
  rules.forEach((r, i) => {
    if (r.value === null || r.value === 0) return;
    const gap = Math.abs(r.value - strength);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  // Far from every landmark: the "older than that / discounted" row
  return bestGap <= 0.12 || wildcard < 0 ? best : wildcard;
}

/* ── UI ─────────────────────────────────────────────────────────── */

/** One scored line, in the same row-plus-drawer shape as the gates ledger so
 *  the page only has one reading pattern. No master-detail selection: every
 *  line's rulebook lives in its own drawer. */
function ScoreRow({
  item,
  color,
  confidence = 1,
}: {
  item: ScoreComponentItem;
  color: string;
  /** Identity confidence — multiplies timing rows only. */
  confidence?: number;
}) {
  const rules = RULEBOOK[item.label] ?? [];
  const current = currentRow(item.label, item.strength);
  const landed = rules[current]?.label;
  const pct = item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0;
  const empty = item.points === 0;
  const discounted = item.category === "timing" && confidence < 0.999;

  return (
    <details className="group border-b border-surface-soft last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-1 items-center gap-2 rounded-[10px] px-3.5 py-3.5 transition-colors hover:bg-canvas md:grid-cols-[minmax(190px,1.25fr)_minmax(170px,1.2fr)_172px_18px] md:gap-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display text-[14.5px] font-bold tracking-[-0.2px] text-ink">
            {QUESTIONS[item.label] ?? item.label}
          </span>
          <span className="block text-[11.5px] text-ink-muted">
            {item.label}
          </span>
        </span>

        <span
          className={
            "text-[13.5px] leading-[19px] " +
            (empty ? "text-ink-muted" : "text-ink")
          }
        >
          {landed ?? "—"}
        </span>

        <span className="flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </span>
          <span className="shrink-0 font-display text-[14px] font-bold tabular-nums text-ink">
            {item.points}
            <span className="font-normal text-ink-muted">
              {" "}
              / {item.maxPoints}
            </span>
          </span>
        </span>

        <span
          aria-hidden
          className="font-display text-[12px] text-brand transition-transform group-open:rotate-180 md:text-right"
        >
          ▾
        </span>
      </summary>

      <div className="grid grid-cols-1 gap-3.5 px-3.5 pb-5 pt-1 lg:grid-cols-2">
        <Drawer title="How this is scored">
          <div className="flex flex-col gap-1">
            {rules.map((rule, i) => {
              const active = i === current;
              return (
                <div
                  key={rule.label}
                  className={
                    "flex items-center justify-between gap-3 rounded-[8px] px-3 py-2 " +
                    (active ? "" : "bg-white")
                  }
                  style={
                    active
                      ? {
                          backgroundColor:
                            "color-mix(in srgb, " + color + " 12%, white)",
                        }
                      : undefined
                  }
                >
                  <span
                    className={
                      "text-[13px] " +
                      (active ? "font-semibold text-ink" : "text-ink-muted")
                    }
                  >
                    {rule.label}
                    {active && (
                      <span
                        className="ml-1.5 text-[11px] font-bold uppercase tracking-[0.5px]"
                        style={{ color }}
                      >
                        ✓ this one
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 font-display text-[12px] font-bold tabular-nums " +
                      (active
                        ? "bg-white text-ink"
                        : "bg-surface-soft text-ink-muted")
                    }
                  >
                    {rule.value === null
                      ? "×"
                      : rule.value === 0
                        ? "0"
                        : rule.value.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </Drawer>

        <Drawer title="The maths">
          <DrawerNote>
            {landed ? (
              <>
                He landed on{" "}
                <span className="font-semibold text-ink">{landed}</span>, which
                is worth{" "}
                <span className="font-semibold text-ink">
                  {item.strength.toFixed(2)}
                </span>{" "}
                out of 1.
              </>
            ) : (
              <>
                This line scored{" "}
                <span className="font-semibold text-ink">
                  {item.strength.toFixed(2)}
                </span>{" "}
                out of 1.
              </>
            )}
          </DrawerNote>
          <DrawerNote>
            This question is worth up to {item.maxPoints} points, so{" "}
            <span className="font-display font-semibold text-ink tabular-nums">
              {item.strength.toFixed(2)} × {item.maxPoints}
              {discounted
                ? ` × ${confidence.toFixed(2)} identity confidence`
                : ""}{" "}
              = {item.points}
            </span>{" "}
            points.
            {discounted
              ? " The confidence factor is how sure we are these records are his — a single-source profile keeps 60%."
              : ""}
          </DrawerNote>
        </Drawer>
      </div>
    </details>
  );
}

/** One half of the score — a plain question, its subtotal, and its lines. */
function ScoreGroup({
  question,
  subtitle,
  subtotal,
  rule,
  items,
  color,
  confidence = 1,
}: {
  question: string;
  subtitle: string;
  subtotal: number;
  /** How the lines combine — "adds up to 100" or "strongest one counts". */
  rule: string;
  items: ScoreComponentItem[];
  color: string;
  confidence?: number;
}) {
  return (
    <section className="rounded-[16px] bg-white px-6 py-5 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-surface-soft pb-4">
        <span
          className="h-4 w-[3px] shrink-0 self-center rounded-full"
          style={{ backgroundColor: color }}
        />
        <h2 className="font-display text-[19px] font-bold tracking-[-0.4px] text-ink">
          {question}
        </h2>
        <p className="ml-auto font-display text-[14px] text-ink-muted tabular-nums">
          <span className="font-bold text-ink">{subtotal}</span> out of 100 ·{" "}
          {rule}
        </p>
        <p className="w-full max-w-[86ch] text-[14px] leading-[21px] text-ink-muted">
          {subtitle}
        </p>
      </div>
      <div className="mt-3">
        {items.map((item) => (
          <ScoreRow
            key={item.label}
            item={item}
            color={color}
            confidence={confidence}
          />
        ))}
      </div>
    </section>
  );
}

export default function SourcesDocument({
  qualificationScore,
  timingScore,
  totalScore,
  components,
  matches,
  identityConfidence,
  signalTypesCount,
  signals,
  licenseStatus = null,
}: {
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
  matches: MatchEvidenceItem[];
  identityConfidence: number;
  signalTypesCount: number;
  signals: SignalItem[];
  licenseStatus?: string | null;
}) {
  const qual = components.filter((c) => c.category === "qualification");
  const timing = components.filter((c) => c.category === "timing");
  const QUAL = "var(--color-brand)";
  const TIMING = "var(--color-tier-strong)";
  const gated = isLicenseGated(licenseStatus);
  const multiplier = 0.6 + 0.4 * (timingScore / 100);

  /* ── Every check we ran on this prospect, as ledger rows ─────────
     Three gates used to be three different layouts. They are all the same
     shape of fact — we looked somewhere, something came back — so they are
     now one table the eye only has to learn once. */

  const hasBilling = matches.some((m) => m.reason === "NPI match");
  const ownSignal = signals.find((s) => s.type === "OWNERSHIP");
  const careerSignal = signals.find((s) => s.type === "CAREER_ADVANCEMENT");
  const ownComp = components.find((c) => c.label === "Practice ownership");
  const careerComp = components.find((c) => c.label === "Career advancement");

  const eligibilityRow: LedgerRowData = {
    key: "eligibility",
    status: "passed",
    where: "Who gets in at all",
    whereSub: "Filters applied as we pull",
    found: "Passed, as everyone here has",
    how: "Five filters, checked before a record becomes a prospect",
    drawer: (
      <>
        <Drawer title="The five filters">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[20px] text-ink-muted marker:text-ink-muted">
            <li>Doctors only</li>
            <li>Licensed or working in Illinois</li>
            <li>Individual doctor licenses — not clinics or businesses</li>
            <li>Home purchases over $100k in the last three years</li>
            <li>Medicare billing records only</li>
          </ul>
        </Drawer>
        <Drawer title="Why it always passes">
          <DrawerNote>
            Anything that fails one of these never becomes a prospect. So every
            person you can open has already passed — this row can never say
            anything else.
          </DrawerNote>
        </Drawer>
      </>
    ),
  };

  const licenseRow: LedgerRowData = {
    key: "license-gate",
    status: gated ? "none" : licenseStatus ? "found" : "pending",
    where: "Is his license active?",
    whereSub: "Illinois medical board",
    found: gated
      ? `No — ${licenseStatus}. Not ranked.`
      : licenseStatus
        ? `Yes — ${licenseStatus}`
        : "No state record — ranked, but unverified",
    how: "A present, non-active status sets his priority to zero",
    drawer: (
      <>
        <Drawer title="The rule">
          <DrawerNote>
            The gate sits outside the arithmetic. An expired, inactive or
            suspended license means he cannot be a prospect right now, whatever
            his value, so his priority is zero and he sorts last. No state
            record at all is not a verdict — he stays ranked, and his identity
            confidence already discounts what the records can claim.
          </DrawerNote>
        </Drawer>
        <Drawer title="What happened here">
          <DrawerNote>
            {gated
              ? "His license status is not active, so nothing below changes his place on the board until it is renewed."
              : licenseStatus
                ? "His license is active, so he is ranked and the rest of this page applies."
                : "We never found him in the state register, so there was nothing to gate on."}
          </DrawerNote>
        </Drawer>
      </>
    ),
  };

  const ownershipRow: LedgerRowData = {
    key: "ownership",
    status: ownSignal ? "found" : hasBilling ? "none" : "pending",
    where: "Does he own his practice?",
    whereSub: "Medicare business names",
    found: ownSignal
      ? `Yes — ${entityFrom(ownSignal.description) ?? "a business in his own name"}`
      : hasBilling
        ? "No — he bills through someone else's group"
        : "Nothing to check",
    worth: ownComp
      ? `${ownComp.points} of ${ownComp.maxPoints} points`
      : undefined,
    how: "His own name has to be in the business name",
    drawer: (
      <>
        <Drawer title="The rule">
          <DrawerNote>
            We only count a practice as his if his own name is in the business
            name. Billing under a hospital or a group practice earns nothing —
            it tells us he works there, not that he owns it.
          </DrawerNote>
        </Drawer>
        <Drawer title="What happened here">
          <DrawerNote>
            {ownSignal
              ? "His billing records point at a business carrying his own name, so this counts."
              : hasBilling
                ? "We have his billing records, but the business he bills under does not carry his name. Note the order: one check found the records, the next one rejected the claim."
                : "We never found Medicare billing records for him, so there is nothing to judge. This unlocks only if a future sync finds him."}
          </DrawerNote>
          <a
            href="#how-it-scored"
            className="self-start font-display text-[12px] font-semibold text-brand hover:underline"
          >
            See how it scored →
          </a>
        </Drawer>
      </>
    ),
  };

  const jobRow: LedgerRowData = {
    key: "job",
    status: careerSignal ? "found" : "pending",
    where: "Has he changed jobs?",
    whereSub: "Medicare records, month to month",
    found: careerSignal ? careerSignal.description : "Nothing to compare yet",
    worth: careerComp
      ? `${careerComp.points} of ${careerComp.maxPoints} points`
      : undefined,
    how: "Not a match — a comparison against last month",
    drawer: (
      <>
        <Drawer title="How it works">
          <DrawerNote>
            Every month we check his Medicare record against the one we stored
            last time. Anything new — a different practice, a new hospital —
            counts as a job change.
          </DrawerNote>
        </Drawer>
        <Drawer title="Why it is empty">
          <DrawerNote>
            {hasBilling
              ? "The first pull only saves a starting point, so there is nothing to compare against yet. This unlocks at the next monthly update."
              : "We have no Medicare billing records for him, so there is nothing to compare at all."}
          </DrawerNote>
        </Drawer>
      </>
    ),
  };

  const mentioned = signals.filter((s) => s.strength >= 0.3).length;
  const quiet = signals.length - mentioned;
  const summaryRow: LedgerRowData = {
    key: "narration",
    status: "passed",
    where: "What the summary says",
    whereSub: "Which signals earn a mention",
    found:
      quiet === 0
        ? `All ${mentioned} signals are strong enough to mention`
        : `${mentioned} mentioned, ${quiet} too weak to mention`,
    how: "Signals under 0.3 still add points, but stay out of the writing",
    drawer: (
      <>
        <Drawer title="The rule">
          <DrawerNote>
            A weak signal still adds points to the score. It just does not earn
            a sentence in the written summary, so the writing stays about the
            things that actually matter.
          </DrawerNote>
        </Drawer>
        <Drawer title="What happened here">
          <DrawerNote>
            {quiet === 0
              ? `Every one of his ${mentioned} signals cleared the bar, so all of them appear in the summary.`
              : `${quiet} of his ${signals.length} signals scored points but sit below the bar, so the summary leaves ${quiet === 1 ? "it" : "them"} out.`}
          </DrawerNote>
        </Drawer>
      </>
    ),
  };

  const sources = identityRows(matches, "#how-it-scored");
  const rows: LedgerRowData[] = [
    eligibilityRow,
    ...sources,
    licenseRow,
    ownershipRow,
    jobRow,
    summaryRow,
  ];

  const hits = sources.filter((r) => r.status === "found");
  const misses = sources.filter((r) => r.status !== "found");
  const list = (rs: LedgerRowData[]) =>
    rs.map((r) => r.inSentence ?? r.where.toLowerCase()).join(" and ");

  const ordered = [...signals].sort((a, b) => b.strength - a.strength);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* ── 1 · What we found ─────────────────────────────────────── */}
      <section
        id="what-we-found"
        className="scroll-mt-24 rounded-[16px] bg-white px-6 py-5 shadow-card"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-surface-soft pb-4">
          <span className="h-4 w-[3px] shrink-0 self-center rounded-full bg-brand" />
          <h2 className="font-display text-[19px] font-bold tracking-[-0.4px] text-ink">
            What we found
          </h2>
          <p className="ml-auto font-display text-[13px] text-ink-muted tabular-nums">
            {ordered.length} facts on record · strongest first
          </p>
          <p className="w-full max-w-[86ch] text-[14px] leading-[21px] text-ink-muted">
            The raw facts behind this prospect, exactly as each source recorded
            them. Everything further down is built out of these.
          </p>
        </div>

        {ordered.length === 0 ? (
          <p className="py-6 text-[14px] text-ink-muted">
            No facts were recorded for this prospect.
          </p>
        ) : (
          <div className="mt-3">
            <div className="hidden gap-4 border-b border-surface-soft px-3.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted md:grid md:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_112px_150px]">
              <span>What we found</span>
              <span>Where it came from</span>
              <span>How sure</span>
              <span>How much it counts</span>
            </div>
            {ordered.map((signal) => {
              const mentioned = signal.strength >= NARRATION_FLOOR;
              return (
                <div
                  key={`${signal.type}-${signal.source}`}
                  className="grid grid-cols-1 items-center gap-2 border-b border-surface-soft px-3.5 py-3.5 last:border-b-0 md:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_112px_150px] md:gap-4"
                >
                  <span>
                    <span
                      className={
                        "block max-w-[70ch] text-[13.5px] leading-[19px] " +
                        (mentioned ? "font-medium text-ink" : "text-ink-muted")
                      }
                    >
                      {signal.description}
                    </span>
                    {!mentioned && (
                      <span className="mt-0.5 block text-[12px] text-ink-muted">
                        Counts toward the score, but too weak to mention in the
                        summary
                      </span>
                    )}
                  </span>

                  <span className="text-[13px] text-ink-muted">
                    {sourceName(signal.source)}
                  </span>

                  <span className="font-display text-[13.5px] text-ink tabular-nums">
                    {Math.round(signal.confidence * 100)}% sure
                  </span>

                  <span className="flex items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.round(signal.strength * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="shrink-0 font-display text-[13.5px] font-bold text-ink tabular-nums">
                      {Math.round(signal.strength * 100)}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2 · How we knew it was him ────────────────────────────── */}
      <section
        id="how-we-matched"
        className="scroll-mt-24 rounded-[16px] bg-white px-6 py-5 shadow-card"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-surface-soft pb-4">
          <span className="h-4 w-[3px] shrink-0 self-center rounded-full bg-brand" />
          <h2 className="font-display text-[19px] font-bold tracking-[-0.4px] text-ink">
            {identityConfidence >= 0.8
              ? "We are confident this is one person"
              : "This match is uncertain"}
          </h2>
          <p className="ml-auto font-display text-[13px] text-ink-muted tabular-nums">
            {Math.round(identityConfidence * 100)}% sure · {signalTypesCount} of
            7 kinds of signal
          </p>
          <p className="w-full max-w-[86ch] text-[14px] leading-[21px] text-ink-muted">
            {hits.length > 0
              ? `We found him in ${list(hits)}.`
              : "No outside source matched him."}{" "}
            {misses.length > 0 ? `Nothing came back from ${list(misses)}.` : ""}{" "}
            Every check we ran is below — open a row to see how it was decided.
          </p>
        </div>

        <div className="mt-3">
          <Ledger rows={rows} />
        </div>

        <AuditTrail matches={matches} identityConfidence={identityConfidence} />
      </section>

      {/* ── 3 · What it was worth ─────────────────────────────────── */}
      <section id="how-it-scored" className="scroll-mt-24 flex flex-col gap-4">
        <div className="rounded-[16px] bg-white px-6 py-5 shadow-card">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="h-4 w-[3px] shrink-0 self-center rounded-full bg-brand" />
            <h2 className="font-display text-[19px] font-bold tracking-[-0.4px] text-ink">
              {gated
                ? `Not ranked — license ${licenseStatus}`
                : `His priority is ${totalScore}`}
            </h2>
          </div>
          <p className="mt-2 max-w-[86ch] text-[14px] leading-[21px] text-ink-muted">
            Two separate questions, multiplied. Value asks whether there is
            money here and adds up three facts. Timing asks whether something
            just happened and rates the single strongest fresh event. Timing
            decides how much of his value he keeps — 60% when nothing has
            happened, all of it when something big just did — and can never lift
            a poor fit above a strong one.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {[
              {
                label: "Value — is there money here?",
                score: qualificationScore,
                color: QUAL,
                note: "adds up to 100",
              },
              {
                label: "Timing — did something just happen?",
                score: timingScore,
                color: TIMING,
                note:
                  identityConfidence < 0.999
                    ? `strongest event × ${identityConfidence.toFixed(2)} identity confidence`
                    : "the strongest single event",
              },
            ].map((half) => (
              <div
                key={half.label}
                className="grid grid-cols-1 items-center gap-2 rounded-[10px] bg-canvas px-4 py-3 md:grid-cols-[minmax(230px,1fr)_1fr_250px] md:gap-4"
              >
                <span className="font-display text-[14.5px] font-bold text-ink">
                  {half.label}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${half.score}%`,
                      backgroundColor: half.color,
                    }}
                  />
                </span>
                <span className="font-display text-[13.5px] text-ink-muted tabular-nums md:text-right">
                  <span className="font-bold text-ink">{half.score}</span> out
                  of 100 · {half.note}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1 px-4 pt-1 text-[13.5px] text-ink-muted tabular-nums md:grid-cols-[minmax(230px,1fr)_1fr_250px] md:gap-4">
              <span className="eyebrow self-center">Multiplier</span>
              <span className="font-display">
                0.60 + 0.40 × {timingScore} / 100 ={" "}
                <span className="font-bold text-ink">
                  ×{multiplier.toFixed(2)}
                </span>
              </span>
              <span className="md:text-right">
                he keeps {Math.round(multiplier * 100)}% of his value
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 pt-1">
              <span className="eyebrow">Priority</span>
              <span className="font-display text-[16px] font-bold text-ink tabular-nums">
                {gated ? (
                  <>
                    0{" "}
                    <span className="font-normal text-ink-muted">
                      — license gate
                    </span>
                  </>
                ) : (
                  <>
                    {qualificationScore} × {multiplier.toFixed(2)} ={" "}
                    {totalScore}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <ScoreGroup
          question="Value — is there money here?"
          subtitle="Three facts that are all true at once, so their points add: what his specialty tends to accumulate, whether he owns his practice (worth less the longer he has been in), and where he is in his career — the points peak between five and fifteen years in."
          subtotal={qualificationScore}
          rule="adds up to 100"
          items={qual}
          color={QUAL}
        />
        <ScoreGroup
          question="Timing — did something just happen?"
          subtitle="Only the strongest fresh event counts, and every event loses half its value each year. Two events do not make him twice as timely."
          subtotal={timingScore}
          rule="strongest one counts"
          items={timing}
          color={TIMING}
          confidence={identityConfidence}
        />
      </section>
    </div>
  );
}
