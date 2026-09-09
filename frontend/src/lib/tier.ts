import type { Tier } from "./data";

type TierStyle = {
  /** Ring stroke + progress fill. */
  accent: string;
  badgeBg: string;
  badgeFg: string;
};

const STYLES: Record<Tier, TierStyle> = {
  strong: {
    accent: "var(--color-tier-strong)",
    badgeBg: "var(--color-tier-strong-bg)",
    badgeFg: "var(--color-tier-strong-fg)",
  },
  promising: {
    accent: "var(--color-tier-promising)",
    badgeBg: "var(--color-tier-promising-bg)",
    badgeFg: "var(--color-tier-promising-fg)",
  },
  neutral: {
    accent: "var(--color-tier-neutral)",
    badgeBg: "var(--color-tier-neutral-bg)",
    badgeFg: "var(--color-tier-neutral-fg)",
  },
  weak: {
    accent: "var(--color-tier-weak)",
    badgeBg: "var(--color-tier-weak-bg)",
    badgeFg: "var(--color-tier-weak-fg)",
  },
  poor: {
    accent: "var(--color-tier-poor)",
    badgeBg: "var(--color-tier-poor-bg)",
    badgeFg: "var(--color-tier-poor-fg)",
  },
};

export function tierStyle(tier: Tier) {
  return STYLES[tier];
}

/** The band's name. Bands come from standing in the book, not a score cut:
 *  top 5% strong, next 15% promising, next 30% neutral, next 30% weak. */
export const TIER_LABELS: Record<Tier, string> = {
  strong: "Top Prospect",
  promising: "Promising Prospect",
  neutral: "Neutral Prospect",
  weak: "Weak Prospect",
  poor: "Poor Fit",
};

/** "#4 of 1,179 · Top 1%" — where this prospect stands among everyone ranked. */
export function standingLabel(rank: number, bookSize: number): string {
  if (rank < 1 || bookSize < 1) return "Not ranked";
  const pct = Math.max(1, Math.ceil((rank / bookSize) * 100));
  return `#${rank} of ${bookSize.toLocaleString()} · Top ${pct}%`;
}

/** Is this licence status one the gate refuses? Mirrors app/scoring/engine.py. */
export function isLicenseGated(status: string | null | undefined): boolean {
  if (!status || !status.trim()) return false;
  return !status.trim().toUpperCase().startsWith("ACTIVE");
}
