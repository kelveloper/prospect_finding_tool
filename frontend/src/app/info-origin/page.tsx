import Header from "@/components/Header";
import { ExternalLinkIcon } from "@/components/icons";
import {
  CITATION_GROUPS,
  FLAGGED_CITATIONS,
  type Citation,
} from "@/lib/citations";

/** One page answering one question: where did this come from? Every live
 *  data source, every research citation behind a scoring rule, and every
 *  vendor priced for the roadmap — each as a link and one sentence on what
 *  it proves. Two entries the code cites but a 2026-09-14 recheck couldn't
 *  cleanly confirm sit at the bottom, marked unverified rather than mixed
 *  in with settled proof. */
export default function InfoOriginPage() {
  return (
    <div className="min-h-screen pb-16">
      <Header crumbs={[{ label: "Info origin" }]} />

      <div className="mx-auto max-w-[900px] px-8 py-8">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          Where this comes from
        </h1>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-[21px] text-ink-muted">
          Every live data pull and every rule behind the score traces back to
          one of these. A label, a link, and one sentence on what it proves —
          nothing on the board is asserted without a source underneath it.
        </p>

        <div className="mt-8 flex flex-col gap-8">
          {CITATION_GROUPS.map((group) => (
            <section
              key={group.title}
              className="rounded-[16px] bg-white px-6 py-5 shadow-card"
            >
              <div className="border-b border-surface-soft pb-4">
                <h2 className="font-display text-[17px] font-bold tracking-[-0.3px] text-ink">
                  {group.title}
                </h2>
                <p className="mt-1 max-w-[74ch] text-[13.5px] leading-[20px] text-ink-muted">
                  {group.intro}
                </p>
              </div>

              <div className="mt-3 flex flex-col">
                {group.items.map((item) => (
                  <CitationRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-[16px] border border-dashed border-[var(--color-tier-weak)] bg-[var(--color-tier-weak-bg)] px-6 py-5">
            <div className="border-b border-[color-mix(in_srgb,var(--color-tier-weak)_25%,transparent)] pb-4">
              <h2 className="font-display text-[17px] font-bold tracking-[-0.3px] text-[var(--color-tier-weak-fg)]">
                Flagged — cited in the code, not yet re-verified
              </h2>
              <p className="mt-1 max-w-[74ch] text-[13.5px] leading-[20px] text-[var(--color-tier-weak-fg)]">
                Two rules cite a source that a 2026-09-14 recheck could not
                cleanly confirm. Shown here as an open item, not as proof.
              </p>
            </div>

            <div className="mt-3 flex flex-col">
              {FLAGGED_CITATIONS.map((item) => (
                <CitationRow key={item.id} item={item} flagged />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CitationRow({
  item,
  flagged = false,
}: {
  item: Citation;
  flagged?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-1.5 border-b border-surface-soft py-3.5 last:border-b-0 " +
        (flagged
          ? "border-[color-mix(in_srgb,var(--color-tier-weak)_25%,transparent)]"
          : "")
      }
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          "flex w-fit items-center gap-1.5 font-display text-[14.5px] font-bold tracking-[-0.1px] hover:underline " +
          (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-brand")
        }
      >
        {item.label}
        <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" />
      </a>
      <p
        className={
          "max-w-[74ch] text-[13.5px] leading-[20px] " +
          (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-ink-muted")
        }
      >
        {item.proves}
      </p>
      {flagged && item.flagReason ? (
        <p className="max-w-[74ch] text-[12.5px] leading-[18px] text-[var(--color-tier-weak-fg)] opacity-90">
          {item.flagReason}
        </p>
      ) : null}
      {item.sourceFile ? (
        <p className="font-mono text-[11.5px] text-ink-faint">
          {item.sourceFile}
        </p>
      ) : null}
    </div>
  );
}
