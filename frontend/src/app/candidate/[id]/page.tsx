import Link from "next/link";
import { notFound } from "next/navigation";
import ContactKitCard from "@/components/ContactKitCard";
import Header from "@/components/Header";
import ScoreBreakdownCard from "@/components/ScoreBreakdownCard";
import SectionCard from "@/components/SectionCard";
import { InfoIcon, ShuffleIcon, PinIcon } from "@/components/icons";
import { fetchCandidateDetail, fetchContactKit } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, contactKit] = await Promise.all([
    fetchCandidateDetail(id),
    fetchContactKit(id),
  ]);
  if (!detail) notFound();
  const { candidate, profile, scoreComponents } = detail;

  return (
    <div className="min-h-screen pb-12">
      <Header
        crumbs={[{ label: "Candidate Profile" }]}
        back={{ label: "Back to Scoreboard", href: "/" }}
      />

      <div className="mx-auto max-w-[1124px] px-8 py-8">
        {/* ── Portrait + overview ────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[290px_minmax(0,1fr)]">
          <div className="relative h-[265px] overflow-hidden rounded-[16px] bg-gradient-to-b from-brand-light to-brand shadow-card">
            <span className="absolute inset-0 flex items-center justify-center font-display text-[64px] font-bold text-white/80">
              {candidate.initials}
            </span>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-4 pt-10">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.55px] text-white backdrop-blur-sm">
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      profile.status === "Active"
                        ? "var(--color-tier-strong)"
                        : "var(--color-tier-neutral)",
                  }}
                />
                {profile.status}
              </span>
              <p className="font-display text-[16px] font-bold text-white">{candidate.name}</p>
              <p className="text-[12px] text-white/75">{candidate.specialty}</p>
            </div>
          </div>

          <div className="rounded-[16px] bg-white p-6 shadow-card">
            <p className="eyebrow">Candidate Overview</p>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-[-0.6px] text-ink">
              {candidate.name}
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">{candidate.specialty}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-muted">
              <PinIcon className="size-4 shrink-0 text-tier-poor" />
              {profile.address}
            </p>

            {/* Trust line: how sure we are these records are the same person */}
            <p className="mt-3">
              <span
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold " +
                  (profile.identityVerified
                    ? "bg-tier-strong-bg text-tier-strong-fg"
                    : "bg-tier-neutral-bg text-tier-neutral-fg")
                }
              >
                {profile.identityVerified ? "✓" : "◌"} {profile.identityLine}
              </span>
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {profile.stats.map((stat) => (
                <div key={stat.label} className="rounded-[12px] bg-canvas px-4 py-3">
                  <p className="eyebrow">{stat.label}</p>
                  <p className="mt-1 font-display text-[16px] font-semibold text-ink">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <p className="eyebrow">Why This Score</p>
              <p className="mt-1 text-[14px] leading-[22px] text-ink-muted">
                {candidate.summary}
              </p>
            </div>
          </div>
        </div>

        {/* ── Dossier ────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {profile.sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
          {contactKit && <ContactKitCard kit={contactKit} />}
          <ScoreBreakdownCard
            qualificationScore={candidate.qualificationScore}
            timingScore={candidate.timingScore}
            totalScore={candidate.score}
            components={scoreComponents}
          />
        </div>

        {/* ── Actions ────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            href={`/candidate/${candidate.id}/follow-up`}
            className="flex items-center justify-center gap-2 rounded-[8px] bg-brand px-6 py-3.5 font-display text-[14px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark"
          >
            <InfoIcon className="size-4" />
            Review & Give Feedback
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-[8px] border border-hairline bg-white px-6 py-3.5 font-display text-[14px] font-semibold text-brand transition-colors hover:bg-surface-soft"
          >
            <ShuffleIcon className="size-4" />
            Back to Scoreboard
          </Link>
        </div>
      </div>
    </div>
  );
}
