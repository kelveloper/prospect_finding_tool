"use client";

import { useState } from "react";
import { PhoneIcon } from "./icons";
import type { ContactKit } from "@/lib/api";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  // new Date("2026-08-05") is parsed as UTC midnight, which renders as the 4th
  // in any timezone behind UTC. Build it from the parts so the calendar date
  // the backend recorded is the calendar date shown.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Strips everything a tel: href can't use, so "815-395-9350" dials. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** The advisor's next action. One background, hairlines for structure — the
 *  letter is shown rather than hidden behind Copy, because an advisor won't
 *  send a draft they can't read. */
export default function ReachOutPanel({ kit }: { kit: ContactKit }) {
  const [copied, setCopied] = useState(false);

  const letter = `${kit.letter.salutation}\n\n${kit.letter.body}`;
  const triggerDate = kit.trigger ? fmtDate(kit.trigger.eventDate) : null;

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context — leave the button alone
      // rather than claiming a copy that never happened.
    }
  }

  return (
    <section className="overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-3 px-7 pt-6">
        <h2 className="font-display text-[16px] font-bold tracking-[-0.2px] text-ink">
          Reach Out
        </h2>
        {kit.urgency === "elevated" ? (
          <span className="rounded-full bg-tier-neutral-bg px-2.5 py-1 font-display text-[11px] font-semibold text-tier-neutral-fg">
            Time-sensitive
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-x-10 px-7 pt-5 pb-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── Why now, and how to get there ────────────── */}
        <div className="flex flex-col divide-y divide-surface-soft lg:border-r lg:border-surface-soft lg:pr-10">
          <div className="pb-5">
            <p className="eyebrow text-ink-muted">Why now</p>
            {kit.trigger ? (
              <>
                <p className="mt-1.5 font-display text-[15px] font-semibold text-ink">
                  {kit.trigger.label}
                </p>
                <p className="mt-1 text-[14px] leading-[21px] text-ink-muted">
                  {kit.trigger.description}
                </p>
                {triggerDate ? (
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {triggerDate}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">
                No trigger on record — a general introduction.
              </p>
            )}
          </div>

          <div className="py-5">
            <p className="eyebrow text-ink-muted">Call</p>
            {kit.phone ? (
              <>
                <a
                  href={telHref(kit.phone)}
                  className="mt-1.5 inline-flex items-center gap-2 font-display text-[19px] font-bold tracking-[-0.3px] text-brand hover:underline"
                >
                  <PhoneIcon className="size-4 shrink-0" />
                  {kit.phone}
                </a>
                <p className="mt-1 text-[13px] leading-[18px] text-ink-muted">
                  {kit.phoneNote}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">
                No number on record.
              </p>
            )}
          </div>

          <div className="pt-5">
            <p className="eyebrow text-ink-muted">Mail</p>
            {kit.addressLines.length > 0 ? (
              <>
                <address className="mt-1.5 not-italic text-[14px] leading-[21px] text-ink">
                  {kit.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                {!kit.addressComplete ? (
                  <p className="mt-1 text-[12px] font-semibold text-tier-poor">
                    Incomplete — verify before mailing.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">
                No address on record.
              </p>
            )}
          </div>
        </div>

        {/* ── The draft, visible ───────────────────────── */}
        <div className="mt-6 flex min-w-0 flex-col lg:mt-0">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow text-ink-muted">Letter Draft</p>
            <button
              type="button"
              onClick={copyLetter}
              className="rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12px] font-semibold text-brand transition-colors hover:bg-surface-soft"
            >
              {copied ? "Copied ✓" : "Copy draft"}
            </button>
          </div>

          <p className="mt-3 max-w-[68ch] whitespace-pre-wrap border-l-[3px] border-surface-tint pl-5 text-[14px] leading-[25px] text-ink">
            {letter}
          </p>

          <p aria-live="polite" className="sr-only">
            {copied ? "Letter draft copied to clipboard" : ""}
          </p>
        </div>
      </div>

      {/* ── Rules that keep the advisor out of trouble ── */}
      {kit.rules.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-surface-soft bg-canvas px-7 py-3.5">
          {kit.rules.map((rule) => (
            <li
              key={rule}
              className="flex gap-2 text-[13px] leading-[19px] text-ink-muted"
            >
              <span aria-hidden className="shrink-0 text-tier-neutral-fg">
                ⚠
              </span>
              {rule}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
