import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { LogoMark, ChevronLeft } from "./icons";
import RefreshData from "./RefreshData";
import ViewerMenu from "./ViewerMenu";
import { fetchCandidateCount, fetchIngestStatus } from "@/lib/api";
import { VIEWER_SID } from "@/lib/data";
import { LAUNCH_HREF } from "@/lib/session";

export type Crumb = { label: string; href?: string };

type Props = {
  /** Board size. Omit and the header counts the board itself. */
  candidateCount?: number;
  /** Trailing crumbs after the ProspectIQ wordmark. */
  crumbs?: Crumb[];
  /** Layout switch beside the wordmark (scoreboard only). It names the
   *  current view the way the old static tag did, and is also how you
   *  leave it. */
  viewToggle?: ReactNode;
  /** One-click return, rendered at the end of the breadcrumb trail. */
  back?: { label: string; href: string };
};

/** Left half is navigation — wordmark, breadcrumbs, back. Right half is the
 *  fixed status trio: how many prospects are on the board, who is signed in
 *  (SID) and their avatar. Same on every page so the bar never shifts. */
export default async function Header({
  crumbs = [],
  viewToggle,
  back,
  candidateCount,
}: Props) {
  const [count, ingestStatus] = await Promise.all([
    candidateCount !== undefined
      ? Promise.resolve(candidateCount)
      : fetchCandidateCount(),
    fetchIngestStatus(),
  ]);

  return (
    <header className="sticky top-0 z-10 border-b border-hairline/60 bg-white">
      <div className="relative mx-auto flex h-16 max-w-[1560px] items-center justify-between gap-6 px-8">
        {/* ── Navigation ─────────────────────────────────── */}
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-3"
        >
          {/* The wordmark is the one way back to the opening screen. A full
              load rather than a <Link>, so it reopens the overlay even when
              the router already considers this URL current. */}
          <a
            href={LAUNCH_HREF}
            title="Back to the opening screen"
            className="flex shrink-0 items-center gap-3"
          >
            <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand text-white">
              <LogoMark className="size-[18px]" />
            </span>
            <span className="font-display text-[18px] font-bold tracking-[-0.4px] text-ink">
              ProspectIQ
            </span>
          </a>

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

        {/* ── Board size · signed-in advisor ─────────────── */}
        {viewToggle ? (
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex">
            <div className="pointer-events-auto">{viewToggle}</div>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-3">
          <RefreshData status={ingestStatus} />
          <span aria-hidden className="text-[12px] text-ink-faint">
            ·
          </span>
          {count !== undefined ? (
            <>
              <span className="text-[12px] text-ink-faint">
                {count} {count === 1 ? "Prospect" : "Prospects"}
              </span>
              <span aria-hidden className="text-[12px] text-ink-faint">
                ·
              </span>
            </>
          ) : null}

          <span
            className="viewer-sid text-[12px] text-ink-faint"
            title="Advisor SID"
          >
            SID {VIEWER_SID}
          </span>

          <ViewerMenu />
        </div>
      </div>
    </header>
  );
}
