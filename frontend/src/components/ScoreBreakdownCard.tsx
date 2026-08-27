"use client";

import Link from "next/link";
import { useState } from "react";
import type { ScoreComponentItem } from "@/lib/data";

type Props = {
  prospectId: string;
  qualificationScore: number;
  timingScore: number;
  totalScore: number;
  components: ScoreComponentItem[];
};

function ComponentRows({ items }: { items: ScoreComponentItem[] }) {
  return (
    <dl className="rounded-[10px] bg-canvas px-3 py-1.5">
      {items.map((item) => {
        const empty = item.points === 0;
        return (
          <div key={item.label} className="flex items-baseline justify-between gap-4 py-1.5">
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
  );
}

/** Summary panel: each group row expands its component tiers on click;
 *  the footer links to the full breakdown page. */
export default function ScoreBreakdownCard({
  prospectId,
  qualificationScore,
  timingScore,
  totalScore,
  components,
}: Props) {
  const [open, setOpen] = useState<{ qual: boolean; timing: boolean }>({
    qual: false,
    timing: false,
  });

  const groups = [
    {
      key: "qual" as const,
      label: "Qualification (60%)",
      score: qualificationScore,
      items: components.filter((c) => c.category === "qualification"),
    },
    {
      key: "timing" as const,
      label: "Timing (40%)",
      score: timingScore,
      items: components.filter((c) => c.category === "timing"),
    },
  ];

  return (
    <section className="rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span
          className="h-4 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: "var(--color-brand)" }}
        />
        <h2 className="eyebrow">Score Breakdown</h2>
      </div>

      <div className="px-6">
        {groups.map((group) => (
          <div key={group.key} className="border-b border-surface-soft">
            <button
              type="button"
              onClick={() => setOpen({ ...open, [group.key]: !open[group.key] })}
              aria-expanded={open[group.key]}
              className="flex w-full items-baseline justify-between gap-6 py-3.5 text-left"
            >
              <span className="text-[14px] text-ink-muted">
                <span
                  className={
                    "mr-1.5 inline-block text-[11px] text-ink-faint transition-transform " +
                    (open[group.key] ? "rotate-90" : "")
                  }
                >
                  ▶
                </span>
                {group.label}
              </span>
              <span className="font-display text-[14px] font-semibold text-ink">
                {group.score} / 100
              </span>
            </button>
            {open[group.key] && (
              <div className="pb-3.5">
                <ComponentRows items={group.items} />
              </div>
            )}
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-6 py-3.5">
          <span className="text-[14px] text-ink-muted">Total Score</span>
          <span className="inline-block rounded-full bg-tier-strong-bg px-2.5 py-1 font-display text-[13px] font-semibold text-tier-strong-fg">
            {totalScore} / 100
          </span>
        </div>
      </div>

      <Link
        href={`/candidate/${prospectId}/breakdown`}
        className="block px-6 pb-6 pt-1 text-center font-display text-[13px] font-semibold text-brand"
      >
        Full calculation &amp; match evidence →
      </Link>
    </section>
  );
}
