"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ChevronRight, LogoMark } from "./icons";
import { VIEWER_NAME } from "@/lib/data";
import {
  LAUNCH_ATTR,
  LAUNCH_PARAM,
  hasLaunched,
  launchRequested,
  markLaunched,
} from "@/lib/session";

type Props = {
  /** Prospects first located on today's date. */
  locatedToday: number;
  /** Everyone on the board. */
  total: number;
};

/** Small welcome card laid over the scoreboard, on a light scrim.
 *
 *  It used to be a full-viewport opening page of three tiles. A design
 *  review called that "really big … a lot of empty space", and the reason
 *  holds: TellTale is meant to sit inside an advisor application, so the
 *  advisor is already signed in by the time they arrive. A whole screen to
 *  say Begin is a toll gate. What the welcome is actually for — telling
 *  someone they are in the right place, and what is waiting — fits in a
 *  card, with the board legible behind it.
 *
 *  It is rendered on every visit, so opening the site always lands here.
 *  Whether it stays is a client decision — the server cannot read the
 *  per-tab flag — so a tab that is already mid-review closes it on mount,
 *  with the head script keeping it from painting in the meantime. */
// Per-tab storage never changes under a mounted overlay, so there is
// nothing to subscribe to; the store exists to read it during render.
const subscribeToNothing = () => () => {};

/** How long the card takes to fade out, in step with the classes below. */
const CLOSE_MS = 260;

export default function LaunchOverlay({ locatedToday, total }: Props) {
  // Settle what the server could not: closed for a tab that has already
  // begun, open when the wordmark deliberately asked for it back. Read as
  // an external store rather than set from an effect — the server snapshot
  // is "open", which is what it rendered, so hydration still matches.
  const alreadyBegun = useSyncExternalStore(
    subscribeToNothing,
    () => hasLaunched() && !launchRequested(),
    () => false,
  );
  const [phaseState, setPhase] = useState<"open" | "closing" | "closed">(
    "open",
  );
  const phase = phaseState === "open" && alreadyBegun ? "closed" : phaseState;

  // The head script may have hidden the overlay for a tab that has begun;
  // a deliberate return to the opening screen has to undo that.
  useEffect(() => {
    if (!alreadyBegun) document.documentElement.removeAttribute(LAUNCH_ATTR);
  }, [alreadyBegun]);

  // The stylesheet hook goes on only once the card is fully gone — while
  // it fades it still has to be visible. Setting it on every close also
  // restores what React's development remount strips off <html>.
  useEffect(() => {
    if (phase === "closed")
      document.documentElement.setAttribute(LAUNCH_ATTR, "");
  }, [phase]);

  const begin = useCallback(() => {
    if (phase !== "open") return;
    // This tab is mid-review from here on, so every later navigation back
    // to the scoreboard — and every refresh — skips the welcome.
    markLaunched();
    // Drop ?launch=1 so a refresh mid-review does not replay it.
    const url = new URL(window.location.href);
    if (url.searchParams.has(LAUNCH_PARAM)) {
      url.searchParams.delete(LAUNCH_PARAM);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setPhase("closing");
  }, [phase]);

  // transitionend does not fire when the transition is suppressed (reduced
  // motion), so the card is also unmounted on a timer.
  useEffect(() => {
    if (phase !== "closing") return;
    const instant = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(() => setPhase("closed"), instant ? 0 : CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The scoreboard behind must not scroll while the card covers it.
  useEffect(() => {
    if (phase === "closed") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "closed") return null;

  const closing = phase === "closing";
  // First name only. The card is a greeting, not a record.
  const firstName = VIEWER_NAME.split(" ")[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-welcome"
      data-launch-overlay
      // Tab has nowhere to go but the one button, so keep it there rather
      // than letting focus fall through to the covered scoreboard.
      onKeyDown={(e) => {
        if (e.key === "Tab") e.preventDefault();
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "opacity")
          setPhase("closed");
      }}
      className={
        "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-5 " +
        // 20% black, as the review asked for: the board stays readable
        // behind the card, which is the point of not being a page.
        "bg-black/20 transition-opacity duration-[260ms] ease-out motion-reduce:duration-0 " +
        (closing ? "opacity-0" : "opacity-100")
      }
    >
      <div
        className={
          "w-full max-w-[420px] rounded-[20px] bg-white p-7 shadow-panel " +
          "transition-transform duration-[260ms] ease-out motion-reduce:duration-0 " +
          (closing ? "scale-[0.98]" : "scale-100")
        }
      >
        <p className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand">
            <LogoMark className="size-5 text-white" />
          </span>
          {/* Same lockup as the nav bar (Header.tsx). Keep the two in step. */}
          <span className="font-display text-[12px] font-semibold uppercase tracking-[1px] text-ink-faint">
            TellTale
          </span>
        </p>

        <h2
          id="launch-welcome"
          className="mt-4 font-display text-[24px] font-bold tracking-[-0.6px] text-ink"
        >
          Welcome back, {firstName}
        </h2>

        {/* What the two left-hand tiles used to say, as one sentence. The
            count is the reason to open the board, so it leads. */}
        <p className="mt-1.5 text-[14px] leading-[22px] text-ink-muted">
          {locatedToday > 0 ? (
            <>
              <strong className="font-semibold text-ink">
                {locatedToday} new{" "}
                {locatedToday === 1 ? "prospect" : "prospects"}
              </strong>{" "}
              located today, on a board of {total} ranked by fit.
            </>
          ) : total > 0 ? (
            <>
              No new prospects today.{" "}
              <strong className="font-semibold text-ink">{total}</strong> are
              ranked and waiting on your board.
            </>
          ) : (
            <>Your board is empty — run a refresh to find prospects.</>
          )}
        </p>

        <button
          type="button"
          autoFocus
          onClick={begin}
          disabled={closing}
          className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand px-4 py-3 font-display text-[14px] font-semibold text-white outline-none transition-colors hover:bg-brand-dark active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-light/60 disabled:scale-100 disabled:cursor-default"
        >
          {closing ? "Opening board…" : "Start reviewing"}
          <ChevronRight className="size-4 transition-transform duration-200 group-enabled:group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
