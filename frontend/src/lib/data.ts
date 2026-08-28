export type Tier = "strong" | "promising" | "neutral" | "weak" | "poor";

export type Candidate = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  /** Longer form shown on the scoreboard detail panel. */
  practiceLine: string;
  category: string;
  location: string;
  score: number;
  tier: Tier;
  tierLabel: string;
  qualificationScore: number;
  timingScore: number;
  /** Human-readable licence tenure, e.g. "8 Months" — "—" when unknown. */
  licenceHeld: string;
  strength: string;
  summary: string;
  tags: string[];
  /** Signal coverage per category — the scoreboard quick overview. */
  categories: { label: string; captured: number; total: number }[];
  /** Points moved since the previous ingest; null until two snapshots exist. */
  scoreChange: number | null;
  isNew: boolean;
};

export type ProfileRow = {
  label: string;
  value: string;
  /** Renders the value as a pill instead of plain text. */
  pill?: "positive" | "neutral";
};

export type ProfileSection = {
  title: string;
  accent: string;
  rows: ProfileRow[];
};

export type CandidateProfile = {
  candidateId: string;
  status: string;
  address: string;
  practice: string;
  portrait: string;
  /** Plain-English trust line, e.g. "Identity verified across NPI + IL Licence — 100% match confidence" */
  identityLine: string;
  /** True when 2+ independent sources corroborated this person */
  identityVerified: boolean;
  stats: { label: string; value: string }[];
  sections: ProfileSection[];
};

export type ScoreSnapshotItem = {
  qualification: number;
  timing: number;
  total: number;
  recordedAt: string;
};

export type FieldChangeItem = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  tier: "score" | "contact" | "identity";
  changedAt: string;
};

export type MatchEvidenceItem = {
  sourceA: string;
  sourceB: string;
  score: number;
  reason: string;
};

export type ScoreComponentItem = {
  category: "qualification" | "timing";
  label: string;
  /** Signal strength 0–1 — recency decay, specialty tier, entity type. */
  strength: number;
  points: number;
  maxPoints: number;
};

export type SignalItem = {
  type: string;
  source: string;
  description: string;
  strength: number;
  confidence: number;
  eventDate: string | null;
};

export type OutreachEntry = {
  id: string;
  eventType:
    | "connected"
    | "not_connected"
    | "follow_up_later"
    | "converted"
    | "not_converted";
  channel: "mail" | "phone" | "email" | "other" | null;
  notes: string | null;
  occurredAt: string;
  followUpOn: string | null;
};

const now = new Date();
export const PERIOD = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
export const VIEWER_INITIALS = "AD";
/** Seven-digit id for the signed-in advisor, shown in the nav bar. */
export const VIEWER_SID = "4820193";
