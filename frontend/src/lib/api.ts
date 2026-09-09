/**
 * API client for the prospecting backend (FastAPI).
 *
 * Server components call these directly; the base URL comes from API_URL
 * (server) falling back to NEXT_PUBLIC_API_URL (shared with the browser
 * for outreach posts) and finally localhost.
 */
import type { IdentityTier } from "@/lib/audit";
import { TIER_LABELS, isLicenseGated } from "@/lib/tier";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  MatchEvidenceItem,
  OutreachEntry,
  ProfileSection,
  ScoreComponentItem,
  ScoreSnapshotItem,
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
  address_state: string | null;
  score: number;
  qualification_score: number;
  timing_score: number;
  rank: number;
  book_size: number;
  tier: Tier;
  license_status: string | null;
  signal_dates?: Record<string, string | null>;
  reason_summary: string | null;
  advisor_summary: string | null;
  summary_source: string | null;
  signal_types: string[];
  signal_strengths?: Record<string, number>;
  score_change: number | null;
  value_change?: number | null;
  timing_change?: number | null;
  score_change_note?: string | null;
  outreach_status: string | null;
  is_new: boolean;
  created_at: string;
  identity_tier: IdentityTier;
  identity_confidence: number;
  license_matched: boolean;
  has_name_only_events: boolean;
  weakest_link: {
    score: number;
    reason: string;
    source_a: string;
    source_b: string;
  } | null;
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
  field_changes: ApiFieldChange[];
  score_history: ApiScoreSnapshot[];
};

type ApiScoreSnapshot = {
  qualification_score: number;
  timing_score: number;
  total_score: number;
  recorded_at: string;
  note?: string | null;
};

type ApiFieldChange = {
  field: string;
  old_value: string | null;
  new_value: string | null;
  tier: "score" | "contact" | "identity";
  changed_at: string;
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
  urgency: "standard" | "elevated";
  rules: string[];
};

export type ContactKit = {
  name: string;
  addressLines: string[];
  addressComplete: boolean;
  phone: string | null;
  phoneNote: string;
  urgency: "standard" | "elevated";
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
    urgency: k.urgency,
  };
}

/* ── Mapping helpers ─────────────────────────────────────── */

/** The band and its name. The API stamps the band from the prospect's
 *  standing in the whole book; a gated licence overrides it with the reason. */
function tierOf(p: ApiRanked): { tier: Tier; label: string } {
  if (isLicenseGated(p.license_status))
    return { tier: "poor", label: `Not ranked — license ${p.license_status}` };
  const tier: Tier = p.tier ?? "poor";
  return { tier, label: TIER_LABELS[tier] };
}

function initialsOf(name: string): string {
  const parts = name
    .replace(/^Dr\.\s*/, "")
    .trim()
    .split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

const STATE_NAMES: Record<string, string> = { IL: "Illinois" };

function tenure(from: string | null): string {
  if (!from) return "—";
  const months = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    ),
  );
  if (months < 1) return "New";
  if (months < 12) return `${months} Month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} Year${years === 1 ? "" : "s"}`;
}

/** Advisor-facing name for each signal, in the order the detector lists them.
 *  Keep in step with SIGNAL_TYPES in app/scoring/detector.py. */
const SIGNAL_LABELS: [string, string][] = [
  ["PHYSICIAN", "Active license"],
  ["SPECIALTY", "Specialty tier"],
  ["NEW_LICENSE", "License date"],
  ["CAREER_STAGE", "Career stage"],
  ["CAREER_ADVANCEMENT", "Career move"],
  ["OWNERSHIP", "Practice ownership"],
  ["PROPERTY_EVENT", "Property purchase"],
];

/** How much of the board's evidence this score actually rests on.
 *
 *  A 62 built on three signals is not the same claim as a 62 built on five,
 *  and the score alone cannot say which. Bands follow the spread on the real
 *  board, where most prospects sit at three or four of seven. */
/** Rows whose wording changes with recency.
 *
 *  Holding a license date is evidence either way, so the tick — and the
 *  evidence count with it — stays put. What moves is the claim: a two-month
 *  registration earns "Newly licensed", a seventeen-year one is just a date
 *  we hold. Same age gate the trigger chip uses. */
