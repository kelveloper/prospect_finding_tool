/**
 * API client for the prospecting backend (FastAPI).
 *
 * Server components call these directly; the base URL comes from API_URL
 * (server) falling back to NEXT_PUBLIC_API_URL (shared with the browser
 * for feedback posts) and finally localhost.
 */
import type {
  Candidate,
  CandidateProfile,
  FeedbackEntry,
  MatchEvidenceItem,
  ProfileSection,
  ScoreComponentItem,
  SignalItem,
  Tier,
} from "./data";

export const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

/* ── Backend response shapes ─────────────────────────────── */

type ApiRanked = {
  id: string;
  name: string;
  specialty: string | null;
  state: string | null;
  city: string | null;
  score: number;
  qualification_score: number;
  timing_score: number;
  reason_summary: string | null;
  signal_types: string[];
};

type ApiSignal = {
  signal_type: string;
  source: string;
  description: string;
  strength: number;
  event_date: string | null;
  confidence: number;
};

type ApiDetail = ApiRanked & {
  profession: string;
  npi: string | null;
  enumeration_date: string | null;
  license_number: string | null;
  license_issue_date: string | null;
  license_status: string | null;
  address_line: string | null;
  address_state: string | null;
  zip_code: string | null;
  phone: string | null;
  identity_confidence: number;
  signals: ApiSignal[];
  score_components: ApiScoreComponent[];
  identity_matches: ApiIdentityMatch[];
};

type ApiIdentityMatch = {
  source_a: string;
  source_b: string;
  score: number;
  reason: string;
};

type ApiScoreComponent = {
  category: "qualification" | "timing";
  label: string;
  signal_type: string;
  max_points: number;
  strength: number;
  points: number;
};

type ApiContactKit = {
  prospect_id: string;
  name: string;
  mail: {
    address_line: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    complete: boolean;
  };
  phone: { number: string | null; note: string };
  primary_trigger: {
    signal_type: string;
    description: string;
    event_date: string | null;
  } | null;
  letter: { salutation: string; body: string };
  urgency: "standard" | "elevated";
  rules: string[];
};

export type ContactKit = {
  name: string;
  addressLines: string[];
  addressComplete: boolean;
  phone: string | null;
  phoneNote: string;
  trigger: { label: string; description: string; eventDate: string | null } | null;
  letter: { salutation: string; body: string };
  urgency: "standard" | "elevated";
  rules: string[];
};

const TRIGGER_LABELS: Record<string, string> = {
  OWNERSHIP: "New practice entity",
  CAREER_ADVANCEMENT: "Career move",
  NEW_LICENSE: "Newly licensed",
};

function toContactKit(k: ApiContactKit): ContactKit {
  const cityLine = [k.mail.city, k.mail.state].filter(Boolean).join(", ");
  return {
    name: k.name,
    addressLines: [
      k.mail.address_line,
      [cityLine, k.mail.zip_code].filter(Boolean).join(" "),
    ].filter((line): line is string => Boolean(line)),
    addressComplete: k.mail.complete,
    phone: k.phone.number,
    phoneNote: k.phone.note,
    trigger: k.primary_trigger
      ? {
          label:
            TRIGGER_LABELS[k.primary_trigger.signal_type] ??
            k.primary_trigger.signal_type,
          description: k.primary_trigger.description,
          eventDate: k.primary_trigger.event_date,
        }
      : null,
    letter: k.letter,
    urgency: k.urgency,
    rules: k.rules,
  };
}

type ApiFeedback = {
  id: string;
  prospect_id: string;
  verdict: FeedbackEntry["verdict"];
  notes: string | null;
  created_at: string;
};

/* ── Mapping helpers ─────────────────────────────────────── */

