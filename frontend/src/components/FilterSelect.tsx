"use client";

/** One labelled filter control: "Specialty: Orthopaedic Surgery · 84".
 *
 *  The label sits inside the box rather than above it, so a row of these
 *  keeps one clean top edge and each control still says what it filters
 *  without the open menu repeating the word on every option.
 *
 *  Matches the board's "Why now" select deliberately — the two layouts
 *  should answer the same question with the same control. */
export default function FilterSelect({
  label,
  value,
  options,
  onValue,
  title,
  format = (v) => v,
}: {
  /** Written once, inside the control, and always visible. */
  label: string;
  value: string;
  /** "all" first; the rest already in the order they should be read. */
  options: { value: string; count: number }[];
  onValue: (value: string) => void;
  title?: string;
  /** How a raw value is spelled for a reader — tier keys, mostly. */
  format?: (value: string) => string;
}) {
  return (
    // The border lives on the wrapper, not the select, so the label can sit
    // inside it as a real flex child. Reserving room for it with padding
    // instead means guessing its width from its character count — which
    // collides the moment a label is set in a different face to the value,
    // as "Why now" did.
    <div className="relative flex min-w-[188px] flex-1 items-center rounded-[8px] border border-hairline bg-white pl-2.5 focus-within:border-brand">
      <span
        aria-hidden
        // Sentence case, not the eyebrow's caps: set in caps it reads as a
        // system tag stamped on the control rather than the question the
        // advisor is actually asking. The colon carries it into the value,
        // so the closed control reads as one phrase.
        className="pointer-events-none shrink-0 text-[12px] text-ink-faint"
      >
        {label}:
      </span>
      <select
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-label={`Filter by ${label.toLowerCase()}`}
        title={title}
        // appearance-none so the chevron below is the only one; the native
        // arrow differs on every platform.
        className="w-full min-w-0 appearance-none bg-transparent py-1.5 pl-1.5 pr-7 font-display text-[12px] font-semibold text-ink focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === "all" ? "Any" : format(option.value)} ·{" "}
            {option.count}
          </option>
        ))}
      </select>
      {/* An SVG, not a ▾ glyph — that character carries so much of its own
          whitespace that it reads as a speck at this size. */}
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted"
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
