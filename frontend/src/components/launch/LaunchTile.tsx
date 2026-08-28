import type { ReactNode } from "react";

type Props = {
  /** Small-caps label in the tile's top-left corner. */
  eyebrow: string;
  /** Headline content, optically centred in the tile. */
  children: ReactNode;
  /** Quiet supporting line pinned to the bottom edge. */
  footer?: ReactNode;
  className?: string;
};

/** Shared shell for every square on the opening page: same radius, padding
 *  and three-band layout (eyebrow / centred body / footer), so tiles can be
 *  swapped or reordered without the composition drifting. */
export default function LaunchTile({ eyebrow, children, footer, className = "" }: Props) {
  return (
    <section
      className={
        "flex min-h-0 flex-col rounded-[20px] bg-white p-7 shadow-panel " + className
      }
    >
      <p className="eyebrow">{eyebrow}</p>
      <div className="flex flex-1 flex-col justify-center py-6">{children}</div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </section>
  );
}
