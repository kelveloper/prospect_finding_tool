/** Source of truth for the "Info origin" page — every external claim the
 *  app relies on, either for a live data pull or for a rule in the scoring
 *  engine, with one sentence on what it proves. One entry is flagged: a
 *  2026-09-14 recheck found the citation used for it names the wrong
 *  organization and overstates its own scope, so it's shown separately and
 *  marked unverified rather than published as settled proof. */

export type Citation = {
  id: string;
  label: string;
  url: string;
  proves: string;
  sourceFile?: string;
  flagReason?: string;
};

export type CitationGroup = {
  title: string;
  intro: string;
  items: Citation[];
};

export const CITATION_GROUPS: CitationGroup[] = [
  {
    title: "Live sources — what the pipeline actually queries",
    intro:
      "Every prospect on the board is built from these four public feeds. Nothing here is scraped or estimated.",
    items: [
      {
        id: "nppes",
        label: "NPPES · NPI Registry",
        url: "https://npiregistry.cms.hhs.gov/api/",
        proves:
          "Proves a physician's identity, specialty, license number, and practice address. The one required source — no NPI row, no prospect.",
        sourceFile: "app/adapters/npi/live.py",
      },
      {
        id: "idfpr",
        label: "Illinois IDFPR license roster",
        url: "https://data.illinois.gov/resource/pzzh-kp68.json",
        proves:
          "Proves an Illinois medical license is real, active, and dates it — the basis for the timing score's \"newly licensed\" points.",
        sourceFile: "app/adapters/idfpr/live.py",
      },
      {
        id: "pecos",
        label: "CMS PECOS · Group Practice Reassignment",
        url: "https://data.cms.gov/provider-data/dataset/27ea-46a8",
        proves:
          "Proves who a physician bills Medicare under — how the system infers whether she's the employee or the employer.",
        sourceFile: "app/adapters/pecos/client.py",
      },
      {
        id: "cook-county",
        label: "Cook County Assessor Parcel Sales",
        url: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json",
        proves:
          "Proves a real property purchase — the \"financial event\" that drives the timing score's strongest trigger.",
        sourceFile: "app/adapters/cook_county/live.py",
      },
    ],
  },
  {
    title: "Why Medicare/PECOS isn't treated as a universal signal",
    intro:
      "Medicare billing tells us whether someone is an employee or an owner, but coverage isn't flat across specialties. This is why it's scored as one signal among several, not proof on its own.",
    items: [
      {
        id: "kff-opt-out",
        label: "KFF · How many physicians have opted out of Medicare",
        url: "https://www.kff.org/medicare/how-many-physicians-have-opted-out-of-the-medicare-program/",
        proves:
          "Proves overall Medicare participation runs about 98%, with opt-out concentrated in specific specialties (psychiatry, plastic surgery).",
      },
      {
        id: "jmir-dermatology",
        label: "JMIR Dermatology · opt-out trends among dermatologists",
        url: "https://derma.jmir.org/2022/4/e42345",
        proves:
          "Proves dermatology's own opt-out rate (about 1.8%) — the specialty at the center of the specialty-coverage question raised in review.",
      },
      {
        id: "cms-lcd-cosmetic",
        label: "CMS coverage policy · LCD L39506, cosmetic and reconstructive surgery",
        url: "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=39506&ver=3",
        proves:
          "Proves cosmetic procedures are statutorily excluded from Medicare coverage for every participating physician — the actual mechanism behind the cosmetic-specialty gap, not opt-out.",
      },
    ],
  },
  {
    title: "Vendors researched for the future-implementations roadmap",
    intro:
      "Paid sources the team has priced and, in Cobalt's case, already validated — not live in the pipeline today.",
    items: [
      {
        id: "cobalt",
        label: "Cobalt Intelligence",
        url: "https://cobaltintelligence.com/",
        proves:
          "Proves a paid, person-name-searchable business-registry lookup exists — the fix for ownership-dating and the cosmetic-specialty gap.",
        sourceFile: "docs/RESEARCH_COMMERCIAL_SOURCES.md",
      },
      {
        id: "attom",
        label: "ATTOM property data",
        url: "https://www.attomdata.com/data/transactions-mortgage-data/",
        proves:
          "Proves a paid nationwide property feed exists to extend the deed/timing signal beyond Cook County.",
        sourceFile: "docs/RESEARCH_COMMERCIAL_SOURCES.md",
      },
      {
        id: "propelus",
        label: "Propelus",
        url: "https://propelus.com/api",
        proves:
          "Proves a paid, all-56-jurisdiction license verification API exists to extend past Illinois-only licensing.",
        sourceFile: "docs/RESEARCH_COMMERCIAL_SOURCES.md",
      },
    ],
  },
  {
    title: "Research backing the Value score's rules",
    intro:
      "Where the specialty wealth-tier table actually comes from — re-verified 2026-09-14 against a fresh search, not just the code comment.",
    items: [
      {
        id: "medscape-wealth-tiers",
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
    label: "ACP Physicians' Financial Preparedness Report (2021)",
    url: "https://www.acponline.org/sites/default/files/documents/practice-resources/physician-wellbeing/acp_physicians_financial_preparedness_report.october2021.pdf",
    proves:
      "Cited as the source for \"two thirds of physicians 17+ years in already have an advisor,\" which sets the upper edge of the career-stage scoring window.",
    sourceFile: "docs/RANKING.md",
    flagReason:
      "Two problems, not one. The report is real and does say two-thirds — but of over 450 female internists specifically, not physicians generally, so the code's claim overstates its scope. And the URL originally cited for this, acpadvisors.org, is a different organization entirely (the American College of Physician Advisors, a hospital utilization-review group) — this entry now points to the correct publisher, the American College of Physicians. Either find a source that covers physicians generally, or narrow the ranking rationale to what this report actually shows.",
  },
];
