"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";

type Props = {
  /** Prospect name, shown in the panel's own sticky header. */
  label: string;
  /** Rank in the book, so the panel says which entry is open. */
  rank?: number;
  /** Where the book goes when the panel is dismissed. */
  closeHref: string;
  children: ReactNode;
};

/** Right-side slide-over holding a book entry's full detail.
 *
 *  Which entry is open lives in the URL (`?id=`), the same as the board's
 *  featured panel, so a refresh or a shared link reopens it. Only the
 *  animation is local: the panel slides itself out first and navigates
 *  afterwards, so dismissing it does not just blink away. */
export default function CandidateSlideOver({ label, rank, closeHref, children }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"entering" | "open" | "closing">("entering");
  const closeButton = useRef<HTMLButtonElement>(null);

  // Mount off-canvas, then slide in on the next frame so the transition has
  // a start value to animate from.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setPhase((p) => (p === "entering" ? "open" : p)),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = useCallback(() => setPhase("closing"), []);

  // transitionend never fires under reduced motion, so the navigation that
  // actually unmounts this panel is on a timer instead.
  useEffect(() => {
    if (phase !== "closing") return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => router.push(closeHref, { scroll: false }),
      instant ? 0 : 320,
    );
    return () => clearTimeout(timer);
  }, [phase, closeHref, router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // The book behind must not scroll while the panel covers it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  const shown = phase === "open";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} — full entry`}
      // Once it is on its way out it must stop swallowing clicks meant for
      // the book underneath.
      className={"fixed inset-0 z-40 " + (phase === "closing" ? "pointer-events-none" : "")}
    >
      <button
        type="button"
        onClick={close}
        tabIndex={-1}
        aria-label="Close entry"
        className={
          "absolute inset-0 bg-ink/25 transition-opacity duration-300 motion-reduce:duration-0 " +
          (shown ? "opacity-100" : "opacity-0")
        }
      />

      <div
        className={
          "absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-white shadow-panel " +
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0 " +
          (shown ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline/60 bg-white px-6 py-3">
          <div className="min-w-0">
            <p className="eyebrow">{rank ? `Entry ${rank}` : "Entry"}</p>
            <p className="truncate font-display text-[15px] font-bold text-ink">{label}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            className="flex shrink-0 items-center gap-1.5 rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[13px] font-semibold text-brand transition-colors hover:bg-surface-soft"
          >
            <CloseIcon className="size-3.5" />
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
