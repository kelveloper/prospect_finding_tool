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

export type SignalItem = {
  type: string;
  source: string;
  description: string;
  strength: number;
  confidence: number;
  eventDate: string | null;
};

export type FeedbackEntry = {
  id: string;
  verdict: "good_fit" | "revisit_later" | "not_fit";
  notes: string | null;
  createdAt: string;
};

const now = new Date();
export const PERIOD = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
export const VIEWER_INITIALS = "AD";
