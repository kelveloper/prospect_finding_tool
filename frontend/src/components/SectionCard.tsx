import type { ProfileSection } from "@/lib/data";

/** One of the four dossier panels — an accent-barred title over a rule-separated table.
 *
 *  A row carrying `href` renders its value as a link out to the original
 *  public record. Advisors asked for this in the 2026-09-19 review: seeing
 *  which source a fact came from is not the same as being able to open it
 *  and look for the details we did not extract. */
export default function SectionCard({ section }: { section: ProfileSection }) {
  return (
    <section className="rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 px-6 pt-6 pb-4">
        <span
          className="h-4 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: section.accent }}
        />
        <h2 className="eyebrow">{section.title}</h2>
      </div>

      <dl className="px-6 pb-6">
        {section.rows.map((row, i) => (
          <div
            key={row.label}
            className={
              "py-3 " +
              (i < section.rows.length - 1
                ? "border-b border-surface-soft"
                : "")
            }
          >
            <dt className="text-[12px] text-ink-muted">{row.label}</dt>
            <dd className="mt-0.5 font-display text-[14px] font-semibold leading-[20px] text-ink">
              {row.pill ? (
                <span
                  className={
                    "inline-block rounded-full px-2.5 py-1 text-[13px] " +
                    (row.pill === "positive"
                      ? "bg-tier-strong-bg text-tier-strong-fg"
                      : "bg-tier-neutral-bg text-tier-neutral-fg")
                  }
                >
                  {row.value}
                </span>
              ) : row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${row.label}: ${row.value}. Opens the original record at ${row.hrefLabel ?? "the source"} in a new tab.`}
                  className="inline-flex items-center gap-1.5 text-brand underline decoration-from-font underline-offset-[3px] transition-colors hover:text-brand-dark"
                >
                  {row.value}
                  <span aria-hidden className="text-[11px] font-normal">
                    &#8599;
                  </span>
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
