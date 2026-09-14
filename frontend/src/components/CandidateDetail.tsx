import CandidateDossier from "./CandidateDossier";
import SectionCard from "./SectionCard";
import ContactKitCard from "./ContactKitCard";
import Citation from "./Citation";
import EvidenceBadge from "./EvidenceBadge";
import ScoreRing from "./ScoreRing";
import type { ContactKit } from "@/lib/api";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  OutreachEntry,
  ScoreSnapshotItem,
  SignalItem,
} from "@/lib/data";
import { isLicenseGated, standingLabel, tierStyle } from "@/lib/tier";

type Props = {
  candidate: Candidate;
  profile?: CandidateProfile;
  /** History cards; omitted when the detail call failed. */
  dossier?: {
    fieldChanges: FieldChangeItem[];
    scoreHistory: ScoreSnapshotItem[];
  };
  contactKit?: ContactKit;
  /** What we actually found on this person, strongest first. These are the
   *  case for calling, so they are printed rather than left to the records. */
  signals?: SignalItem[];
  /** Logged outcomes, shown under the outreach buttons. */
  outreach?: OutreachEntry[];
  /** Where this prospect sits in the whole book. "61.6" means nothing
   *  alone; "#1 · Top 1%" is the actual pitch. */
  rank?: number;
  total?: number;
  /** 1 on the board, where the name titles the page; 2 in the slide-over,
   *  which sits under the book's own heading. */
  headingLevel?: 1 | 2;
};

/** Everything the scoreboard knows about one prospect: who they are, the
 *  score in context, why they matter now, how to reach them, what happened
 *  when you did, and the full dossier. Shared by the board's fixed panel
 *  and the book's slide-over, which differ only in how much room they
 *  have. */
export default function CandidateDetail({
  candidate,
  profile,
  dossier,
  contactKit,
  signals,
  outreach,
  rank,
  total,
  headingLevel = 1,
}: Props) {
  const style = tierStyle(candidate.tier);
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const Subheading = headingLevel === 2 ? "h3" : "h2";
  // Standing among everyone *ranked* — the API stamps it, so a filtered or
  // gated view never renumbers anyone. The page's own rank/total is the
  // fallback for lists that predate the stamp.
  const gated = isLicenseGated(candidate.licenseStatus);
  const standing = gated
    ? `Not ranked — license ${candidate.licenseStatus}`
    : candidate.bookSize > 0
      ? standingLabel(candidate.rank, candidate.bookSize)
      : rank && total
        ? standingLabel(rank, total)
        : null;

  // The record itself, rendered inside the trust line's disclosure.
  const dossierRecord = profile ? (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {profile.sections.map((section) => (
        <SectionCard key={section.title} section={section} />
      ))}
    </div>
  ) : null;

  return (
    <>
      {/* ── WHO — name, identity, score. The whole block opens the record. ── */}
      <details className="group -mx-3 -mt-2">
        <summary
          title="Show the license, practice and property records behind this prospect"
          className="flex cursor-pointer list-none items-start justify-between gap-8 rounded-[12px] px-3 py-2 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden"
        >
          <div className="min-w-0">
            <p className="eyebrow">{candidate.category}</p>
            <Heading className="mt-1 font-display text-[30px] font-bold tracking-[-0.75px] text-ink">
              {candidate.name}
            </Heading>
            {/* The location is the practice address. On the rows where that
                sits outside the state we searched, say so here — otherwise
                the header reads like the wrong person. */}
            <p className="mt-1 text-[16px] text-ink-muted">
              {candidate.location}
              {candidate.licenseNote ? (
                <span className="text-ink-faint">
                  {" · "}
                  {candidate.licenseNote}
                </span>
              ) : null}
            </p>

            {/* Trust line: how sure we are these records are one person. */}
            {profile ? (
              <>
                <p className="mt-3">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold " +
                      (profile.identityVerified
                        ? "bg-tier-strong-bg text-tier-strong-fg"
                        : "bg-tier-neutral-bg text-tier-neutral-fg")
                    }
                  >
                    {profile.identityVerified ? "✓" : "◌"}{" "}
                    {profile.identityLine}
                  </span>
                </p>

                {/* The affordance for the whole block, not a control of its own —
                  it sits inside the summary, so the click is already handled.
                  On its own line under the pill so it reads as the invitation
                  to open the record rather than a second badge. */}
                <p className="mt-3 mb-1 flex w-fit items-center gap-1.5 font-display text-[13px] font-semibold text-brand opacity-80 transition-opacity group-hover:opacity-100">
                  <span className="group-open:hidden">See the records</span>
                  <span className="hidden group-open:inline">
                    Hide the records
                  </span>
                  <span
                    aria-hidden
                    className="text-[10px] transition-transform group-open:rotate-180"
                  >
                    ▼
                  </span>
                </p>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2.5">
            <ScoreRing
              score={candidate.score}
              size={112}
              stroke={8}
              accent={style.accent}
              caption="Fit"
              valueSize={24}
            />
            <EvidenceBadge
              evidence={candidate.evidence}
              value={candidate.qualificationScore}
              timing={candidate.timingScore}
            />
            {standing !== null ? (
              <p
                className={
                  "font-display text-[12px] font-semibold " +
                  (gated ? "text-tier-poor" : "text-ink-muted")
                }
              >
                {standing}
              </p>
            ) : null}
          </div>
        </summary>

        {dossierRecord ? (
          <div className="px-3 pt-5">{dossierRecord}</div>
        ) : null}
      </details>

      <hr className="my-4 border-surface-soft" />

      {/* ── WHY NOW — the case for calling, printed rather than narrated ──
          This used to be the paragraph alone. A reviewer read the page and
          said the three things that stood out were the score, the address
          and the phone — and that the address and phone were not what he
          needed first. The findings were all in the prose, which is the one
          thing nobody reads before deciding. So the findings lead now and
          the paragraph supports them. */}
      <section>
        <Subheading className="eyebrow">Why This Prospect, Now</Subheading>
        <WhyNow signals={signals} summary={candidate.summary} />
      </section>

      {/* ── ACT — contact details and outcome capture in one block ── */}
      {contactKit ? (
        <ContactKitCard
          kit={contactKit}
          prospectId={candidate.id}
          outreach={outreach}
        />
      ) : null}

      {/* ── What changed, and how the score has moved ─── */}
      {dossier && profile ? (
        <CandidateDossier
          fieldChanges={dossier.fieldChanges}
          scoreHistory={dossier.scoreHistory}
        />
      ) : (
        <p className="mt-8 rounded-[12px] bg-canvas px-4 py-4 text-[13px] text-ink-muted">
          The full dossier for this prospect could not be loaded — the ranked
          summary above is all the API returned.
        </p>
      )}

      {/* The advisor's actual next step — call, write, log the outcome —
          lives in the Reach Out block above. This only answers "how do you
          know?", so it is cited, not offered as a button. */}
      <div className="sources-note mt-5 border-t border-surface-soft pt-3">
        <p className="eyebrow">How we know</p>
        <div className="mt-2">
          <Citation
            href={`/prospect/${candidate.id}/how-we-know`}
            label="The facts, how we matched them, and what each was worth"
          />
        </div>
      </div>
    </>
  );
}

/** A found signal, set as a fact with its meaning under it.
 *
 *  Most descriptions already carry both, separated by an em dash or a
 *  trailing parenthetical — "Illinois license issued this month —
 *  established physician, new to Illinois". Splitting them is what lets the
 *  fact be loud and the meaning quiet, instead of one grey line doing both.
 */
/** Stored signal copy pluralises as "6 year(s)" — unremarkable in a log,
 *  wrong in bold at the top of a profile. The generator no longer writes it
 *  (see _plural in app/scoring/detector.py), but descriptions are written at
 *  ingest, so every prospect already in the book still carries the old
 *  wording. Tidied on the way out rather than by re-running a sweep. */
function tidyPlural(text: string): string {
  return text.replace(
    /\b(\d+)\s+([A-Za-z]+)\(s\)/g,
    (_m, n: string, unit: string) =>
      `${n} ${unit}${Number(n) === 1 ? "" : "s"}`,
  );
}

function splitSignal(raw: string): [string, string | null] {
  const description = tidyPlural(raw);
  const paren = /^(.*?)\s*\(([^)]+)\)\s*$/;
  const dash = description.split(" — ");
  if (dash.length > 1) {
    const fact = dash[0];
    const meaning = dash.slice(1).join(" — ");
    // "In practice 6 years (NPI enumerated 2020) — peak accumulation years".
    // Where the fact still trails a parenthetical it is provenance, not the
    // fact: it belongs with the quiet half rather than set in bold.
    const m = fact.match(paren);
    return m ? [m[1], `${meaning} · ${m[2]}`] : [fact, meaning];
  }
  const m = description.match(paren);
  if (m) return [m[1], m[2]];
  return [description, null];
}

function fmtSignalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The case for calling this person, in the order an advisor needs it.
 *
 *  Split by whether a signal carries a date, because that is exactly the
 *  difference between "why now" and "why them" — a licence issued last month
 *  is the news; being an orthopaedic surgeon is the standing fact. The split
 *  is the data's own, not a list of types kept in step by hand. */
function WhyNow({
  signals,
  summary,
}: {
  signals?: SignalItem[];
  summary?: string;
}) {
  const found = signals ?? [];
  const events = found.filter((s) => s.eventDate);
  const standing = found.filter((s) => !s.eventDate);

  // Nothing found: the paragraph is all there is, so it carries the section.
  if (found.length === 0)
    return (
      <p className="mt-2 max-w-[680px] text-[15px] leading-[24px] text-ink-muted">
        {summary}
      </p>
    );

  return (
    <>
      {events.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {events.map((signal) => {
            const [fact, meaning] = splitSignal(signal.description);
            return (
              <li
                key={signal.type}
                className="rounded-[12px] border border-hairline bg-surface-soft px-4 py-3"
              >
                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-display text-[16px] font-bold text-ink">
                    {fact}
                  </span>
                  {signal.eventDate ? (
                    <span className="font-display text-[12px] font-semibold text-brand">
                      {fmtSignalDate(signal.eventDate)}
                    </span>
                  ) : null}
                </p>
                {meaning ? (
                  <p className="mt-0.5 text-[14px] leading-[20px] text-ink-muted">
                    {meaning}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {standing.length > 0 ? (
        <ul className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {standing.map((signal) => {
            const [fact, meaning] = splitSignal(signal.description);
            return (
              <li key={signal.type} className="flex items-baseline gap-2">
                <span aria-hidden className="text-[12px] text-tier-strong-fg">
                  ✓
                </span>
                <span className="min-w-0 text-[14px] leading-[20px]">
                  <span className="font-display font-semibold text-ink">
                    {fact}
                  </span>
                  {meaning ? (
                    <span className="text-ink-muted"> — {meaning}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary ? (
        <p className="mt-3 max-w-[680px] text-[14px] leading-[22px] text-ink-muted">
          {summary}
        </p>
      ) : null}
    </>
  );
}
