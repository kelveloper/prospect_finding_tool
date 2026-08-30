import Link from "next/link";

/** A way into the reasoning behind the board, weighted like a citation.
 *
 *  Signal evidence and the scoring model both answer "how do you know?" —
 *  a question a busy advisor never asks and a sceptical one always does. So
 *  they get a footnote's prominence: small, muted, dotted underline, sitting
 *  under the claim rather than competing with the next action. */
export default function Citation({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1 text-[12px] text-ink-muted underline decoration-dotted decoration-from-font underline-offset-[3px] transition-colors hover:text-brand " +
        className
      }
    >
      <span
        aria-hidden
        className="font-display text-[10px] font-bold text-ink-faint"
      >
        ⌗
      </span>
      {label}
    </Link>
  );
}
