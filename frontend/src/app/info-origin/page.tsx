import Header from "@/components/Header";
import { ExternalLinkIcon } from "@/components/icons";
import {
  CITATION_GROUPS,
  FLAGGED_CITATIONS,
  type Citation,
  type CitationGroup,
} from "@/lib/citations";

/** One page answering one question: where did this come from?
 *
 *  Built to be scanned, not read. An advisor arrives to check one source,
 *  not to work through an essay, so the default view is a line per source —
 *  name, claim, link — and every longer justification sits folded behind
 *  "Why this proves it". The counts at the top are the honest headline:
 *  four live feeds, and one citation we could not confirm. */

export default function InfoOriginPage() {
  const liveCount = CITATION_GROUPS.find((g) => g.status === "live")!.items
    .length;
  const researchCount = CITATION_GROUPS.filter(
    (g) => g.status === "limitation" || g.status === "research",
  ).reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="pb-16">
      <Header
        crumbs={[{ label: "Info origin" }]}
        back={{ label: "Back", href: "/", history: true }}
      />

      <div className="mx-auto max-w-[1560px] px-8 py-8">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
          Where this comes from
        </h1>
        {/* The headline four numbers, so the answer to "is this sourced?"
            lands before any reading happens. */}
        <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat value={liveCount} label="Live feeds" />
          <Stat value={researchCount} label="Research citations" />
          <Stat
            value={FLAGGED_CITATIONS.length}
            label="Flagged as unverified"
            warn
          />
        </dl>

        {/* Three columns, lining up with the three counts above. The first
            two groups are tall enough to stand alone; everything short
            stacks into the last column so it does not sit half-empty
            beside them, and so one flagged citation does not get a
            full-width banner it has not earned. */}
        <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {CITATION_GROUPS.slice(0, 2).map((group) => (
            <Group key={group.title} group={group} />
          ))}

          <div className="flex flex-col gap-6">
            {CITATION_GROUPS.slice(2).map((group) => (
              <Group key={group.title} group={group} />
            ))}

            <Group
              group={{
                title: "Flagged — cited in code, not confirmed",
                status: "research",
                intro: "An open item, not proof.",
                items: FLAGGED_CITATIONS,
              }}
              flagged
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  warn = false,
}: {
  value: number;
  label: string;
  warn?: boolean;
}) {
  return (
    <div
      className="rounded-[12px] bg-white px-4 py-3 shadow-card"
      style={{
        borderTop: `3px solid ${
          warn ? "var(--color-tier-weak)" : "var(--color-brand)"
        }`,
      }}
    >
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-display text-[22px] font-bold leading-none text-ink">
        {value}
      </dd>
    </div>
  );
}

function Group({
  group,
  flagged = false,
}: {
  group: CitationGroup;
  flagged?: boolean;
}) {
  return (
    <section
      className={
        "rounded-[16px] px-6 py-5 " +
        (flagged
          ? "border border-dashed border-[var(--color-tier-weak)] bg-[var(--color-tier-weak-bg)]"
          : "bg-white shadow-card")
      }
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2
          className={
            "font-display text-[16px] font-bold tracking-[-0.3px] " +
            (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-ink")
          }
        >
          {group.title}
        </h2>
        <span className="font-display text-[12px] font-semibold text-ink-faint">
          {group.items.length}
        </span>
      </div>

      <p
        className={
          "mt-1 text-[13px] leading-[19px] " +
          (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-ink-muted")
        }
      >
        {group.intro}
      </p>

      <ul className="mt-3 flex flex-col">
        {group.items.map((item) => (
          <Row key={item.id} item={item} flagged={flagged} />
        ))}
      </ul>
    </section>
  );
}

/** Name, claim, link on one line; the full argument folded underneath.
 *  Native <details> — keyboard and screen-reader behaviour come free, and
 *  it works before hydration. */
function Row({ item, flagged }: { item: Citation; flagged: boolean }) {
  const tone = flagged ? "text-[var(--color-tier-weak-fg)]" : "text-ink-muted";
  const rule = flagged
    ? "border-[color-mix(in_srgb,var(--color-tier-weak)_25%,transparent)]"
    : "border-surface-soft";

  return (
    <li className={"border-b py-3 last:border-b-0 " + rule}>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          "flex w-fit items-center gap-1.5 font-display text-[14px] font-bold tracking-[-0.1px] hover:underline " +
          (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-brand")
        }
      >
        {item.label}
        <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" />
      </a>

      <p className={"mt-0.5 text-[13px] leading-[19px] " + tone}>
        {item.summary}
      </p>

      <details className="group mt-1">
        <summary
          className={
            "w-fit cursor-pointer list-none text-[12px] underline decoration-dotted decoration-from-font underline-offset-[3px] transition-colors hover:text-brand [&::-webkit-details-marker]:hidden " +
            (flagged ? "text-[var(--color-tier-weak-fg)]" : "text-ink-faint")
          }
        >
          <span className="group-open:hidden">Why</span>
          <span className="hidden group-open:inline">Hide</span>
        </summary>

        <p className={"mt-1.5 max-w-[78ch] text-[12.5px] leading-[18px] " + tone}>
          {item.proves}
        </p>

        {item.flagReason ? (
          <p className="mt-1.5 max-w-[78ch] text-[12.5px] leading-[18px] text-[var(--color-tier-weak-fg)] opacity-90">
            {item.flagReason}
          </p>
        ) : null}

        {item.sourceFile ? (
          <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
            {item.sourceFile}
          </p>
        ) : null}
      </details>
    </li>
  );
}
