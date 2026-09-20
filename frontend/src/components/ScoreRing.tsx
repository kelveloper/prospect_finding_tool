type Props = {
  score: number;
  /** Outer diameter in px. */
  size: number;
  stroke: number;
  accent: string;
  /** Text under the number, e.g. "Fit". Omitted on the compact rings.
   *
   *  A bare noun under a number is read as a verdict about the person, not as
   *  the name of a measure — "Priority" over a 28.8 claimed the opposite of
   *  what the 28.8 says. "Fit" is what the book's own column calls this, so
   *  the two views agree and neither reads as a promise. */
  caption?: string;
  valueSize?: number;
};

/**
 * Circular progress dial. The track is a full circle; the value arc is drawn
 * with a dash offset and rotated so it starts at 12 o'clock, matching Figma.
 */
export default function ScoreRing({
  score,
  size,
  stroke,
  accent,
  caption,
  valueSize,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (Math.min(Math.max(score, 0), 100) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Fit ${score}`}
      // The dial was the one place the number had no name: the caption was
      // dropped as redundant (see CandidateCard), which left a figure in a
      // circle and nothing saying what it measured — a screen reader got
      // "Fit 62.4" from the label above while a sighted reader got neither
      // the word nor anything to hover, because the card's own tooltip owns
      // that hover everywhere else. This is the inner element, so it wins.
      title={`Fit ${score} — value × how fresh the trigger is. The board is ranked by this.`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold text-ink leading-none"
          style={{ fontSize: valueSize ?? Math.round(size * 0.24) }}
        >
          {score}
        </span>
        {caption ? (
          <span className="mt-1 font-display text-[10px] font-semibold uppercase tracking-[1px] text-ink-faint">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}
