"use client";

import { useState } from "react";
import type { ScoreComponentItem } from "@/lib/data";

type Props = {
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
};

function ComponentBar({ item }: { item: ScoreComponentItem }) {
  const pct = item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0;
  const empty = item.points === 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-[13px] ${empty ? "text-ink-faint" : "text-ink-muted"}`}>
          {item.label}
        </span>
        <span
          className={
            "shrink-0 font-display text-[13px] font-semibold " +
            (empty ? "text-ink-faint" : "text-ink")
          }
        >
          {empty ? `0 / ${item.maxPoints} · no signal` : `${item.points} / ${item.maxPoints}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Group({
  title,
  weight,
  subtotal,
  items,
}: {
  title: string;
  weight: string;
  subtotal: number;
  items: ScoreComponentItem[];
}) {
  return (
    <div className="rounded-[12px] bg-canvas px-4 py-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">
          {title} <span className="normal-case text-ink-faint">· {weight} of total</span>
        </p>
        <p className="font-display text-[14px] font-semibold text-ink">{subtotal} / 100</p>
      </div>
      <div className="mt-1">
        {items.map((item) => (
          <ComponentBar key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function ScoreBreakdownCard({
  qualificationScore,
  timingScore,
  totalScore,
  components,
}: Props) {
  const [open, setOpen] = useState(false);
  const qual = components.filter((c) => c.category === "qualification");
  const timing = components.filter((c) => c.category === "timing");

  return (
    <section className="rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span
          className="h-4 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: "var(--color-brand)" }}
        />
        <h2 className="eyebrow">Score Breakdown</h2>
      </div>

      {/* Simple view — always visible */}
      <dl className="px-6">
        {[
          { label: "Qualification (60%)", value: `${qualificationScore} / 100` },
          { label: "Timing (40%)", value: `${timingScore} / 100` },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-6 border-b border-surface-soft py-3.5"
          >
            <dt className="text-[14px] text-ink-muted">{row.label}</dt>
            <dd className="text-right font-display text-[14px] font-semibold text-ink">
              {row.value}
            </dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-6 py-3.5">
          <dt className="text-[14px] text-ink-muted">Total Score</dt>
          <dd className="text-right">
            <span className="inline-block rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[13px] font-semibold text-tier-strong-fg">
              {totalScore} / 100
            </span>
          </dd>
        </div>
      </dl>

      {/* Expandable detail */}
      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-hairline bg-white px-4 py-2.5 font-display text-[13px] font-semibold text-brand transition-colors hover:bg-surface-soft"
        >
          {open ? "Hide calculation ▲" : "How was this calculated? ▼"}
        </button>

        {open ? (
          <div className="mt-4 flex flex-col gap-3">
            <Group
              title="Qualification — should we care?"
              weight="60%"
              subtotal={qualificationScore}
              items={qual}
            />
            <Group
              title="Timing — why now?"
              weight="40%"
              subtotal={timingScore}
              items={timing}
            />
            <p className="text-center text-[12px] text-ink-faint">
              Total = {qualificationScore} × 0.6 + {timingScore} × 0.4 ={" "}
              <span className="font-semibold text-ink-muted">{totalScore}</span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
