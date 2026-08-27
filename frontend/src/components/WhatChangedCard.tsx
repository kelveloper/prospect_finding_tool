import type { FieldChangeItem } from "@/lib/data";

const FIELD_LABELS: Record<string, string> = {
  specialty: "Specialty",
  license_status: "License status",
  license_issue_date: "License issue date",
  enumeration_date: "NPI enumeration date",
  license_number: "License number",
  address_line: "Practice address",
  city: "City",
  zip_code: "Zip code",
  phone: "Practice phone",
  npi: "NPI",
  first_name: "First name",
  last_name: "Last name",
  state: "State",
};

const TIER_CHIP: Record<FieldChangeItem["tier"], { label: string; cls: string }> = {
  score: { label: "affects score", cls: "bg-tier-strong-bg text-tier-strong-fg" },
  contact: { label: "contact info", cls: "bg-surface-tint text-brand-dark" },
  identity: { label: "⚠ identity", cls: "bg-tier-neutral-bg text-tier-neutral-fg" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Dossier panel listing captured-field changes across ingests, newest
 *  first. Only rendered when there is something to show. */
export default function WhatChangedCard({ changes }: { changes: FieldChangeItem[] }) {
  const newestFirst = changes.slice().reverse();

  return (
    <section className="rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
        <h2 className="eyebrow">What Changed</h2>
        <span className="ml-auto rounded-full bg-canvas px-2.5 py-1 font-display text-[11px] font-semibold text-ink-muted">
          {changes.length} update{changes.length === 1 ? "" : "s"}
        </span>
      </div>

      <dl className="px-6 pb-6">
        {newestFirst.map((c, i) => (
          <div
            key={`${c.field}-${c.changedAt}`}
            className={
              "py-3 " + (i < newestFirst.length - 1 ? "border-b border-surface-soft" : "")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[13px] font-semibold text-ink">
                {FIELD_LABELS[c.field] ?? c.field}
              </dt>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 font-display text-[10px] font-semibold " +
                  TIER_CHIP[c.tier].cls
                }
              >
                {TIER_CHIP[c.tier].label}
              </span>
            </div>
            <dd className="mt-1 text-[13px] text-ink-muted">
              <span className="line-through decoration-ink-faint/50">
                {c.oldValue ?? "—"}
              </span>
              <span className="mx-1.5 text-ink-faint">→</span>
              <span className="font-semibold text-ink">{c.newValue ?? "—"}</span>
              <span className="ml-2 text-[11px] text-ink-faint">{fmtDate(c.changedAt)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
