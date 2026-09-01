/**
 * Presentation style — who the screen is currently being shown to.
 *
 * This is a viewer preference, not page state, so unlike `?view=` it lives in
 * localStorage and on a `data-style` attribute on <html>. Any CSS can then key
 * off it:
 *
 *     [data-style="client"] .something { color: … }
 *
 * To add a style: add it to STYLES, give it a label, and write the rules in
 * globals.css. Nothing else needs to change — the menu builds itself from
 * this list.
 */

export const STYLE_ATTR = "data-style";
export const STYLE_KEY = "prospectiq_style";

export const STYLES = {
  advisor: {
    label: "Advisor view",
    hint: "The working palette",
  },
  client: {
    label: "Client view",
    hint: "Same information, client-facing colors",
  },
} as const;

export type StyleName = keyof typeof STYLES;

export const DEFAULT_STYLE: StyleName = "advisor";

export function isStyle(value: string | null): value is StyleName {
  return value !== null && value in STYLES;
}

/** Applied in <head> so a stored style is on <html> before the first paint —
 *  without it the page renders advisor-styled and then snaps. Mirrors
 *  LAUNCH_GUARD_SCRIPT in lib/session.ts. */
export const STYLE_SCRIPT =
  `(function(){try{var s=localStorage.getItem(${JSON.stringify(STYLE_KEY)});` +
  `if(s)document.documentElement.setAttribute(${JSON.stringify(STYLE_ATTR)},s)}catch(e){}})()`;
