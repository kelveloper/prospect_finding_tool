"use client";

import { useCallback, useEffect, useState } from "react";
import BeginTile from "./launch/BeginTile";
import FoundTodayTile from "./launch/FoundTodayTile";
import ViewerTile from "./launch/ViewerTile";
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

/** Full-viewport opening page laid over the scoreboard: two squares on the
 *  left (who is signed in, what was located today) and one large square on
 *  the right that starts the review. Pressing it slides the whole overlay
 *  up and off, revealing the scoreboard that was rendered underneath.
 *
 *  It is rendered on every visit, so opening the site always lands here.
 *  Whether it stays is a client decision — the server cannot read the
 *  per-tab flag — so a tab that is already mid-review closes it on mount,
 *  with the head script keeping it from painting in the meantime. */
export default function LaunchOverlay({ locatedToday, total }: Props) {
  const [phase, setPhase] = useState<"open" | "closing" | "closed">("open");

  // Settle what the server could not: closed for a tab that has already
  // begun, open when the wordmark deliberately asked for it back.
  useEffect(() => {
    if (hasLaunched() && !launchRequested()) setPhase("closed");
    else document.documentElement.removeAttribute(LAUNCH_ATTR);
  }, []);

  // The stylesheet hook goes on only once the screen is fully gone — while
  // it slides away it still has to be visible. Setting it on every close
  // also restores what React's development remount strips off <html>.
  useEffect(() => {
    if (phase === "closed") document.documentElement.setAttribute(LAUNCH_ATTR, "");
  }, [phase]);

  const begin = useCallback(() => {
    if (phase !== "open") return;
    // This tab is mid-review from here on, so every later navigation back
    // to the scoreboard — and every refresh — skips the opening screen.
    markLaunched();
    // Drop ?launch=1 so a refresh mid-review does not replay the splash.
    const url = new URL(window.location.href);
    if (url.searchParams.has(LAUNCH_PARAM)) {
      url.searchParams.delete(LAUNCH_PARAM);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setPhase("closing");
  }, [phase]);

  // transitionend does not fire when the transition is suppressed (reduced
  // motion), so the overlay is also unmounted on a timer.
  useEffect(() => {
    if (phase !== "closing") return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setPhase("closed"), instant ? 0 : 800);
    return () => clearTimeout(timer);
  }, [phase]);

  // The scoreboard behind must not scroll while the overlay covers it.
  useEffect(() => {
    if (phase === "closed") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "closed") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start candidate review"
      data-launch-overlay
      // Tab has nowhere to go but the one button, so keep it there rather
      // than letting focus fall through to the covered scoreboard.
      onKeyDown={(e) => {
        if (e.key === "Tab") e.preventDefault();
      }}
      onTransitionEnd={(e) => {
        // Tailwind v4 slides via the `translate` property, not `transform`;
        // both are listed so the unmount survives either being animated.
        const slid = e.propertyName === "translate" || e.propertyName === "transform";
        if (e.target === e.currentTarget && slid) setPhase("closed");
      }}
      className={
        "fixed inset-0 z-50 overflow-y-auto bg-[linear-gradient(160deg,#f0f7fc_0%,#d0eaf7_100%)] " +
        "transition-transform duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:duration-0 " +
        (phase === "closing" ? "-translate-y-full" : "translate-y-0")
      }
    >
      <div className="mx-auto grid min-h-dvh max-w-[1560px] grid-cols-1 grid-rows-[auto_auto_1fr] gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:grid-rows-2">
        <ViewerTile />
        <FoundTodayTile count={locatedToday} total={total} />
        <div className="grid lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BeginTile onBegin={begin} total={total} busy={phase === "closing"} />
        </div>
      </div>
    </div>
  );
}
