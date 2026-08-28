"use client";

import { ArrowUpIcon, LogoMark } from "@/components/icons";

type Props = {
  /** Slides the overlay away and reveals the scoreboard. */
  onBegin: () => void;
  /** Board size, previewed on the face of the button. */
  total: number;
  /** True once the slide-up is running — stops a second click. */
  busy: boolean;
};

/** The large right-hand square. The whole tile is the button that starts
 *  the review, so there is exactly one thing to hit on the opening page. */
export default function BeginTile({ onBegin, total, busy }: Props) {
  return (
    <button
      type="button"
      autoFocus
      onClick={onBegin}
      disabled={busy}
      aria-label={`Begin reviewing ${total} ${total === 1 ? "candidate" : "candidates"}`}
      className="group flex min-h-[320px] flex-col rounded-[20px] bg-brand p-9 text-left text-white shadow-panel outline-none transition-[transform,background-color] duration-200 hover:bg-brand-dark focus-visible:ring-4 focus-visible:ring-brand-light/60 enabled:hover:-translate-y-0.5 disabled:cursor-default"
    >
      <span className="flex shrink-0 items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-white/15">
          <LogoMark className="size-5" />
        </span>
        <span className="font-display text-[12px] font-semibold uppercase tracking-[1px] text-white/70">
          ProspectIQ
        </span>
      </span>

      <span className="flex flex-1 flex-col justify-center py-8">
        <span className="block font-display text-[52px] font-bold leading-[1.05] tracking-[-1.5px] sm:text-[64px]">
          Begin
          <br />
          Review
        </span>
        <span className="mt-3 block max-w-[38ch] text-[15px] leading-[24px] text-white/75">
          Open the scoreboard and work {total} ranked{" "}
          {total === 1 ? "prospect" : "prospects"} from strongest fit down.
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3 font-display text-[15px] font-semibold">
        <span className="flex size-11 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-enabled:group-hover:-translate-y-1">
          <ArrowUpIcon className="size-5" />
        </span>
        {busy ? "Opening scoreboard…" : "Start"}
      </span>
    </button>
  );
}
