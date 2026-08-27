"use client";

import { useState } from "react";
import type { MatchEvidenceItem, ScoreComponentItem } from "@/lib/data";
import MatchEvidencePanel from "./MatchEvidencePanel";

/* ── The scoring rulebook, mirrored from app/scoring/detector.py ──── */

type Rule = { label: string; value: number | null };

const RECENCY_LADDER: Rule[] = [
  { label: "Within 6 months", value: 1.0 },
  { label: "6–12 months ago", value: 0.85 },
  { label: "1–2 years ago", value: 0.6 },
  { label: "2–3 years ago", value: 0.3 },
  { label: "Over 3 years ago", value: 0.1 },
  { label: "No event on record", value: 0 },
];

const RULEBOOK: Record<string, Rule[]> = {
  "Physician standing": [
    { label: "Active state license (IDFPR-verified)", value: 1.0 },
    { label: "NPI only — license unverified", value: 0.7 },
    { label: "License not active", value: 0.5 },
  ],
  "Specialty earning tier": [
    { label: "Orthopaedic / Neurological / Plastic surgery", value: 1.0 },
    { label: "Cardiovascular disease", value: 0.95 },
    { label: "Dermatology / Gastroenterology", value: 0.9 },
    { label: "Anesthesiology / Radiology", value: 0.85 },
    { label: "Urology", value: 0.8 },
    { label: "Oncology", value: 0.75 },
    { label: "Emergency medicine", value: 0.6 },
    { label: "Internal medicine", value: 0.45 },
    { label: "Family medicine / Pediatrics / other", value: 0.4 },
  ],
  "Practice ownership": [
    { label: "Bills under own PLLC / PC / SC, active", value: 0.8 },
    { label: "Bills under own generic LLC, active", value: 0.55 },
    { label: "Own entity, inactive (× 0.6)", value: null },
    { label: "No owned entity found", value: 0 },
  ],
  "License recency": RECENCY_LADDER,
  "Practice entry (NPI enumeration)": RECENCY_LADDER,
  "Property purchase recency": RECENCY_LADDER,
  "Career advancement": [
    { label: "New billing group / facility detected (0.8 × recency)", value: null },
    { label: "No move detected yet — needs a later PECOS sync", value: 0 },
  ],
};

/** Which rulebook row this component's strength lands on. */
function currentRow(label: string, strength: number): number {
  const rules = RULEBOOK[label] ?? [];
  const exact = rules.findIndex(
    (r) => r.value !== null && Math.abs(r.value - strength) < 0.005,
  );
  if (exact >= 0) return exact;
  if (strength === 0) return rules.findIndex((r) => r.value === 0);
  // Non-zero, no exact value (career × recency, inactive multiplier)
  return rules.findIndex((r) => r.value === null);
}

/* ── UI ─────────────────────────────────────────────────────────── */

