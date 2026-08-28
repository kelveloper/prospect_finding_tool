/**
 * Whether this tab has already started its review.
 *
 * The opening screen is the site's front door: every time the app is opened
 * — a new tab, a new window, a new browser session — it comes up first.
 * What it must not do is replay itself mid-review, on a refresh or on the
 * way back from a prospect page, so that decision is remembered per tab in
 * sessionStorage rather than in a cookie every tab shares.
 *
 * Client-safe on purpose: no `next/headers` import, so the overlay and the
 * header can share these names.
 */
export const LAUNCH_KEY = "prospectiq_launched";

/** Set on <html> while a tab is mid-review; globals.css hides the overlay. */
export const LAUNCH_ATTR = "data-launched";

/** `/?launch=1` reopens the opening screen inside a tab that has begun. */
export const LAUNCH_PARAM = "launch";

/** Href that deliberately returns to the opening screen. */
export const LAUNCH_HREF = `/?${LAUNCH_PARAM}=1`;

/** Whether this tab is already past the opening screen. */
export function hasLaunched(): boolean {
  try {
    return window.sessionStorage.getItem(LAUNCH_KEY) === "1";
  } catch {
    // Private modes and blocked storage: treat the visit as brand new.
    return false;
  }
}

/** Whether the URL is asking for the opening screen back. */
export function launchRequested(): boolean {
  return new URLSearchParams(window.location.search).has(LAUNCH_PARAM);
}

/** Records that the review has begun. Called as the overlay slides away.
 *
 *  Only the flag is written here. `LAUNCH_ATTR` goes on <html> once the
 *  overlay is fully gone, because the stylesheet rule it drives would
 *  otherwise cut the slide-away animation off at its first frame. */
export function markLaunched(): void {
  try {
    window.sessionStorage.setItem(LAUNCH_KEY, "1");
  } catch {
    // Nothing to remember, so the next load opens on the screen again.
  }
}

/** Blocking script for the document head.
 *
 *  sessionStorage cannot be read while the page renders on the server, so
 *  the server always sends the opening screen and this runs during HTML
 *  parsing — before the first paint — to hide it again in a tab that is
 *  already mid-review. Without it, that tab would flash the splash on every
 *  refresh. */
export const LAUNCH_GUARD_SCRIPT =
  `(function(){try{if(sessionStorage.getItem(${JSON.stringify(LAUNCH_KEY)})==="1"` +
  `&&!new URLSearchParams(location.search).has(${JSON.stringify(LAUNCH_PARAM)}))` +
  `document.documentElement.setAttribute(${JSON.stringify(LAUNCH_ATTR)},"")}catch(e){}})()`;
