"use client";

import { useState } from "react";
import type { ContactKit } from "@/lib/api";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Dossier panel matching SectionCard's shell: the first-touch essentials.
 *  The full letter draft stays behind the Copy button — not displayed. */
export default function ContactKitCard({ kit }: { kit: ContactKit }) {
  const [copied, setCopied] = useState(false);

  async function copyLetter() {
    await navigator.clipboard.writeText(
      `${kit.letter.salutation}\n\n${kit.letter.body}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Mail — Practice",
      value:
        kit.addressLines.length > 0 ? (
          <>
            {kit.addressLines.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
            {!kit.addressComplete && (
              <span className="block text-[12px] font-normal text-tier-poor">
                Incomplete — verify before mailing
              </span>
            )}
          </>
        ) : (
          "Not on record"
        ),
    },
    { label: "Phone — Practice Line", value: kit.phone ?? "Not on record" },
    {
      label: "Write About",
      value: kit.trigger ? (
        <>
          {kit.trigger.label}
          {kit.trigger.eventDate && (
            <span className="block text-[12px] font-normal text-ink-muted">
              {fmtDate(kit.trigger.eventDate)}
            </span>
          )}
        </>
      ) : (
        "General introduction"
      ),
    },
    {
      label: "Timing",
      value: (
        <span
          className={
            "inline-block rounded-full px-2.5 py-1 text-[13px] " +
            (kit.urgency === "elevated"
              ? "bg-tier-neutral-bg text-tier-neutral-fg"
              : "bg-surface-soft text-ink-muted")
          }
        >
          {kit.urgency === "elevated" ? "Hot" : "Standard"}
        </span>
      ),
    },
  ];

  return (
    <section className="rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
        <h2 className="eyebrow">Contact Kit</h2>
        <button
          onClick={copyLetter}
          className="ml-auto rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft"
        >
          {copied ? "Copied ✓" : "Copy Letter Draft"}
        </button>
      </div>

      <dl className="px-6">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={
              "flex items-start justify-between gap-6 py-3.5 " +
              (i < rows.length - 1 ? "border-b border-surface-soft" : "")
            }
          >
            <dt className="text-[14px] text-ink-muted">{row.label}</dt>
            <dd className="text-right font-display text-[14px] font-semibold text-ink">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-1 px-6 pb-6 pt-2">
        {kit.rules.map((rule) => (
          <li key={rule} className="flex gap-1.5 text-[11px] leading-[17px] text-ink-faint">
            <span className="shrink-0 text-tier-poor">⚠</span>
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
