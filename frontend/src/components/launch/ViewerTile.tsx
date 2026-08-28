import LaunchTile from "./LaunchTile";
import { VIEWER_INITIALS, VIEWER_NAME, VIEWER_ROLE, VIEWER_SID } from "@/lib/data";

/** Top-left square: who is signed in, with their avatar. */
export default function ViewerTile() {
  return (
    <LaunchTile
      eyebrow="Signed in as"
      footer={
        <p className="text-[12px] text-ink-faint">
          SID {VIEWER_SID}
          <span aria-hidden className="px-1.5">
            ·
          </span>
          Session active
        </p>
      }
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand font-display text-[20px] font-bold text-white shadow-brand">
          {VIEWER_INITIALS}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[22px] font-bold tracking-[-0.5px] text-ink">
            {VIEWER_NAME}
          </span>
          <span className="block truncate text-[14px] text-ink-muted">{VIEWER_ROLE}</span>
        </span>
      </div>
    </LaunchTile>
  );
}
