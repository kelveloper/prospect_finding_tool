import CandidateDossier from "./CandidateDossier";
import ScoreSparkline from "./ScoreSparkline";
import SectionCard from "./SectionCard";
import ContactKitCard from "./ContactKitCard";
import Citation from "./Citation";
import EvidenceBadge from "./EvidenceBadge";
import type { ContactKit } from "@/lib/api";
import type {
  Candidate,
  CandidateProfile,
  FieldChangeItem,
  OutreachEntry,
  ScoreSnapshotItem,
  SignalItem,
} from "@/lib/data";
import { isLicenseGated, standingParts, tierStyle } from "@/lib/tier";
import { tidyParcel, tidyPlural } from "@/lib/text";

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
  /** The dossier is still in flight. The header already has real data from
   *  the ranked row, so only the body below it stands in. */
  loading?: boolean;
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
  loading = false,
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
    ? null
    : candidate.bookSize > 0
      ? standingParts(candidate.rank, candidate.bookSize)
      : rank && total
        ? standingParts(rank, total)
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
    /* The numbers sit in a rail, but only as far down as they reach — it
       floats rather than owning a column, so the header and the case for
       calling run beside it and everything below simply carries on at full
       width. A column all the way down turned the board into three of them,
       with the prospect list already holding the far right.
       Below lg it is not a rail at all; it stacks above the name.

       No cap on the composition. There was one, to stop the rail flying to
       the panel's edge and leaving a hole beside content that stopped at
       45rem — but the cards fill their column now, so they reach the float
       on their own and the hole cannot form. What the cap did instead was
       put 32px of gutter on the left and 68 on the right, because a capped
       block in a padded panel leaves all of its slack on one side. */
    <div>
      {/* ── The numbers, and nothing else. First in the DOM so the content
             after it can wrap around the float. ────────── */}
      {/* No box. A filled card puts a hard edge beside the why-now cards and
          invites the eye to line the two up — and they cannot be lined up:
          the rail's height is fixed by what it holds, the cards' height by
          how many triggers a prospect has, so any alignment is a
          coincidence that breaks on the next profile. Without the fill
          these are numbers set in the margin, and nothing is being measured
          against anything. */}
      <aside className="mb-5 border-hairline/60 pl-0 lg:float-right lg:mb-4 lg:ml-8 lg:w-[250px] lg:border-l lg:pl-5">
        {/* Standing leads. A reader meeting 60.9 cold cannot tell whether
            that is good — a reviewer said exactly that — but "#4 of 221"
            needs no explanation. Fit and evidence stay, as the line that
            supports it rather than three numbers competing. */}
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {gated ? (
            <p className="font-display text-[13px] font-semibold text-tier-poor">
              Not ranked — license {candidate.licenseStatus}
            </p>
          ) : standing ? (
            <>
              <p className="font-display text-[32px] font-bold leading-none tracking-[-0.6px] text-ink">
                #{standing.rank}
              </p>
              <p className="font-display text-[12px] font-bold tracking-[0.6px] text-brand">
                TOP {standing.pct}%
              </p>
            </>
          ) : null}
          <div className="mt-1.5 flex items-center gap-2 border-t border-hairline/60 pt-2">
            <span className="font-display text-[12px] font-semibold text-ink-faint">
              Fit {candidate.score}
            </span>
            <EvidenceBadge
              evidence={candidate.evidence}
              value={candidate.qualificationScore}
              timing={candidate.timingScore}
            />
          </div>

          {/* The trajectory belongs under the number it is the history of,
              not in a section of its own further down. Narrow, because a
              sparkline is a shape rather than a chart to read off — and it
              fits in the slack this column already had beside the name. */}
          {dossier && dossier.scoreHistory.length > 1 ? (
            <div className="mt-2 w-[230px] text-left">
              <ScoreSparkline
                history={dossier.scoreHistory}
                changes={dossier.fieldChanges}
              />
            </div>
          ) : null}
        </div>

        {/* Provenance belongs with the numbers it explains, not in a band
            of its own at the foot of the page. It only answers "how do you
            know?", so it is cited rather than offered as a button. */}
        <div className="mt-3 border-t border-hairline/60 pt-2.5">
          <p className="eyebrow mb-1">How we know</p>
          <Citation
            href={`/prospect/${candidate.id}/how-we-know`}
            label="The facts, and what each was worth"
          />
        </div>
      </aside>

      {/* ── WHO — name and identity. The block opens the record. ── */}
      <details className="group -mx-3 -mt-2">
        <summary
          title="Show the license, practice and property records behind this prospect"
          className="flex cursor-pointer list-none items-start justify-between gap-8 rounded-[12px] px-3 py-2 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden"
        >
          <div className="min-w-0">
            <p className="eyebrow">{candidate.category}</p>
            <Heading className="mt-0.5 font-display text-[28px] font-bold tracking-[-0.65px] text-ink">
              {candidate.name}
            </Heading>
            {/* The location is the practice address. On the rows where that
                sits outside the state we searched, say so here — otherwise
                the header reads like the wrong person. */}
            <p className="mt-0.5 text-[15px] text-ink-muted">
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
                <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
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

                  {/* The affordance for the whole block, not a control of its
                      own — it sits inside the summary, so the click is already
                      handled, and the name, the location and the pill all open
                      the records too.
                      Bordered, because a reader complained they could not find
                      it and the reason was never where it sat: a 13px link at
                      80% opacity, beside a filled pill of twice the visual
                      weight, loses on its own line as well. A border is what
                      makes a thing read as a control. */}
                  <span className="flex w-fit items-center gap-1.5 rounded-[8px] border border-hairline bg-white px-3 py-1.5 font-display text-[12.5px] font-semibold text-brand transition-colors group-hover:border-brand group-hover:bg-canvas">
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
                  </span>
                </p>
              </>
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
      {loading ? (
        <BodySkeleton Subheading={Subheading} />
      ) : (
        <WhyNow
          signals={signals}
          summary={candidate.summary}
          Subheading={Subheading}
        />
      )}

      {/* ── ACT — contact details and outcome capture in one block ── */}
      {!loading && contactKit ? (
        <ContactKitCard
          kit={contactKit}
          prospectId={candidate.id}
          outreach={outreach}
        />
      ) : null}

      {/* ── What changed, and how the score has moved ─── */}
      {loading ? null : dossier && profile ? (
        <CandidateDossier fieldChanges={dossier.fieldChanges} />
      ) : (
        <p className="mt-8 rounded-[12px] bg-canvas px-4 py-4 text-[13px] text-ink-muted">
          The full dossier for this prospect could not be loaded — the ranked
          summary above is all the API returned.
        </p>
      )}
    </div>
  );
}

