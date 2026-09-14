"use client";

import OutreachActions from "./OutreachActions";
import { tidyPlural } from "@/lib/text";
import type { ContactKit } from "@/lib/api";
import type { OutreachEntry } from "@/lib/data";

/** Contact info + outcome capture, rendered in the featured panel right
 *  after the prospect summary — the advisor reads why, sees how to reach
 *  them, and logs what happened without leaving the profile. Tiles match
 *  the key-stat row above; the Hot pill only appears when urgency is
 *  elevated, so its presence always means something. */
/** Strips everything a tel: href can't carry, so "815-395-9350" dials. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export default function ContactKitCard({
  kit,
  prospectId,
  outreach,
}: {
  kit: ContactKit;
  prospectId?: string;
  outreach?: OutreachEntry[];
}) {
  const address = kit.addressLines.join(", ");

  return (
    <section className="mt-7">
      <div className="flex items-center gap-3">
        {/* Named for the act, not the reference. Two facts side by side in
            equal tiles is a card you consult; this is the step you take. */}
        <h2 className="section-title">Do this next</h2>
        {kit.urgency === "elevated" ? (
          <span className="rounded-full bg-tier-neutral-bg px-3 py-1 font-display text-[11px] font-semibold text-tier-neutral-fg">
            Hot — Act Soon
          </span>
        ) : null}
      </div>

      <div className="rounded-[12px] bg-canvas px-5 py-4">
        {/* The number leads. It was one of two equal tiles, which said the
            address mattered as much as placing the call — and the advisor
            only wants the address at the moment they are writing. */}
        {kit.phone ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={telHref(kit.phone)}
              title={`Call ${kit.name} on ${kit.phone}`}
              className="font-display text-[22px] font-bold tracking-[-0.3px] text-brand-dark hover:underline"
            >
              {kit.phone}
            </a>
            {kit.phoneNote ? (
              <span className="text-[12px] text-ink-muted">{kit.phoneNote}</span>
            ) : null}
          </div>
        ) : (
          <p className="font-display text-[15px] font-semibold text-ink-muted">
            No practice line on record
          </p>
        )}

        {/* What to say first — already chosen by the scoring, and until now
            only visible as the "why now" card further up the page. */}
        {kit.opening ? (
          <p className="mt-2.5 text-[14px] leading-[20px] text-ink">
            <span className="font-display font-semibold">Open with:</span>{" "}
            {tidyPlural(kit.opening)}
          </p>
        ) : null}

        <div className="mt-3 border-t border-hairline/50 pt-3">
          <p className="eyebrow">Practice address</p>
          <p className="mt-0.5 text-[14px] leading-[20px] text-ink">
            {address || "Not on record"}
            {!kit.addressComplete && kit.addressLines.length > 0 ? (
              <span className="mt-1 block text-[12px] text-tier-poor">
                Incomplete — verify before mailing
              </span>
            ) : null}
          </p>
        </div>

        {/* How to approach. These come from the API and were dropped in the
            mapper, so the one piece of judgement the product exercises on
            the advisor's behalf has never been on screen. */}
        {kit.rules.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {kit.rules.map((rule) => (
              <li
                key={rule}
                className="flex gap-2 rounded-[9px] bg-tier-weak-bg px-3 py-2 text-[12.5px] leading-[18px] text-tier-weak-fg"
              >
                <span aria-hidden className="shrink-0">
                  !
                </span>
                {rule}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {prospectId ? (
        <OutreachActions
          prospectId={prospectId}
          prospectName={kit.name}
          initialHistory={outreach ?? []}
        />
      ) : null}
    </section>
  );
}
