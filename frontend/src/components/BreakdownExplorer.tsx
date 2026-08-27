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
}: {
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
  matches: MatchEvidenceItem[];
  identityConfidence: number;
}) {
  const [selected, setSelected] = useState<"qualification" | "timing">("qualification");
  const qual = components.filter((c) => c.category === "qualification");
  const timing = components.filter((c) => c.category === "timing");
  const QUAL = "var(--color-brand)";
  const TIMING = "var(--color-tier-strong)";
  const shown = selected === "qualification" ? qual : timing;
  const shownColor = selected === "qualification" ? QUAL : TIMING;

  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {/* ── Left: the calculation, cards select the rules shown right ── */}
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

      {/* ── Right: rules for the selected group, then match evidence ── */}
      <div className="flex flex-col gap-6">
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

        <section className="rounded-[16px] bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
            <h2 className="eyebrow">How We Matched This Person</h2>
          </div>
          <MatchEvidencePanel matches={matches} identityConfidence={identityConfidence} />
        </section>
      </div>
    </div>
  );
}