const RECENCY_LABELS: Record<string, { fresh: string; stale: string }> = {
  NEW_LICENSE: { fresh: "Newly licensed", stale: "License date" },
};

/** "Recent" for a why-now chip: the event happened within a year. Under a
 *  half-life the strength alone cannot say this — a first licence issued
 *  today and a relocation two years ago both sit near 0.5 — so the board
 *  gates on the event's date instead. */
const RECENT_WITHIN_MONTHS = 12;

function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const months =
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return months >= 0 && months <= RECENT_WITHIN_MONTHS;
}

function labelFor(type: string, base: string, date: string | null | undefined) {
  const pair = RECENCY_LABELS[type];
  if (!pair) return base;
  return isRecent(date) ? pair.fresh : pair.stale;
}

function toEvidence(
  signalTypes: string[],
  dates: Record<string, string | null> = {},
): Candidate["evidence"] {
  const present = new Set(signalTypes);
  const found = SIGNAL_LABELS.filter(([type]) => present.has(type));
  const level: Candidate["evidence"]["level"] =
    found.length >= 5 ? "strong" : found.length === 4 ? "partial" : "thin";

  return {
    level,
    found: found.length,
    total: SIGNAL_LABELS.length,
    signals: SIGNAL_LABELS.map(([type, label]) => ({
      label: labelFor(type, label, dates[type]),
      present: present.has(type),
    })),
  };
}

/** The event worth calling about, rarest first.
 *
 *  Order matters: 132 of 219 prospects carry NEW_LICENSE, so leading with it
 *  would print the same chip on most of the board. Ownership (6) and property
 *  (9) are the ones that actually separate a row from its neighbors, so they
 *  win when a prospect has several. */
const TRIGGERS: { type: string; label: string; hint: string; hot?: boolean }[] =
  [
    {
      type: "OWNERSHIP",
      label: "Owns practice",
      // "New practice" and "went independent" both asserted a recent switch.
      // PECOS records who is paid today and carries no formation date, so we
      // cannot date this — see docs/OWNERSHIP_TENURE_BIAS.md.
      hint: "Bills Medicare under their own entity. Worth the most early in a career; the billing record carries no formation date, so it is discounted by years in practice.",
      hot: true,
    },
    {
      type: "PROPERTY_EVENT",
      label: "Bought a home",
      hint: "A recent property purchase on the county deed record. Money is moving.",
      hot: true,
    },
    {
      type: "CAREER_ADVANCEMENT",
      label: "Career move",
      hint: "Changed billing group — or formed their own practice — since the last sync.",
    },
    {
      type: "NEW_LICENSE",
      label: "New license",
      hint: "Recently licensed in Illinois — a relocation if they were already in practice, a first licence if not.",
    },
  ];

/** Signals that only mean something if they happened recently. A license is
 *  emitted for everyone who holds one, so presence alone would print "New
 *  license" on a seventeen-year-old registration. Gated on the event's age. */
const RECENCY_GATED = new Set(["NEW_LICENSE", "CAREER_ADVANCEMENT"]);

function toTrigger(
  signalTypes: string[],
  dates: Record<string, string | null> = {},
): Candidate["trigger"] {
  const present = new Set(signalTypes);
  const hit = TRIGGERS.find((t) => {
    if (!present.has(t.type)) return false;
    return !RECENCY_GATED.has(t.type) || isRecent(dates[t.type]);
  });
  return hit
    ? { label: hit.label, hint: hit.hint, hot: hit.hot ?? false }
    : null;
}