export function tierFromScore(score: number): { tier: Tier; label: string } {
  if (score >= 80) return { tier: "strong", label: "Top Prospect" };
  if (score >= 60) return { tier: "promising", label: "Promising Prospect" };
  if (score >= 50) return { tier: "neutral", label: "Neutral Prospect" };
  if (score >= 35) return { tier: "weak", label: "Weak Prospect" };
  return { tier: "poor", label: "Poor Fit" };
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

const STATE_NAMES: Record<string, string> = { IL: "Illinois" };

function tenure(from: string | null): string {
  if (!from) return "—";
  const months = Math.max(
    0,
    Math.floor((Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  if (months < 1) return "New";
  if (months < 12) return `${months} Month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} Year${years === 1 ? "" : "s"}`;
}

function strengthWord(qualification: number): string {
  return qualification >= 80 ? "High" : qualification >= 55 ? "Medium" : "Low";
}

// The three dossier categories and the signal types that feed each one
const CATEGORY_SIGNALS: { label: string; types: string[] }[] = [
  {
    label: "Profession",
    types: ["PHYSICIAN", "SPECIALTY", "NEW_LICENSE", "CAREER_ADVANCEMENT"],
  },
  { label: "Ownership", types: ["OWNERSHIP"] },
  { label: "Financial", types: ["PROPERTY_EVENT"] },
];

function toCategories(signalTypes: string[]): Candidate["categories"] {
  const present = new Set(signalTypes);
  return CATEGORY_SIGNALS.map(({ label, types }) => ({
    label,
    captured: types.filter((t) => present.has(t)).length,
    total: types.length,
  }));
}

function toCandidate(p: ApiRanked, detail?: ApiDetail): Candidate {
  const { tier, label } = tierFromScore(p.score);
  const specialty = p.specialty ?? "Physician";
  const location = p.city
    ? `${p.city}, ${p.state ?? ""}`.replace(/, $/, "")
    : p.state
      ? `${STATE_NAMES[p.state] ?? p.state}, ${p.state}`
      : "Location unknown";

  const tags: string[] = [];
  if (detail) {
    if ((detail.license_status ?? "").toUpperCase() === "ACTIVE") tags.push("Active Licence");
    if (detail.signals.some((s) => s.signal_type === "NEW_LICENSE" && s.strength >= 0.85))
      tags.push("Recently Licensed");
    if (detail.signals.some((s) => s.signal_type === "SPECIALTY" && s.strength >= 0.75))
      tags.push("High-Earning Specialty");
    if (detail.signals.some((s) => s.signal_type === "OWNERSHIP"))
      tags.push("Practice Owner");
    if (detail.signals.some((s) => s.signal_type === "PROPERTY_EVENT" && s.strength >= 0.6))
      tags.push("Recent Property Purchase");
    if (detail.signals.some((s) => s.signal_type === "CAREER_ADVANCEMENT" && s.strength >= 0.5))
      tags.push("Career Advancement");
    if (detail.identity_confidence >= 0.9) tags.push("Identity Verified");
    if (detail.npi && !detail.license_number) tags.push("Licence Unverified");
  } else {
    if (p.qualification_score >= 80) tags.push("Well Qualified");
    if (p.timing_score >= 70) tags.push("Strong Timing");
  }

  return {
    id: p.id,
    name: p.name,
    initials: initialsOf(p.name),
    specialty,
    practiceLine: `${specialty} — ${location}`,
    category: specialty,
    location,
    score: p.score,
    tier,
    tierLabel: label,
    qualificationScore: p.qualification_score,
    timingScore: p.timing_score,
    licenceHeld: tenure(detail?.license_issue_date ?? null),
    strength: strengthWord(p.qualification_score),
    summary: p.reason_summary ?? "No signals recorded yet.",
    tags,
    categories: toCategories(
      detail ? detail.signals.map((s) => s.signal_type) : p.signal_types ?? [],
    ),
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not on record";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toScoreComponents(d: ApiDetail): ScoreComponentItem[] {
  return (d.score_components ?? []).map((c) => ({
    category: c.category,
    label: c.label,
    strength: c.strength,
    points: c.points,
    maxPoints: c.max_points,
  }));
}

function toProfile(d: ApiDetail): CandidateProfile {
  const active = (d.license_status ?? "").toUpperCase() === "ACTIVE";
  const corroborated = Boolean(d.npi && d.license_number);

  const strongest = (type: string): ApiSignal | undefined =>
    d.signals
      .filter((s) => s.signal_type === type)
      .sort((a, b) => b.strength - a.strength)[0];
  const ownership = strongest("OWNERSHIP");
  const property = strongest("PROPERTY_EVENT");
  const career = strongest("CAREER_ADVANCEMENT");

  const sections: ProfileSection[] = [
    {
      title: "Career Signal",
      accent: "var(--color-tier-strong)",
      rows: [
        {
          label: "Active Medical Licence",
          value: active ? "Yes — Verified" : (d.license_status ?? "Not on record"),
          pill: active ? "positive" : "neutral",
        },
        { label: "Licence Issued", value: fmtDate(d.license_issue_date) },
        { label: "Licence Held", value: tenure(d.license_issue_date) },
        { label: "Speciality", value: d.specialty ?? "Unknown" },
        { label: "NPI Enumerated", value: fmtDate(d.enumeration_date) },
        {
          label: "Recent Advancement",
          value: career ? career.description : "None on record",
          pill: career ? "positive" : "neutral",
        },
        { label: "NPI", value: d.npi ?? "—" },
        { label: "Licence Number", value: d.license_number ?? "—" },
      ],
    },
    {
      title: "Ownership & Practice",
      accent: "var(--color-brand)",
      rows: [
        ...(ownership
          ? [
              { label: "Practice Entity", value: "Detected", pill: "positive" as const },
              { label: "Detail", value: ownership.description },
              { label: "Entity Formed", value: fmtDate(ownership.event_date) },
              {
                label: "Signal Strength",
                value: `${Math.round(ownership.strength * 100)}% (${ownership.source.toUpperCase()})`,
              },
            ]
          : [
              {
                label: "Practice Entity",
                value: "None on record",
                pill: "neutral" as const,
              },
            ]),
        {
          label: "Practice Address (NPI)",
          value: d.address_line ?? "Not on record",
        },
        {
          label: "City",
          value: d.city ? `${d.city}, ${d.address_state ?? d.state ?? ""}` : "—",
        },
        { label: "Phone", value: d.phone ?? "Not on record" },
      ],
    },
    {
      title: "Financial Activity",
      accent: "var(--color-tier-strong)",
      rows: property
        ? [
            { label: "Property Purchase", value: "Detected", pill: "positive" },
            { label: "Detail", value: property.description },
            { label: "Purchase Date", value: fmtDate(property.event_date) },
            { label: "Source", value: property.source.toUpperCase() },
            {
              label: "Signal Strength",
              value: `${Math.round(property.strength * 100)}%`,
            },
          ]
        : [
            { label: "Property Purchase", value: "None on record", pill: "neutral" },
            {
              label: "What this means",
              value: "No recent deed transfer found for this person",
            },
          ],
    },
  ];

  const location = d.city
    ? `${d.city}, ${d.address_state ?? d.state ?? ""}`.replace(/, $/, "")
    : d.state
      ? `${STATE_NAMES[d.state] ?? d.state}, ${d.state}`
      : "Unknown";
  const fullAddress = [d.address_line, location, d.zip_code]
    .filter(Boolean)
    .join(", ");
  const confidencePct = Math.round(d.identity_confidence * 100);
  const identityLine = corroborated
    ? `Identity verified across NPI + IL Licence — ${confidencePct}% match confidence`
    : `Single-source identity (${d.npi ? "NPI only" : "licence only"}) — ${confidencePct}% confidence, not yet corroborated`;

  return {
    candidateId: d.id,
    status: active ? "Active" : "Unverified",
    address: fullAddress || location,
    identityLine,
    identityVerified: corroborated && d.identity_confidence >= 0.9,
    practice: `${d.specialty ?? "Physician"} — ${location}`,
    portrait: "",
    stats: [
      { label: "Licence Held", value: tenure(d.license_issue_date) },
      { label: "Qualification", value: `${d.qualification_score}` },
      { label: "Timing", value: `${d.timing_score}` },
    ],
    sections,
  };
}

function toSignalItems(d: ApiDetail): SignalItem[] {
  return d.signals
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .map((s) => ({
      type: s.signal_type,
      source: s.source,
      description: s.description,
      strength: s.strength,
      confidence: s.confidence,
      eventDate: s.event_date,
    }));
}

/* ── Fetchers ────────────────────────────────────────────── */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Ranked list; runs ingestion first if the database is empty. */
export async function fetchRankedCandidates(): Promise<Candidate[]> {
  let ranked = await api<ApiRanked[]>("/prospects/ranked");
  if (ranked.length === 0) {
    await api("/ingest/run", { method: "POST" });
    ranked = await api<ApiRanked[]>("/prospects/ranked");
  }
  return ranked.map((p) => toCandidate(p));
}

export async function fetchCandidateDetail(id: string): Promise<
  {
    candidate: Candidate;
    profile: CandidateProfile;
    signals: SignalItem[];
    scoreComponents: ScoreComponentItem[];
    matches: MatchEvidenceItem[];
    identityConfidence: number;
  } | undefined
> {
  try {
    const detail = await api<ApiDetail>(`/prospects/${id}`);
    return {
      candidate: toCandidate(detail, detail),
      profile: toProfile(detail),
      signals: toSignalItems(detail),
      scoreComponents: toScoreComponents(detail),
      matches: (detail.identity_matches ?? []).map((m) => ({
        sourceA: m.source_a,
        sourceB: m.source_b,
        score: m.score,
        reason: m.reason,
      })),
      identityConfidence: detail.identity_confidence,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function fetchContactKit(id: string): Promise<ContactKit | undefined> {
  try {
    return toContactKit(await api<ApiContactKit>(`/prospects/${id}/contact-kit`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function fetchFeedbackHistory(id: string): Promise<FeedbackEntry[]> {
  const rows = await api<ApiFeedback[]>(`/prospects/${id}/feedback`);
  return rows.map((f) => ({
    id: f.id,
    verdict: f.verdict,
    notes: f.notes,
    createdAt: f.created_at,
  }));
}
