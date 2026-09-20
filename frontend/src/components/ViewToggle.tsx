"use client";

import { BookIcon, ColumnsIcon } from "./icons";
import {
  boardHref,
  setLayout,
  useBoardState,
  type BoardState,
} from "@/lib/boardState";
import { BOARD_VIEW, BOOK_VIEW } from "@/lib/view";

type Props = {
  /** What the server read out of the URL, before the reader touches this. */
  initial: BoardState;
};

const OPTIONS = [
  {
    view: BOARD_VIEW,
    label: "Board",
    Icon: ColumnsIcon,
    title: "Profile panel beside the ranked list",
  },
  {
    view: BOOK_VIEW,
    label: "Book",
    Icon: BookIcon,
    title: "Ledger spread — the whole list, six entries to a page",
  },
] as const;

/** Segmented control in the nav bar: the two ways to read the scoreboard.
 *
 *  Switching is client state, so it repaints in a frame instead of waiting
 *  on a server render of the whole board. The real href stays on the anchor
 *  so the view is still copyable and middle-clickable, and the state store
 *  writes it to the URL afterwards. */
export default function ViewToggle({ initial }: Props) {
  const state = useBoardState(initial);

  return (
    <div
      role="group"
      aria-label="Scoreboard layout"
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-soft p-0.5"
    >
      {OPTIONS.map(({ view, label, Icon, title }) => {
        const active = view === state.layout;
        return (
          <a
            key={view}
            // Placement travels across; the open entry does not.
            href={boardHref({ ...state, layout: view, entry: null })}
            onClick={(e) => {
              // Let the browser handle the gestures that mean "somewhere
              // else" — new tab, new window, download.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              setLayout(view);
            }}
            title={title}
            aria-current={active ? "page" : undefined}
            className={
              // active:scale is instant on purpose — a press should land
              // the moment the mouse goes down, not ease into it.
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold transition-colors active:scale-[0.97] " +
              (active
                ? "bg-white text-brand-dark shadow-raised"
                : // A colour change alone was the weakest feedback in the
                  // app, on the one control a design review asked about.
                  "text-ink-muted hover:bg-white/60 hover:text-brand")
            }
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
