"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "./icons";

/** Shared by this button and the Header's fixed-destination back link, so
 *  the two are indistinguishable in the breadcrumb trail. */
export const BACK_CONTROL_CLASS =
  "ml-1 flex shrink-0 items-center gap-2 rounded-[8px] border border-hairline bg-white px-3 py-2 font-display text-[13px] font-semibold text-brand shadow-raised transition-colors hover:bg-surface-soft";

/** "Back" for a page reachable from more than one place.
 *
 *  The dossier pages know where they came from and link straight there.
 *  Info origin does not — it hangs off the footer, so an advisor arrives
 *  from the board or from any prospect. This steps back through history
 *  instead of guessing, and falls back to `fallbackHref` when there is no
 *  in-app history to step through (a bookmark, a pasted link, a fresh tab). */
export default function BackButton({
  label,
  fallbackHref,
}: {
  label: string;
  fallbackHref: string;
}) {
  const router = useRouter();

  function goBack() {
    let cameFromHere = false;
    try {
      cameFromHere =
        document.referrer !== "" &&
        new URL(document.referrer).origin === window.location.origin;
    } catch {
      // A malformed referrer is not worth a crash — treat it as "no history".
      cameFromHere = false;
    }
    if (cameFromHere) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={goBack} className={BACK_CONTROL_CLASS}>
      <ChevronLeft className="size-4" />
      {label}
    </button>
  );
}
