import type { ReactNode } from "react";

type Props = {
  title: string;
  /** One line saying what is inside, so the advisor can decide whether to
   *  open it without opening it. */
  hint?: string;
  /** Count or value shown beside the title — the summary you get for free. */
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** A native <details> panel. No JavaScript, works before hydration, and the
 *  keyboard and screen-reader behavior come from the browser. */
export default function Collapsible({
  title,
  hint,
  badge,
  defaultOpen = false,
  children,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[16px] bg-white shadow-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden">
        <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />

        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="eyebrow">{title}</span>
            {badge ? (
              <span className="rounded-full bg-surface-tint px-2 py-[2px] font-display text-[11px] font-semibold text-brand-dark">
                {badge}
              </span>
            ) : null}
          </span>
          {hint ? (
            <span className="mt-0.5 block text-[12px] text-ink-muted">
              {hint}
            </span>
          ) : null}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-1.5 font-display text-[12px] font-semibold text-brand">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <span
            aria-hidden
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-surface-soft bg-canvas px-6 py-5">
        {children}
      </div>
    </details>
  );
}
