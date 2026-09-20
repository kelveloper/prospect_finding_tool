"use client";

import { useEffect, useState } from "react";
import OutreachActions from "./OutreachActions";
import { PhoneIcon, PinIcon } from "./icons";
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
      {/* The badge sits inside the heading, between the words and the rule
          the heading draws to the edge. Outside it, the growing title pushed
          it to the far right — technically beside the section, visually
          attached to nothing. */}
      <h2 className="section-title mb-2">
        {/* Named for the act, not the reference. Two facts side by side in
            equal tiles is a card you consult; this is the step you take. */}
        Do this next
        {/* How to approach, kept to one marker rather than two amber slabs.
            The rules are constraints — read once, obeyed thereafter — so
            they do not need to shout on every profile. The badge stays
            visible so the advisor knows they exist; the words are a hover
            away. Not attached per field, because one of them ("never
            reference the property purchase") governs what you say rather
            than the phone or the address. */}
        {kit.rules.length > 0 ? <RuleHint rules={kit.rules} /> : null}
        {kit.urgency === "elevated" ? (
          <span className="shrink-0 rounded-full bg-tier-neutral-bg px-3 py-1 font-display text-[11px] font-semibold text-tier-neutral-fg">
            Hot — Act Soon
          </span>
        ) : null}
      </h2>

      <div className="rounded-[12px] bg-canvas px-5 py-4">
        <div className="min-w-0">
          {kit.phone ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* The glyph is what makes the number read as a channel
                    rather than another figure on a page full of them. */}
                <PhoneIcon className="size-[18px] shrink-0 text-brand-dark" />
                <a
                  href={telHref(kit.phone)}
                  title={`Call ${kit.name} on ${kit.phone}`}
                  className="font-display text-[22px] font-bold tracking-[-0.3px] text-brand-dark hover:underline"
                >
                  {kit.phone}
                </a>
                {/* tel: dials on a phone and usually does nothing on a
                    desk, where this is read. Copying is the action that
                    actually happens next — into a softphone, into the CRM
                    — and doing it by hand means dragging a selection
                    across a link that dials when clicked. */}
                <CopyButton value={kit.phone} label="phone number" />
              </div>
              {kit.phoneNote ? (
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {kit.phoneNote}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-display text-[15px] font-semibold text-ink-muted">
              No practice line on record
            </p>
          )}

          {/* What to say first — already chosen by the scoring, and until now
              only visible as the "why now" card further up the page. */}
          {kit.opening ? (
            <p className="mt-2.5 text-[14px] leading-[20px] text-ink">
              {/* Said plainly. "Open with:" reads as a setting rather than an
                  instruction — it is the phrasing of a config file, not of
                  advice to a person about to dial. */}
              <span className="font-display font-semibold">
                {kit.openingPhrased
                  ? "Open the conversation with"
                  : "Worth raising:"}
              </span>{" "}
              {tidyPlural(kit.opening)}
            </p>
          ) : null}
        </div>

        <div className="mt-3 min-w-0 border-t border-hairline/50 pt-3">
          <p className="eyebrow">Practice address</p>
          {/* Built exactly like the phone row above — glyph, the value, then
              the copy. The button sat on the label line for a while, which
              put the page's two copies in two different relationships to
              the thing they copy; a reader has to work out the second one
              from scratch instead of recognising it. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <PinIcon className="size-[18px] shrink-0 text-ink-faint" />
            <p className="min-w-0 text-[13.5px] leading-[19px] text-ink-muted">
              {address || "Not on record"}
            </p>
            {address ? <CopyButton value={address} label="address" /> : null}
          </div>
          {!kit.addressComplete && kit.addressLines.length > 0 ? (
            <p className="mt-1.5 text-[12px] text-tier-poor">
              Incomplete — verify before mailing
            </p>
          ) : null}
        </div>
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

/** Copy one field to the clipboard, and say so.
 *
 *  The confirmation is the point as much as the copy is: a button that
 *  looks identical before and after leaves the reader wondering whether it
 *  worked, which is the same complaint a design review made about clicking
 *  anything else here. It reverts after a moment so the control is ready
 *  again without a page of stale "Copied" labels. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Blocked origin or refused permission. Stay silent rather than
          // report a copy that did not happen.
        }
      }}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={
        "shrink-0 rounded-[6px] border px-2 py-1 font-display text-[11px] font-semibold transition-colors active:scale-[0.97] " +
        (copied
          ? "border-tier-strong-fg/30 bg-tier-strong-bg text-tier-strong-fg"
          : "border-hairline bg-white text-ink-muted hover:border-brand hover:text-brand")
      }
    >
      <span aria-hidden>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** The rules for approaching this prospect, behind one badge.
 *
 *  Same shape as the evidence badge beside the standing: a small marked
 *  circle you can tab to, and a card on hover or focus. Amber rather than
 *  grey, because these are the one place the product tells an advisor not
 *  to do something.
 */
function RuleHint({ rules }: { rules: string[] }) {
  const spoken = `${rules.length} rule${rules.length === 1 ? "" : "s"} for approaching this prospect: ${rules.join(" ")}`;

  return (
    <span className="group/rule relative inline-flex">
      <span
        tabIndex={0}
        role="note"
        aria-label={spoken}
        // The count is the one thing this shape gives up, so the native
        // tooltip carries it — a mark with no number says nothing about how
        // much is behind it.
        title={`${rules.length} rule${rules.length === 1 ? "" : "s"} for approaching — hover for detail`}
        // Deliberately the same object as the "?" beside the standing: one
        // page should not have two different shapes that both mean "there is
        // more here on hover".
        className="flex size-[18px] cursor-help items-center justify-center rounded-full border border-hairline bg-white font-display text-[10px] font-bold text-ink-muted outline-none transition-colors hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
      >
        !
      </span>

      <span
        aria-hidden
        // A section title is uppercase, bold and set in the display face, and
        // the card inherits all three now that the badge lives inside the
        // heading. Reset every one of them: rules shouted in bold caps are
        // harder to read than the amber slabs they replaced.
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-[300px] rounded-[10px] border border-hairline bg-white p-3 text-left font-sans text-[12.5px] font-normal normal-case tracking-normal opacity-0 shadow-panel transition-opacity group-hover/rule:visible group-hover/rule:opacity-100 group-focus-within/rule:visible group-focus-within/rule:opacity-100"
      >
        <span className="eyebrow block">How to approach</span>
        {rules.map((rule) => (
          <span
            key={rule}
            className="mt-2 flex gap-2 text-[12.5px] leading-[17px] text-ink-muted"
          >
            <span aria-hidden className="shrink-0 text-tier-weak-fg">
              !
            </span>
            {rule}
          </span>
        ))}
      </span>
    </span>
  );
}
