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
      <div className="mb-2.5 flex items-center gap-3">
        {/* Named for the act, not the reference. Two facts side by side in
            equal tiles is a card you consult; this is the step you take. */}
        <h2 className="section-title">Do this next</h2>
        {/* How to approach, kept to one marker rather than two amber slabs.
            The rules are constraints — read once, obeyed thereafter — so
            they do not need to shout on every profile. The badge stays
            visible so the advisor knows they exist; the words are a hover
            away. Not attached per field, because one of them ("never
            reference the property purchase") governs what you say rather
            than the phone or the address. */}
        {kit.rules.length > 0 ? <RuleHint rules={kit.rules} /> : null}
        {kit.urgency === "elevated" ? (
          <span className="rounded-full bg-tier-neutral-bg px-3 py-1 font-display text-[11px] font-semibold text-tier-neutral-fg">
            Hot — Act Soon
          </span>
        ) : null}
      </div>

      {/* Asymmetric on purpose. Two equal tiles said the address mattered
          as much as placing the call, which is what this block was before;
          a wider, louder left column says call now, address when you write.
          The box measures 796–1076px everywhere it actually appears — the
          board, and the book's slide-over — so the stacked fallback is for
          genuinely small screens rather than for any normal use. */}
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 rounded-[12px] bg-canvas px-5 py-4 sm:grid-cols-[1.55fr_1fr] sm:items-start">
        <div className="min-w-0">
          {kit.phone ? (
            <>
              <a
                href={telHref(kit.phone)}
                title={`Call ${kit.name} on ${kit.phone}`}
                className="font-display text-[22px] font-bold tracking-[-0.3px] text-brand-dark hover:underline"
              >
                {kit.phone}
              </a>
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

        <div className="min-w-0">
          <p className="eyebrow">Practice address</p>
          <p className="mt-0.5 text-[13.5px] leading-[19px] text-ink-muted">
            {address || "Not on record"}
            {!kit.addressComplete && kit.addressLines.length > 0 ? (
              <span className="mt-1 block text-[12px] text-tier-poor">
                Incomplete — verify before mailing
              </span>
            ) : null}
          </p>
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
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-[300px] rounded-[10px] border border-hairline bg-white p-3 text-left opacity-0 shadow-panel transition-opacity group-hover/rule:visible group-hover/rule:opacity-100 group-focus-within/rule:visible group-focus-within/rule:opacity-100"
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
