/** Source of truth for the "Info origin" page — every external claim the
 *  app relies on, either for a live data pull or for a rule in the scoring
 *  engine.
 *
 *  Sources we do NOT use do not belong here. The paid vendors (Cobalt,
 *  ATTOM, Propelus) were listed on this page once; they answer "where could
 *  this come from later", which is a roadmap question, not a provenance
 *  one — and on a page of sources, a reader has to stop and work out that
 *  they are not in use. They live in docs/RESEARCH_COMMERCIAL_SOURCES.md.
 *
 *  Each entry carries two layers. `summary` is the claim in one line and is
 *  what the page shows; `proves` is the full argument and stays folded away
 *  until someone asks for it. The page was a wall of paragraphs before that
 *  split — nobody reads a reference page start to finish, they scan it for
 *  the one source they came to check.
 *
 *  One entry is flagged: a 2026-09-14 recheck found the citation used for it
 *  names the wrong organization and overstates its own scope, so it's shown
 *  separately and marked unverified rather than published as settled proof. */

export type Citation = {
  id: string;
  label: string;
  url: string;
  /** The scan layer: the claim in one line, under ~60 characters. This is
   *  what the page shows by default. */
  summary: string;
  /** The depth layer: the full argument, shown only when opened. */
  proves: string;
  sourceFile?: string;
  flagReason?: string;
};

export type CitationGroup = {
  title: string;
  /** One short line. The chip and the item summaries carry the rest. */
  intro: string;
  /** Rendered as a chip beside the heading, so the group's kind is legible
   *  without reading the intro at all. */
  status: "live" | "limitation" | "research";
  items: Citation[];
};

export const CITATION_GROUPS: CitationGroup[] = [
  {
    title: "Live sources",
    status: "live",
    intro: "Every prospect is built from these. Nothing is scraped or estimated.",
    items: [
      {
        id: "nppes",
        summary: "Identity, specialty, licence number, practice address.",
        label: "NPPES · NPI Registry",
        url: "https://npiregistry.cms.hhs.gov/api/",
        proves:
          "Proves a physician's identity, specialty, license number, and practice address. The one required source — no NPI row, no prospect.",
        sourceFile: "app/adapters/npi/live.py",
      },
      {
        id: "idfpr",
        summary: "The Illinois licence is real, active and dated.",
        label: "Illinois IDFPR license roster",
        url: "https://data.illinois.gov/resource/pzzh-kp68.json",
        proves:
          "Proves an Illinois medical license is real, active, and dates it — the basis for the timing score's \"newly licensed\" points.",
        sourceFile: "app/adapters/idfpr/live.py",
      },
      {
        id: "pecos",
        summary: "Who they bill Medicare under — employee or owner.",
        label: "CMS PECOS · Group Practice Reassignment",
        url: "https://data.cms.gov/provider-data/dataset/27ea-46a8",
        proves:
          "Proves who a physician bills Medicare under — how the system infers whether she's the employee or the employer.",
        sourceFile: "app/adapters/pecos/client.py",
      },
      {
        id: "cook-county",
        summary: "A real property purchase, and when it happened.",
        label: "Cook County Assessor Parcel Sales",
        url: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json",
        proves:
          "Proves a real property purchase — the \"financial event\" that drives the timing score's strongest trigger.",
        sourceFile: "app/adapters/cook_county/live.py",
      },
    ],
  },
  {
    title: "Why Medicare isn't proof on its own",
    status: "limitation",
    intro: "Coverage isn't flat across specialties.",
    items: [
      {
        id: "kff-opt-out",
        summary: "About 98% of physicians take Medicare.",
        label: "KFF · How many physicians have opted out of Medicare",
        url: "https://www.kff.org/medicare/how-many-physicians-have-opted-out-of-the-medicare-program/",
        proves:
          "Proves overall Medicare participation runs about 98%, with opt-out concentrated in specific specialties (psychiatry, plastic surgery).",
      },
      {
        id: "jmir-dermatology",
        summary: "Dermatology's own opt-out rate is about 1.8%.",
        label: "JMIR Dermatology · opt-out trends among dermatologists",
        url: "https://derma.jmir.org/2022/4/e42345",
        proves:
          "Proves dermatology's own opt-out rate (about 1.8%) — the specialty at the center of the specialty-coverage question raised in review.",
      },
      {
        id: "cms-lcd-cosmetic",
        summary: "Cosmetic work is excluded from Medicare outright.",
        label: "CMS coverage policy · LCD L39506, cosmetic and reconstructive surgery",
        url: "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=39506&ver=3",
        proves:
          "Proves cosmetic procedures are statutorily excluded from Medicare coverage for every participating physician — the actual mechanism behind the cosmetic-specialty gap, not opt-out.",
      },
    ],
  },
  {
    title: "Research behind the Value score",
    status: "research",
    intro: "The specialty wealth-tier table, re-verified 2026-09-14.",
    items: [
      {
        id: "medscape-wealth-tiers",
        summary: "Net worth over $5M, by specialty.",
        label: "Becker's Hospital Review · physician net worth above $5M, by specialty",
        url: "https://www.beckershospitalreview.com/compensation-issues/physician-net-worth-above-5m-by-specialty/",
        proves:
          "Proves the specialty wealth-tier table's top row: radiology and orthopaedics tied at 39% net worth $5M+, cardiology 35%, anesthesiology 31%, plastic surgery 29% — quoting Medscape's Physician Wealth & Debt Report 2026 directly, and matching the code's scaled values almost exactly.",
        sourceFile: "app/scoring/detector.py",
      },
    ],
  },
];

/** A citation already embedded in the scoring code that did not hold up on
 *  a 2026-09-14 recheck — shown, but marked unverified rather than
 *  presented as settled proof. */
export const FLAGGED_CITATIONS: Citation[] = [
  {
    id: "acp-two-thirds",
    summary: "Claimed: most established physicians already have an advisor.",
    label: "ACP Physicians' Financial Preparedness Report (2021)",
    url: "https://www.acponline.org/sites/default/files/documents/practice-resources/physician-wellbeing/acp_physicians_financial_preparedness_report.october2021.pdf",
    proves:
      "Cited as the source for \"two thirds of physicians 17+ years in already have an advisor,\" which sets the upper edge of the career-stage scoring window.",
    sourceFile: "docs/RANKING.md",
    flagReason:
      "Two problems, not one. The report is real and does say two-thirds — but of over 450 female internists specifically, not physicians generally, so the code's claim overstates its scope. And the URL originally cited for this, acpadvisors.org, is a different organization entirely (the American College of Physician Advisors, a hospital utilization-review group) — this entry now points to the correct publisher, the American College of Physicians. Either find a source that covers physicians generally, or narrow the ranking rationale to what this report actually shows.",
  },
];
