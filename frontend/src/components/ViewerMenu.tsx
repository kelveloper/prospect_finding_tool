"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_STYLE,
  STYLES,
  STYLE_ATTR,
  STYLE_KEY,
  isStyle,
  type StyleName,
} from "@/lib/style";
import { VIEWER_INITIALS, VIEWER_NAME, VIEWER_ROLE } from "@/lib/data";

/** The signed-in advisor, and what the screen is currently dressed as.
 *
 *  Switching writes `data-style` on <html> and remembers the choice, so the
 *  whole page restyles from CSS rather than from prop-drilling a mode through
 *  every component. */
export default function ViewerMenu() {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<StyleName>(DEFAULT_STYLE);

  // A menu that only closes on its own button is a trap once it overlays the
  // page, so dismiss on any outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function choose(next: StyleName) {
    setStyle(next);
    setOpen(false);
    document.documentElement.setAttribute(STYLE_ATTR, next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      // Private browsing can refuse storage; the style still applies for this
      // page, it just will not be remembered.
    }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        // Read the live attribute as the menu opens rather than on mount: the
        // pre-paint script sets it before React exists, so an effect would
        // both lag and fight hydration.
        onClick={() => {
          if (!open) {
            const current = document.documentElement.getAttribute(STYLE_ATTR);
            setStyle(isStyle(current) ? current : DEFAULT_STYLE);
          }
          setOpen(!open);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${VIEWER_NAME} — change how this screen is shown`}
        className={
          "flex size-8 items-center justify-center rounded-full bg-brand font-display text-[12px] font-bold text-white transition-shadow hover:shadow-float " +
          (open ? "ring-2 ring-brand ring-offset-2" : "")
        }
      >
        {VIEWER_INITIALS}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-[248px] rounded-[12px] border border-hairline bg-white p-1.5 shadow-panel"
        >
          <div className="border-b border-surface-soft px-3 py-2.5">
            <p className="font-display text-[13px] font-semibold text-ink">
              {VIEWER_NAME}
            </p>
            <p className="text-[12px] text-ink-muted">{VIEWER_ROLE}</p>
          </div>

          <p className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.6px] text-ink-faint">
            Showing this screen as
          </p>

          {(Object.keys(STYLES) as StyleName[]).map((name) => {
            const active = style === name;
            return (
              <button
                key={name}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(name)}
                className="flex w-full items-start gap-2 rounded-[8px] px-3 py-2 text-left hover:bg-canvas"
              >
                <span aria-hidden className="w-3 shrink-0 pt-[3px] text-brand">
                  {active ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[13px] font-semibold text-ink">
                    {STYLES[name].label}
                  </span>
                  <span className="block text-[12px] leading-[17px] text-ink-muted">
                    {STYLES[name].hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
