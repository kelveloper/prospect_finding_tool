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
  ProfileSection,
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
};

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

function toProfile(d: ApiDetail): CandidateProfile {
  const active = (d.license_status ?? "").toUpperCase() === "ACTIVE";
  const corroborated = Boolean(d.npi && d.license_number);

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
      ],
    },
    {
      title: "Identity Resolution",
      accent: "var(--color-brand-light)",
      rows: [
        {
          label: "Sources Corroborated",
          value: corroborated ? "NPI + IL Licence" : "Single Source",
          pill: corroborated ? "positive" : "neutral",
        },
        {
          label: "Identity Confidence",
          value: `${Math.round(d.identity_confidence * 100)}%`,
          pill: d.identity_confidence >= 0.9 ? "positive" : "neutral",
        },
        { label: "NPI", value: d.npi ?? "—" },
        { label: "Licence Number", value: d.license_number ?? "—" },
      ],
    },
    {
      title: "Score Breakdown",
      accent: "var(--color-brand)",
      rows: [
        { label: "Qualification (60%)", value: `${d.qualification_score} / 100` },
        { label: "Timing (40%)", value: `${d.timing_score} / 100` },
        { label: "Total Score", value: `${d.score} / 100`, pill: "positive" },
      ],
    },
    {
      title: "Practice Location",
      accent: "var(--color-tier-neutral)",
      rows: [
        { label: "Address", value: d.address_line ?? "Not on record" },
        { label: "City", value: d.city ?? "Not on record" },
        { label: "State", value: d.address_state ?? d.state ?? "—" },
        { label: "ZIP", value: d.zip_code ?? "—" },
        { label: "Phone", value: d.phone ?? "Not on record" },
      ],
    },
    {
      title: "Detected Signals",
      accent: "var(--color-tier-weak)",
      rows: d.signals
        .slice()
        .sort((a, b) => b.strength - a.strength)
        .map((s) => ({
          label: `${s.signal_type.replaceAll("_", " ")} (${s.source.toUpperCase()})`,
          value: `${Math.round(s.strength * 100)}% strength`,
        })),
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
  return {
    candidateId: d.id,
    status: active ? "Active" : "Unverified",
    address: fullAddress || location,
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
  { candidate: Candidate; profile: CandidateProfile; signals: SignalItem[] } | undefined
> {
  try {
    const detail = await api<ApiDetail>(`/prospects/${id}`);
    return {
      candidate: toCandidate(detail, detail),
      profile: toProfile(detail),
      signals: toSignalItems(detail),
    };
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
