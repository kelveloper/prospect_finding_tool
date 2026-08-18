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
