/**
 * Identity audit — an operator's view of how good the evidence holding
 * each profile together is. Off by default and remembered per browser;
 * with it off the board renders exactly as it does for an advisor.
 *
 * Hidden, not protected: this app has no accounts, so the toggle is a
 * courtesy to advisors who should never see merge mechanics, not a wall.
 *
 * The tiers come from the API (app/identity/audit.py) — the weakest merge
 * in a profile's cluster decides it. This file only names, colours, counts
 * and filters them.
 */
import { useSyncExternalStore } from "react";

export type IdentityTier = "certain" | "strong" | "barely" | "single_source";

export type WeakestLink = {
  score: number;
  reason: string;
  sourceA: string;
  sourceB: string;
};

export type IdentityAudit = {
  identityTier: IdentityTier;
  identityConfidence: number;
  /** Any merge on a licence number — the strongest key there is. */
  licenseMatched: boolean;
  /** Any event (a deed) pinned to the profile by name alone, at 0.9. */
  hasNameOnlyEvents: boolean;
  /** The minimum-score match — why a profile is only "barely". */
  weakestLink: WeakestLink | null;
};

export const TIER_ORDER: IdentityTier[] = [
  "certain",
  "strong",
  "barely",
  "single_source",
];

export const TIER_META: Record<
  IdentityTier,
  { label: string; badge: string; mark: string; tone: string; hint: string }
> = {
  certain: {
    label: "Certain",
    badge: "licence",
    mark: "●",
    tone: "bg-tier-strong-bg text-tier-strong-fg",
    hint: "Held together by a unique identifier — a licence-number or NPI merge.",
  },
  strong: {
    label: "Strong",
    badge: "name",
    mark: "●",
    tone: "bg-surface-tint text-brand-dark",
    hint: "Exact name and state corroborated across sources.",
  },
  barely: {
    label: "Barely",
    badge: "barely",
    mark: "◐",
    tone: "bg-tier-neutral-bg text-tier-neutral-fg",
    hint: "Cleared the 0.80 merge threshold without certainty.",
  },
  single_source: {
    label: "Single-source",
    badge: "single-source",
    mark: "○",
    tone: "bg-surface-soft text-ink-muted",
    hint: "One source, never corroborated — it never faced the judge.",
  },
};

/** The tiers an operator should double-check before an advisor calls. */
export function isWeakIdentity(c: IdentityAudit): boolean {
  return c.identityTier === "barely" || c.identityTier === "single_source";
}

export type AuditFilter =
  "all" | IdentityTier | "weak" | "not_licensed" | "name_only";

export const AUDIT_CHIPS: { key: AuditFilter; label: string; hint: string }[] =
  [
    { key: "all", label: "All", hint: "Every prospect, whatever the evidence" },
    ...TIER_ORDER.map((t) => ({
      key: t as AuditFilter,
      label: TIER_META[t].label,
      hint: TIER_META[t].hint,
    })),
    // Two flags are deliberately not chips. "Not licence-matched" is
    // always the union of Strong, Barely and Single-source, which the
    // tier chips already say. "Name-only events" is exactly the set of
    // cards tagged "Bought a home" — every deed is matched by name — so
    // the Why-now filter on the board covers it. The API keeps both.
  ];

export function matchesAuditFilter(c: IdentityAudit, f: AuditFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "weak":
      return isWeakIdentity(c);
    case "not_licensed":
      return !c.licenseMatched;
    case "name_only":
      return c.hasNameOnlyEvents;
    default:
      return c.identityTier === f;
  }
}

export function auditCounts(
  list: IdentityAudit[],
): Record<AuditFilter, number> {
  const counts: Record<AuditFilter, number> = {
    all: list.length,
    certain: 0,
    strong: 0,
    barely: 0,
    single_source: 0,
    weak: 0,
    not_licensed: 0,
    name_only: 0,
  };
  for (const c of list) {
    counts[c.identityTier]++;
    if (isWeakIdentity(c)) counts.weak++;
    if (!c.licenseMatched) counts.not_licensed++;
    if (c.hasNameOnlyEvents) counts.name_only++;
  }
  return counts;
}

/** "796 certain · 383 single-source" — tiers with anyone in them. */
export function describeTiers(counts: Record<AuditFilter, number>): string {
  return TIER_ORDER.filter((t) => counts[t] > 0)
    .map((t) => `${counts[t]} ${TIER_META[t].label.toLowerCase()}`)
    .join(" · ");
}

/** One line for a badge's hover: the tier, the confidence, and the
 *  weakest link's stored reason verbatim. */
export function describeIdentity(c: IdentityAudit): string {
  const meta = TIER_META[c.identityTier];
  const parts = [
    `${meta.label} identity · confidence ${c.identityConfidence.toFixed(2)}. ${meta.hint}`,
  ];
  if (c.weakestLink) {
    parts.push(
      `Weakest link ${c.weakestLink.score.toFixed(2)} — ${c.weakestLink.reason} (${c.weakestLink.sourceA} ↔ ${c.weakestLink.sourceB}).`,
    );
  }
  if (c.hasNameOnlyEvents)
    parts.push(
      "Its home purchase was matched by name alone — deeds carry no licence or NPI.",
    );
  return parts.join(" ");
}

/* ── The switch ───────────────────────────────────────────
   Same shape as the saved-views store: localStorage does not exist on the
   server, so the server snapshot is "off" and the client corrects itself
   after hydration without a mismatch. */

const KEY = "prospectiq_identity_audit";
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): boolean {
  if (cached === null) cached = read();
  return cached;
}

function getServerSnapshot(): boolean {
  return false;
}

export function setAuditMode(on: boolean): void {
  cached = on;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Private browsing can refuse storage; the switch still holds for
    // this page.
  }
  listeners.forEach((fn) => fn());
}

export function useAuditMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
