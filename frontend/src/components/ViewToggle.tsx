import Link from "next/link";
import { BookIcon, ColumnsIcon } from "./icons";
import { BOARD_VIEW, BOOK_VIEW, viewHref, type BoardView } from "@/lib/view";

type Props = {
  /** Layout the scoreboard is currently rendering. */
  current: BoardView;
  /** Candidate to keep open when the layout changes. */
  candidateId?: string | null;
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
    title: "Ledger spread — entries open in a side panel",
  },
] as const;

/** Segmented control in the nav bar: the two ways to read the scoreboard.
 *  Plain links rather than client state, so the layout is in the URL and a
 *  refresh or a shared link lands on the same view. */
export default function ViewToggle({ current, candidateId }: Props) {
  return (
    <div
      role="group"
      aria-label="Scoreboard layout"
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-soft p-0.5"
    >
      {OPTIONS.map(({ view, label, Icon, title }) => {
        const active = view === current;
        return (
          <Link
            key={view}
            href={viewHref(view, candidateId)}
            // Swapping layouts must not throw the reader back to the top.
            scroll={false}
            title={title}
            aria-current={active ? "page" : undefined}
            className={
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold transition-colors " +
              (active
                ? "bg-white text-brand-dark shadow-raised"
                : "text-ink-muted hover:text-brand")
            }
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
