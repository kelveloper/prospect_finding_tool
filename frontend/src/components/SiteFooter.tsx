import Link from "next/link";

/** The quiet line at the bottom of every page.
 *
 *  It holds one link: where the data comes from. That used to be an
 *  unlabelled ⓘ in the header's status cluster, wedged between the prospect
 *  count and the signed-in advisor — an application-wide reference sitting
 *  among per-session status. Same reasoning that moved Refresh out of the
 *  nav bar and onto the list it refreshes (see Scoreboard.tsx): put a
 *  control where what it describes actually is.
 *
 *  Rendered once in app/layout.tsx, so every page gets it. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-hairline/60 bg-white">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-8 py-5">
        {/* The name, explained. A telltale is the small detail that gives
            away something hidden, which is the whole thesis: the wealth is
            not visible yet, but the licence date, the billing entity and
            the deed give it away. Written down here because it is the
            first thing anyone asks and it was documented nowhere. */}
        <p className="text-[12px] text-ink-faint">
          <span className="font-display font-semibold text-ink-muted">
            TellTale
          </span>{" "}
          — named for the telltale signs in public records that surface a
          client before the market sees them.
        </p>

        <Link
          href="/info-origin"
          className="text-[12px] font-medium text-ink-muted underline decoration-from-font underline-offset-[3px] transition-colors hover:text-brand"
        >
          Where this data comes from
        </Link>
      </div>
    </footer>
  );
}
