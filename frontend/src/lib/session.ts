/**
 * Whether the advisor has already started this session.
 *
 * The opening screen is shown by the server, not remembered in component
 * state, so returning to the scoreboard from a candidate page lands on the
 * board itself rather than replaying the splash. A session cookie (no
 * max-age — it dies with the tab) carries that decision.
 *
 * Client-safe on purpose: no `next/headers` import here, so the overlay can
 * share these names. The read happens in the scoreboard page.
 */
export const LAUNCH_COOKIE = "prospectiq_launched";

/** `/?launch=1` reopens the opening screen even once the cookie is set. */
export const LAUNCH_PARAM = "launch";

/** Href that deliberately returns to the opening screen. */
export const LAUNCH_HREF = `/?${LAUNCH_PARAM}=1`;

/** Records that the review has begun. Called as the overlay slides away. */
export function markLaunched(): void {
  document.cookie = `${LAUNCH_COOKIE}=1; path=/; SameSite=Lax`;
}