function toCandidate(p: ApiRanked, detail?: ApiDetail): Candidate {
  const { tier, label } = tierOf(p);
  // Latest event date per signal type — the detail has the rows, the board
  // gets the map on the ranked payload
  const dates: Record<string, string | null> = detail
    ? Object.fromEntries(
        detail.signals.map((sig) => [sig.signal_type, sig.event_date]),
      )
    : (p.signal_dates ?? {});
  const specialty = p.specialty ?? "Physician";
  // Prefer the practice address's own state; `p.state` is only the state we
  // searched, so pairing it with a city from elsewhere invents a place.
  const location = p.city
    ? `${p.city}, ${p.address_state ?? p.state ?? ""}`.replace(/, $/, "")
    : p.state
      ? `${STATE_NAMES[p.state] ?? p.state}, ${p.state}`
      : "Location unknown";

  // The board is indexed by the state we searched, so a location naming a
  // different one reads like an error unless the row says why it is here.
  // Only the disagreeing rows carry the note; the rest stay uncluttered.
  const licenseNote =
    p.state && p.address_state && p.address_state !== p.state
      ? `${p.state} license`
      : null;

  return {
    id: p.id,
    name: p.name,
    initials: initialsOf(p.name),
    specialty,
    category: specialty,
    location,
    licenseNote,
    score: p.score,
    tier,
    tierLabel: label,
    rank: p.rank ?? 0,
    bookSize: p.book_size ?? 0,
    licenseStatus: p.license_status ?? null,
    qualificationScore: p.qualification_score,
    timingScore: p.timing_score,
    licenseHeld: tenure(detail?.license_issue_date ?? null),
    // Ranked rows skip the summary — the detail fetch brings it when the
    // panel actually shows it, and the board sheds ~300KB of prose.
    summary: detail
      ? (p.advisor_summary ?? p.reason_summary ?? "No signals recorded yet.")
      : undefined,
    trigger: toTrigger(
      detail
        ? detail.signals.map((sig) => sig.signal_type)
        : (p.signal_types ?? []),
      dates,
    ),
    evidence: toEvidence(
      detail
        ? detail.signals.map((sig) => sig.signal_type)
        : (p.signal_types ?? []),
      dates,
    ),
    scoreChange: p.score_change ?? null,
    valueChange: p.value_change ?? null,
    timingChange: p.timing_change ?? null,
    scoreChangeNote: p.score_change_note ?? null,
    isNew: p.is_new ?? false,
    createdAt: p.created_at,
    identity: {
      identityTier: p.identity_tier ?? "single_source",
      identityConfidence: p.identity_confidence ?? 0,
      licenseMatched: p.license_matched ?? false,
      hasNameOnlyEvents: p.has_name_only_events ?? false,
      weakestLink: p.weakest_link
        ? {
            score: p.weakest_link.score,
            reason: p.weakest_link.reason,
            sourceA: p.weakest_link.source_a,
            sourceB: p.weakest_link.source_b,
          }
        : null,
    },
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not on record";
  // new Date("2026-08-05") parses as UTC midnight, which renders as the 4th in
  // any timezone behind UTC. Build from the parts so the calendar date the
  // backend recorded is the calendar date shown.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "Not on record";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
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
          label: "Active Medical License",
          value: active
            ? "Yes — Verified"
            : (d.license_status ?? "Not on record"),
          pill: active ? "positive" : "neutral",
        },
        { label: "License Issued", value: fmtDate(d.license_issue_date) },
        { label: "License Held", value: tenure(d.license_issue_date) },
        { label: "Speciality", value: d.specialty ?? "Unknown" },
        { label: "NPI Enumerated", value: fmtDate(d.enumeration_date) },
        {
          label: "Recent Advancement",
          value: career ? career.description : "None on record",
          pill: career ? "positive" : "neutral",
        },
        { label: "NPI", value: d.npi ?? "—" },
        { label: "License Number", value: d.license_number ?? "—" },
      ],
    },
    {
      title: "Ownership & Practice",
      accent: "var(--color-brand)",
      rows: [
        ...(ownership
          ? [
              {
                label: "Practice Entity",
                value: "Detected",
                pill: "positive" as const,
              },
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
          value: d.city
            ? `${d.city}, ${d.address_state ?? d.state ?? ""}`
            : "—",
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
            {
              label: "Property Purchase",
              value: "None on record",
              pill: "neutral",
            },
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
    ? `Identity verified across NPI + IL License — ${confidencePct}% match confidence`
    : `Single-source identity (${d.npi ? "NPI only" : "license only"}) — ${confidencePct}% confidence, not yet corroborated`;

  return {
    candidateId: d.id,
    status: active ? "Active" : "Unverified",
    address: fullAddress || location,
    identityLine,
    identityVerified: corroborated && d.identity_confidence >= 0.9,
    practice: `${d.specialty ?? "Physician"} — ${location}`,
    portrait: "",
    stats: [
      { label: "License Held", value: tenure(d.license_issue_date) },
      { label: "Value", value: `${d.qualification_score}` },
      { label: "Timing", value: `${d.timing_score}` },
      { label: "Priority", value: `${d.score}` },
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
  // Fresh by default; a caller that passes `next` opts that GET into the
  // data cache instead, and the two options must not be sent together.
  const defaults: RequestInit = init?.next ? {} : { cache: "no-store" };
  const res = await fetch(`${API_URL}${path}`, { ...defaults, ...init });
  if (!res.ok)
    throw new ApiError(
      res.status,
      `${init?.method ?? "GET"} ${path} → ${res.status}`,
    );
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// The API defaults to 50; ask for its maximum so the whole board shows.
const RANKED_PATH = "/prospects/ranked?limit=5000";

/** Cache tag for the ranked board — `revalidateBoard()` invalidates it
 *  after an ingest run or a logged outreach event. */
export const BOARD_TAG = "ranked-board";

/** The whole board. Cached in the data cache for a minute and shared by
 *  every page render (header count included), so clicking around never
 *  re-downloads it; mutations revalidate BOARD_TAG for instant freshness. */
function fetchRanked(): Promise<ApiRanked[]> {
  return api<ApiRanked[]>(RANKED_PATH, {
    next: { revalidate: 60, tags: [BOARD_TAG] },
  });
}

/** How many prospects are on the board — for the nav bar on every page.
 *  Deliberately never triggers ingestion, and never breaks the header when
 *  the API is down; it reads the same cached board fetch as the scoreboard,
 *  so this costs nothing. */
export async function fetchCandidateCount(): Promise<number | undefined> {
  try {
    const ranked = await fetchRanked();
    return ranked.length;
  } catch {
    return undefined;
  }
}

/** Ranked list; runs ingestion first if the database is empty. */
export async function fetchRankedCandidates(): Promise<Candidate[]> {
  let ranked = await fetchRanked();
  if (ranked.length === 0) {
    // wait=true: this bootstrap needs the data in hand for the refetch
    // below — everywhere else the sweep runs in the background.
    await api("/ingest/run?wait=true", { method: "POST" });
    // Bypass the cache here — the empty board was just cached for a minute,
    // and a render pass is not allowed to revalidate the tag itself.
    ranked = await api<ApiRanked[]>(RANKED_PATH);
  }
  return ranked.map((p) => toCandidate(p));
}

export async function fetchCandidateDetail(id: string): Promise<
  | {
      candidate: Candidate;
      profile: CandidateProfile;
      signals: SignalItem[];
      scoreComponents: ScoreComponentItem[];
      matches: MatchEvidenceItem[];
      identityConfidence: number;
      fieldChanges: FieldChangeItem[];
      scoreHistory: ScoreSnapshotItem[];
    }
  | undefined
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
      fieldChanges: (detail.field_changes ?? []).map((c) => ({
        field: c.field,
        oldValue: c.old_value,
        newValue: c.new_value,
        tier: c.tier,
        changedAt: c.changed_at,
      })),
      scoreHistory: (detail.score_history ?? []).map((s) => ({
        qualification: s.qualification_score,
        timing: s.timing_score,
        total: s.total_score,
        recordedAt: s.recorded_at,
        note: s.note ?? null,
      })),
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function fetchContactKit(
  id: string,
): Promise<ContactKit | undefined> {
  try {
    return toContactKit(
      await api<ApiContactKit>(`/prospects/${id}/contact-kit`),
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

type ApiOutreachEvent = {
  id: string;
  prospect_id: string;
  event_type: OutreachEntry["eventType"];
  channel: OutreachEntry["channel"];
  notes: string | null;
  occurred_at: string;
  follow_up_on: string | null;
};

export type IngestPhaseStatus =
  "pending" | "running" | "done" | "failed" | "skipped";

/** One step of the sweep checklist, as /ingest/status reports it. */
export type IngestPhase = {
  key: string;
  label: string;
  status: IngestPhaseStatus;
  /** Rows a source returned; prospects resolved for the merge step. */
  records: number | null;
  /** The error, on a failed step. */
  detail: string | null;
  created: number | null;
  updated: number | null;
  skipped: number | null;
  /** Re-scored prospects whose score came out different. */
  moved: number | null;
};

/** What the last recorded sweep found. Every field is null on runs that
 *  predate the report columns. */
export type SweepReport = {
  npiRecords: number | null;
  idfprRecords: number | null;
  pecosRecords: number | null;
  cookRecords: number | null;
  prospectsCreated: number | null;
  prospectsUpdated: number | null;
  prospectsResolved: number | null;
  prospectsSkipped: number | null;
  prospectsMoved: number | null;
  enrichmentRecords: number | null;
  enrichmentMatched: number | null;
  durationSeconds: number | null;
};

export type IngestStatus = {
  lastRunAt: string | null;
  nextSweepAt: string | null;
  prospectsCreated: number | null;
  prospectsUpdated: number | null;
  staleSummaries: number;
  /** A background sweep is in flight right now. */
  running: boolean;
  /** Why the last background sweep produced no run, if it failed. */
  lastError: string | null;
  /** Live checklist of the in-flight (or most recent) sweep; empty before
   *  the first one. */
  phases: IngestPhase[];
  startedAt: string | null;
  /** The last recorded run's report; null until a run exists. */
  lastSweep: SweepReport | null;
};

type IngestStatusWire = {
  last_run_at: string | null;
  next_sweep_at: string | null;
  prospects_created: number | null;
  prospects_updated: number | null;
  stale_summaries: number;
  running?: boolean;
  last_error?: string | null;
  phases?: IngestPhase[];
  started_at?: string | null;
  npi_records?: number | null;
  idfpr_records?: number | null;
  pecos_records?: number | null;
  cook_records?: number | null;
  prospects_resolved?: number | null;
  prospects_skipped?: number | null;
  prospects_moved?: number | null;
  enrichment_records?: number | null;
  enrichment_matched?: number | null;
  duration_seconds?: number | null;
};

/** Wire → app shape for /ingest/status. Shared by the server-rendered
 *  header and the client's poll so the two never drift. */
export function toIngestStatus(s: IngestStatusWire): IngestStatus {
  return {
    lastRunAt: s.last_run_at,
    nextSweepAt: s.next_sweep_at,
    prospectsCreated: s.prospects_created,
    prospectsUpdated: s.prospects_updated,
    staleSummaries: s.stale_summaries,
    running: s.running ?? false,
    lastError: s.last_error ?? null,
    phases: s.phases ?? [],
    startedAt: s.started_at ?? null,
    lastSweep: s.last_run_at
      ? {
          npiRecords: s.npi_records ?? null,
          idfprRecords: s.idfpr_records ?? null,
          pecosRecords: s.pecos_records ?? null,
          cookRecords: s.cook_records ?? null,
          prospectsCreated: s.prospects_created,
          prospectsUpdated: s.prospects_updated,
          prospectsResolved: s.prospects_resolved ?? null,
          prospectsSkipped: s.prospects_skipped ?? null,
          prospectsMoved: s.prospects_moved ?? null,
          enrichmentRecords: s.enrichment_records ?? null,
          enrichmentMatched: s.enrichment_matched ?? null,
          durationSeconds: s.duration_seconds ?? null,
        }
      : null,
  };
}

/** Latest ingest run + stale-summary count; null when the API is down. */
export async function fetchIngestStatus(): Promise<IngestStatus | null> {
  try {
    return toIngestStatus(await api<IngestStatusWire>("/ingest/status"));
  } catch {
    return null;
  }
}

/** Newest-first outreach log — powers the inline capture next to the
 *  contact kit. Missing prospect or a down API degrades to an empty log. */
export async function fetchOutreachHistory(
  id: string,
): Promise<OutreachEntry[]> {
  try {
    const rows = await api<ApiOutreachEvent[]>(`/prospects/${id}/outreach`);
    return rows.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      channel: e.channel,
      notes: e.notes,
      occurredAt: e.occurred_at,
      followUpOn: e.follow_up_on,
    }));
  } catch {
    return [];
  }
}
