"use client";

import OutreachActions from "./OutreachActions";
import type { ContactKit } from "@/lib/api";
import type { OutreachEntry } from "@/lib/data";

/** Contact info + outcome capture, rendered in the featured panel right
 *  after the prospect summary — the advisor reads why, sees how to reach
 *  them, and logs what happened without leaving the profile. Tiles match
 *  the key-stat row above; the Hot pill only appears when urgency is
 *  elevated, so its presence always means something. */
export default function ContactKitCard({
  kit,
  prospectId,
  outreach,
}: {
  kit: ContactKit;
  prospectId?: string;
  outreach?: OutreachEntry[];
}) {
  const tiles: { label: string; value: React.ReactNode }[] = [
    {
      label: "Practice Address",
      value:
        kit.addressLines.length > 0 ? (
          <>
            {kit.addressLines.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
            {!kit.addressComplete && (
              <span className="mt-1 block text-[12px] font-normal text-tier-poor">
                Incomplete — verify before mailing
              </span>
            )}
          </>
        ) : (
          "Not on record"
        ),
    },
    { label: "Practice Line", value: kit.phone ?? "Not on record" },
  ];

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <h2 className="eyebrow">Reach Out</h2>
        {kit.urgency === "elevated" ? (
          <span className="rounded-full bg-tier-neutral-bg px-3 py-1 font-display text-[11px] font-semibold text-tier-neutral-fg">
            Hot — Act Soon
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[12px] bg-canvas px-4 py-4">
            <p className="eyebrow">{tile.label}</p>
            <p className="mt-1 font-display text-[14px] font-semibold leading-[20px] text-ink">
              {tile.value}
            </p>
          </div>
        ))}
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
