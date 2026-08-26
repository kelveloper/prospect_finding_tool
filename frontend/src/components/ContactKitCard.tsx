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

export default function ContactKitCard({ kit }: { kit: ContactKit }) {
  const [copied, setCopied] = useState(false);

  const letterText = `${kit.letter.salutation}\n\n${kit.letter.body}`;

  async function copyLetter() {
    await navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-6 rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-surface-soft px-6 py-4">
        <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
        <h2 className="font-display text-[15px] font-bold text-ink">Contact Kit</h2>
        <span
          className={
            "ml-auto rounded-full px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.55px] " +
            (kit.urgency === "elevated"
              ? "bg-tier-neutral-bg text-tier-neutral-fg"
              : "bg-canvas text-ink-muted")
          }
        >
          {kit.urgency === "elevated" ? "Hot Timing" : "Standard Timing"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ── Channels + trigger ─────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-[12px] bg-canvas px-4 py-3">
            <p className="eyebrow">Mail — Practice Address</p>
            {kit.addressLines.length > 0 ? (
              <p className="mt-1 text-[14px] leading-[22px] text-ink">
                {kit.name}
                {kit.addressLines.map((line) => (
                  <span key={line} className="block">{line}</span>
                ))}
              </p>
            ) : (
              <p className="mt-1 text-[14px] text-ink-muted">Not on record</p>
            )}
            {!kit.addressComplete && (
              <p className="mt-1 text-[12px] text-tier-poor">
                Address incomplete — verify before mailing
              </p>
            )}
          </div>

          <div className="rounded-[12px] bg-canvas px-4 py-3">
            <p className="eyebrow">Phone — Practice Line</p>
            <p className="mt-1 text-[14px] text-ink">
              {kit.phone ?? "Not on record"}
            </p>
            {kit.phone && (
              <p className="mt-0.5 text-[12px] text-ink-muted">{kit.phoneNote}</p>
            )}
          </div>

          <div className="rounded-[12px] bg-canvas px-4 py-3">
            <p className="eyebrow">Write About</p>
            {kit.trigger ? (
              <>
                <p className="mt-1 font-display text-[14px] font-semibold text-ink">
                  {kit.trigger.label}
                  {kit.trigger.eventDate && (
                    <span className="ml-1.5 font-normal text-ink-muted">
                      · {fmtDate(kit.trigger.eventDate)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] leading-[20px] text-ink-muted">
                  {kit.trigger.description}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-ink-muted">
                No event trigger — general introduction
              </p>
            )}
          </div>

          <ul className="space-y-1.5 px-1">
            {kit.rules.map((rule) => (
              <li key={rule} className="flex gap-2 text-[12px] leading-[18px] text-ink-muted">
                <span className="shrink-0 text-tier-poor">⚠</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Letter draft ───────────────────────────────── */}
        <div className="flex flex-col rounded-[12px] border border-hairline bg-surface-soft/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Letter Draft</p>
            <button
              onClick={copyLetter}
              className="rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft"
            >
              {copied ? "Copied ✓" : "Copy Letter"}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-[14px] leading-[23px] text-ink">
            {letterText}
          </p>
          <p className="mt-4 text-[12px] text-ink-muted">
            Deterministic draft from detected signals — edit the [bracketed]
            placeholders before sending.
          </p>
        </div>
      </div>
    </section>
  );
}
