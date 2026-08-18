import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  bg: string;
  fg: string;
  /** Uppercase micro-label (list badges) vs. sentence case (pills). */
  variant?: "caps" | "plain";
};

export default function Badge({ children, bg, fg, variant = "caps" }: Props) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2 py-[2px] font-display font-semibold " +
        (variant === "caps"
          ? "text-[11px] uppercase tracking-[0.55px]"
          : "text-[12px] tracking-[0.2px]")
      }
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}