function GroupCard({
  title,
  subtotal,
  items,
  color,
  selected,
  onClick,
}: {
  title: string;
  subtotal: number;
  items: ScoreComponentItem[];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "w-full rounded-[12px] bg-canvas px-4 py-4 text-left transition-shadow " +
        (selected ? "shadow-float ring-2" : "hover:shadow-raised")
      }
      style={{
        borderLeft: `3px solid ${color}`,
        ...(selected ? { ["--tw-ring-color" as string]: color } : {}),
      }}
    >
      <div className="flex items-baseline justify-between">
        <p className="eyebrow" style={{ color }}>{title}</p>
        <p className="font-display text-[14px] font-bold text-ink tabular-nums">
          {subtotal}
          <span className="font-normal text-ink-faint"> / 100</span>
        </p>
      </div>

      <div className="mt-2 flex h-6 w-full gap-[2px] overflow-hidden rounded-[6px]">
        {items.map((item) => (
          <div
            key={item.label}
            className="relative bg-surface-soft"
            style={{ width: `${item.maxPoints}%` }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${item.strength * 100}%`, backgroundColor: color }}
            />
          </div>
        ))}
      </div>

      <dl className="mt-2">
        {items.map((item) => {
          const empty = item.points === 0;
          return (
            <div key={item.label} className="flex items-baseline justify-between gap-4 py-1">
              <dt className={`truncate text-[13px] ${empty ? "text-ink-faint" : "text-ink-muted"}`}>
                {item.label}
              </dt>
              <dd
                className={
                  "shrink-0 font-display text-[13px] tabular-nums " +
                  (empty ? "text-ink-faint" : "text-ink")
                }
              >
                {item.strength.toFixed(2)} × {item.maxPoints} ={" "}
                <span className={empty ? "" : "font-bold"}>{item.points}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-2 text-[11px] font-semibold" style={{ color }}>
        {selected ? "Showing scoring rules →" : "Click to see scoring rules →"}
      </p>
    </button>
  );
}

function RulesPanel({ items, color }: { items: ScoreComponentItem[]; color: string }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const current = currentRow(item.label, item.strength);
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[13px] font-semibold text-ink">{item.label}</p>
              <p className="shrink-0 font-display text-[13px] text-ink-muted tabular-nums">
                {item.strength.toFixed(2)} × {item.maxPoints} ={" "}
                <span className="font-bold text-ink">{item.points}</span>
              </p>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {(RULEBOOK[item.label] ?? []).map((rule, i) => {
                const active = i === current;
                const zero = rule.value === 0;
                return (
                  <div
                    key={rule.label}
                    className={
                      "flex items-center justify-between gap-3 rounded-[8px] px-3 py-1.5 " +
                      (active ? "" : "bg-canvas opacity-55")
                    }
                    style={active ? { backgroundColor: "color-mix(in srgb, " + color + " 12%, white)" } : undefined}
                  >
                    <span
                      className={
                        "text-[12px] " +
                        (active ? "font-semibold text-ink" : "text-ink-muted")
                      }
                    >
                      {rule.label}
                      {active && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.5px]" style={{ color }}>
                          ✓ this one
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 font-display text-[11px] font-bold tabular-nums " +
                        (active ? "bg-white text-ink" : "bg-surface-soft text-ink-faint")
                      }
                    >
                      {rule.value === null ? "×" : zero ? "0" : rule.value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BreakdownExplorer({
  qualificationScore,
  timingScore,
  totalScore,
  components,
  matches,
  identityConfidence,
  signalTypesCount,
}: {
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
  matches: MatchEvidenceItem[];
  identityConfidence: number;
  signalTypesCount: number;
}) {
  const [tab, setTab] = useState<"gates" | "scoring">("gates");
  const [selected, setSelected] = useState<"qualification" | "timing">("qualification");
  const qual = components.filter((c) => c.category === "qualification");
  const timing = components.filter((c) => c.category === "timing");
  const QUAL = "var(--color-brand)";
  const TIMING = "var(--color-tier-strong)";
  const shown = selected === "qualification" ? qual : timing;
  const shownColor = selected === "qualification" ? QUAL : TIMING;

  const strip = [
    { label: "Entry", value: "✓ eligible" },
    { label: "Identity", value: `${Math.round(identityConfidence * 100)}%` },
    { label: "Signals", value: `${signalTypesCount} of 6` },
    { label: "Score", value: `${totalScore}` },
  ];

  return (
    <div className="mt-6">
      {/* ── Engine strip: this prospect's journey through the pipeline ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-white px-5 py-3 shadow-card">
        {strip.map((stage, i) => (
          <span key={stage.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-faint">→</span>}
            <span className="text-[12px] text-ink-muted">
              {stage.label}{" "}
              <span className="font-display font-bold text-ink">{stage.value}</span>
            </span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-ink-faint">
          gates first, then the scoreboard
        </span>
      </div>

      {/* ── Tabs, in pipeline order ───────────────────────────────── */}
      <div className="mt-4 flex gap-2">
        {(
          [
            { key: "gates", label: "1 · Gates — how the dossier was built" },
            { key: "scoring", label: "2 · Scoring — what it's worth" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-selected={tab === t.key}
            className={
              "rounded-[10px] px-4 py-2.5 font-display text-[13px] font-semibold transition-colors " +
              (tab === t.key
                ? "bg-brand text-white shadow-brand"
                : "bg-white text-ink-muted shadow-card hover:text-brand")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Gates — all three layers, in order ─────────────── */}
      {tab === "gates" && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Gate 1 · Entry — passed by definition: anyone with a dossier
              cleared every eligibility filter during the pull */}
          <section className="rounded-[16px] bg-white px-6 py-4 shadow-card">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">Gate 1 · Entry — who gets in at all</h2>
              <span className="ml-auto rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[11px] font-semibold text-tier-strong-fg">
                ✓ passed — this prospect exists
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-[18px] text-ink-muted">
              Applied inside each adapter during the pull: physician taxonomy
              only (codes starting 20) · licensed or practicing in IL ·
              individual &quot;Physician and Surgeon&quot; licenses only ·
              deeds ≥ $100k within 36 months · Medicare reassignment rows
              only. Records that fail never become prospects — so every
              dossier you can open has already cleared this gate.
            </p>
          </section>

          {/* Gate 2 · Identity — the only gate where prospects differ */}
          <section className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">
                Gate 2 · Identity — how we matched this person
              </h2>
            </div>
            <MatchEvidencePanel
              matches={matches}
              identityConfidence={identityConfidence}
              onSeeScoring={(group) => {
                setSelected(group);
                setTab("scoring");
              }}
            />
          </section>

          {/* Gate 3 · Derivation — what surviving facts may claim */}
          <section className="rounded-[16px] bg-white px-6 py-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">
                Gate 3 · Derivation — what the facts are allowed to claim
              </h2>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[12px] leading-[18px] text-ink-muted lg:grid-cols-3">
              <p className="rounded-[10px] bg-canvas px-3.5 py-2.5">
                <span className="font-semibold text-ink">Ownership:</span> a
                billing group only counts if the physician&apos;s own name is
                in its legal name — billing under a hospital group earns 0.
              </p>
              <p className="rounded-[10px] bg-canvas px-3.5 py-2.5">
                <span className="font-semibold text-ink">Career:</span> the
                first PECOS sync only seeds a baseline — moves exist only as
                diffs against it, never on day one.
              </p>
              <p className="rounded-[10px] bg-canvas px-3.5 py-2.5">
                <span className="font-semibold text-ink">Narration:</span>{" "}
                signals below 0.3 strength score points but don&apos;t earn a
                sentence in the written reason.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab("scoring")}
              className="mt-2 font-display text-[11px] font-semibold text-brand"
            >
              These appear as the zero rows in Scoring →
            </button>
          </section>
        </div>
      )}

      {/* ── Tab 2: Scoring ────────────────────────────────────────── */}
      {tab === "scoring" && (
        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <h2 className="eyebrow">The Calculation</h2>
            </div>

            <div className="flex flex-col gap-4">
              <GroupCard
                title="Qualification · 60% of total"
                subtotal={qualificationScore}
                items={qual}
                color={QUAL}
                selected={selected === "qualification"}
                onClick={() => setSelected("qualification")}
              />
              <GroupCard
                title="Timing · 40% of total"
                subtotal={timingScore}
                items={timing}
                color={TIMING}
                selected={selected === "timing"}
                onClick={() => setSelected("timing")}
              />

              <div className="rounded-[12px] bg-canvas px-4 py-4">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Total</p>
                  <p className="font-display text-[14px] font-bold text-ink tabular-nums">
                    {totalScore}
                    <span className="font-normal text-ink-faint"> / 100</span>
                  </p>
                </div>
                <div className="mt-2 flex h-6 w-full gap-[2px] overflow-hidden rounded-[6px]">
                  <div className="relative bg-surface-soft" style={{ width: "60%" }}>
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${qualificationScore}%`, backgroundColor: QUAL }}
                    />
                  </div>
                  <div className="relative bg-surface-soft" style={{ width: "40%" }}>
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${timingScore}%`, backgroundColor: TIMING }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-right font-display text-[13px] text-ink-muted tabular-nums">
                  {qualificationScore} × 0.6 + {timingScore} × 0.4 ={" "}
                  <span className="font-bold text-ink">{totalScore}</span>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: shownColor }}
              />
              <h2 className="eyebrow">
                Scoring Rules — {selected === "qualification" ? "Qualification" : "Timing"}
              </h2>
            </div>
            <RulesPanel items={shown} color={shownColor} />
          </section>
        </div>
      )}
    </div>
  );
}
