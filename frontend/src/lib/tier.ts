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

/** Standing on the board. Rounded up so rank 1 of 194 is "top 1%", never
 *  "top 0%". Reads as a decision where a raw score reads as a grade. */
export function percentileOf(rank: number, total: number): number {
  return Math.max(1, Math.ceil((rank / total) * 100));
}
