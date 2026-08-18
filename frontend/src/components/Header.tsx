import Link from "next/link";
import { Fragment } from "react";
import { LogoMark, ChevronLeft } from "./icons";
import { VIEWER_INITIALS } from "@/lib/data";

export type Crumb = { label: string; href?: string };

type Props = {
  /** Trailing crumbs after the ProspectIQ wordmark. */
  crumbs?: Crumb[];
  /** Rounded tag beside the wordmark (scoreboard only). */
  pill?: string;
  /** Plain meta text on the right (scoreboard only). */
  meta?: string;
  back?: { label: string; href: string };
};

export default function Header({ crumbs = [], pill, meta, back }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-hairline/60 bg-white">
      <div className="mx-auto flex h-16 max-w-[1470px] items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand text-white">
              <LogoMark className="size-[18px]" />
            </span>
            <span className="font-display text-[18px] font-bold tracking-[-0.4px] text-ink">
              ProspectIQ
            </span>
          </Link>

          {pill ? (
            <span className="rounded-full bg-surface-tint px-2 py-1 font-display text-[12px] font-semibold text-brand-dark">
              {pill}
            </span>
          ) : null}

          {crumbs.map((crumb) => (
            <Fragment key={crumb.label}>
              <span className="text-[14px] text-ink-faint">/</span>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="font-display text-[14px] font-medium text-brand hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-display text-[14px] font-medium text-ink-muted">
                  {crumb.label}
                </span>
              )}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {meta ? <span className="text-[12px] text-ink-faint">{meta}</span> : null}

          {back ? (
            <Link
              href={back.href}
              className="flex items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[13px] font-semibold text-brand shadow-raised transition-colors hover:bg-surface-soft"
            >
              <ChevronLeft className="size-4" />
              {back.label}
            </Link>
          ) : null}

          <span className="flex size-8 items-center justify-center rounded-full bg-brand font-display text-[12px] font-bold text-white">
            {VIEWER_INITIALS}
          </span>
        </div>
      </div>
    </header>
  );
}