/** A found signal, set as a fact with its meaning under it.
 *
 *  Most descriptions already carry both, separated by an em dash or a
 *  trailing parenthetical — "Illinois license issued this month —
 *  established physician, new to Illinois". Splitting them is what lets the
 *  fact be loud and the meaning quiet, instead of one grey line doing both.
 */
function splitSignal(raw: string): [string, string | null] {
  const description = tidyParcel(tidyPlural(raw));
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
  Subheading,
}: {
  signals?: SignalItem[];
  summary?: string;
  Subheading: "h2" | "h3";
}) {
  const found = signals ?? [];
  const events = found.filter((s) => s.eventDate);
  const standing = found.filter((s) => !s.eventDate);
  const insight = lastClause(summary);

  // Nothing found: the paragraph is all there is, so it carries the section.
  if (found.length === 0)
    return (
      <section>
        <Subheading className="section-title mb-2.5">
          Why This Prospect, Now
        </Subheading>
        <p className="max-w-[680px] text-[15px] leading-[24px] text-ink-muted">
          {summary}
        </p>
      </section>
    );

  return (
    <>
      {events.length > 0 ? (
        <section>
          <Subheading className="section-title mb-3">Why now</Subheading>
          {/* flow-root, because a float only moves text out of its way. A
              block keeps its full width and runs underneath, so the card's
              background slid beneath the rail while its words wrapped
              correctly — the one arrangement that looks like a z-index bug
              and is not. Its own formatting context makes the box respect
              the float the same way the text already did. */}
          {/* No reading cap: a card is scanned, not read, so it takes the
              width it is given — which is what makes its right edge line up
              with the rule the heading draws to the float. The ticks below
              keep the cap, because those are lines of text. */}
          <ul className="flow-root space-y-2">
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
        </section>
      ) : null}

      {standing.length > 0 ? (
        <section className="mt-6">
          <Subheading className="section-title mb-3">Why them</Subheading>
          {/* One column. Two of them orphaned the last tick on 39 of 40
              prospects — the standing signals are almost always three — so
              the layout was ragged on essentially every profile to save a
              row the page no longer needs. */}
          <ul className="max-w-[45rem] space-y-2">
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
          {/* Only the judgement survives. Every fact the paragraph used to
              recite is now printed above it in larger type, so what is left
              is the one thing the bullets cannot say. */}
          {insight ? (
            <p className="mt-3 max-w-[620px] border-l-2 border-hairline pl-3 text-[14px] leading-[21px] text-ink-muted">
              {insight}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/** The part of the summary the bullets above it do not already say.
 *
 *  The paragraph was written when it was the only place the case lived, so
 *  it opens by reciting the specialty, the licence date and the years in
 *  practice — all of which are now printed above it, larger. What it adds is
 *  the interpretation it closes on, and that is worth keeping.
 */
function lastClause(summary?: string): string | null {
  if (!summary) return null;
  const parts = summary.split(" — ");
  const tail = (parts.length > 1 ? parts[parts.length - 1] : summary).trim();
  // Only trade the whole paragraph for its tail when the tail is a sentence
  // in its own right; otherwise keep what we were given.
  if (parts.length > 1 && tail.split(" ").length >= 5) {
    // The tail was a clause, so it often opens on the conjunction that
    // joined it — "and relocations are when…" reads as a fragment once the
    // first half is gone.
    const lead = tail.replace(/^(and|but|so|which|because)\s+/i, "");
    return lead.charAt(0).toUpperCase() + lead.slice(1);
  }
  return summary;
}

/** What the body looks like while the dossier is in flight.
 *
 *  Not a spinner. The fetch takes 125–170ms, which is long enough to notice
 *  and short enough that a spinner is itself a flash — and a spinner would
 *  not fix the actual complaint, which is that the sections render at zero
 *  height and then shove everything down. Bars of roughly the right size
 *  hold the page still, so what arrives replaces something the same shape.
 */
function BodySkeleton({ Subheading }: { Subheading: "h2" | "h3" }) {
  const bar = "rounded-[6px] bg-canvas";
  return (
    <div aria-hidden className="animate-pulse">
      <section>
        <Subheading className="section-title mb-3">Why now</Subheading>
        <div className={`${bar} h-[72px]`} />
      </section>
      <section className="mt-7">
        <Subheading className="section-title mb-3">Why them</Subheading>
        <div className="max-w-[45rem] space-y-2.5">
          <div className={`${bar} h-4 w-[62%]`} />
          <div className={`${bar} h-4 w-[74%]`} />
          <div className={`${bar} h-4 w-[68%]`} />
        </div>
      </section>
      <section className="mt-7">
        <Subheading className="section-title mb-3">Do this next</Subheading>
        <div className={`${bar} h-[118px]`} />
      </section>
      <span className="sr-only">Loading this prospect</span>
    </div>
  );
}
