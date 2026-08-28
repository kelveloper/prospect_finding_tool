import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { LogoMark, ChevronLeft } from "./icons";
import { fetchCandidateCount } from "@/lib/api";
import { VIEWER_INITIALS, VIEWER_SID } from "@/lib/data";

export type Crumb = { label: string; href?: string };

type Props = {
  /** Trailing crumbs after the ProspectIQ wordmark. */
  crumbs?: Crumb[];
  /** Rounded tag beside the wordmark (scoreboard only). */
  pill?: string;
  /** One-click return, rendered at the end of the breadcrumb trail. */
  back?: { label: string; href: string };
  /** Board size. Omit and the header counts the board itself. */
  candidateCount?: number;
  /** The view switcher, on pages that have one. It sits in the header rather
   *  than the page so it never moves between layouts. */
  viewToggle?: ReactNode;
};

/** Left half is navigation — wordmark, breadcrumbs, back. Right half is the
 *  fixed status trio: how many prospects are on the board, who is signed in
 *  (SID) and their avatar. Same on every page so the bar never shifts. */
export default async function Header({
  crumbs = [],
  pill,
  back,
  candidateCount,
  viewToggle,
}: Props) {
  const count = candidateCount ?? (await fetchCandidateCount());

  return (
    <header className="sticky top-0 z-10 border-b border-hairline/60 bg-white">
      <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between gap-6 px-8">
        {/* ── Navigation ─────────────────────────────────── */}
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-3"
        >
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand text-white">
              <LogoMark className="size-[18px]" />
            </span>
            <span className="font-display text-[18px] font-bold tracking-[-0.4px] text-ink">
              ProspectIQ
            </span>
          </Link>

          {pill ? (
            <span className="shrink-0 rounded-full bg-surface-tint px-2 py-1 font-display text-[12px] font-semibold text-brand-dark">
              {pill}
            </span>
          ) : null}

          {crumbs.map((crumb) => (
            <Fragment key={crumb.label}>
              <span className="text-[14px] text-ink-faint">/</span>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate font-display text-[14px] font-medium text-brand hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-display text-[14px] font-medium text-ink-muted">
                  {crumb.label}
                </span>
              )}
            </Fragment>
          ))}

          {back ? (
            <Link
              href={back.href}
              className="ml-1 flex shrink-0 items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[13px] font-semibold text-brand shadow-raised transition-colors hover:bg-surface-soft"
            >
              <ChevronLeft className="size-4" />
              {back.label}
            </Link>
          ) : null}
        </nav>

        {viewToggle ? (
          <div className="hidden shrink-0 md:block">{viewToggle}</div>
        ) : null}

        {/* ── Board size · signed-in advisor ─────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          {count !== undefined ? (
            <>
              <span className="text-[12px] text-ink-faint">
                {count} {count === 1 ? "Candidate" : "Candidates"}
              </span>
              <span aria-hidden className="text-[12px] text-ink-faint">
                ·
              </span>
            </>
          ) : null}

          <span className="text-[12px] text-ink-faint" title="Advisor SID">
            SID {VIEWER_SID}
          </span>

          <span className="flex size-8 items-center justify-center rounded-full bg-brand font-display text-[12px] font-bold text-white">
            {VIEWER_INITIALS}
          </span>
        </div>
      </div>
    </header>
  );
}
