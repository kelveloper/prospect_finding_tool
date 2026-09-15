/** Source of truth for the "Info origin" page — every external claim the
 *  app relies on, either for a live data pull or for a rule in the scoring
 *  engine, with one sentence on what it proves. Two entries are flagged:
 *  found on a 2026-09-14 recheck to not cleanly match the number the code
 *  currently cites, so they're shown separately and marked "unverified"
 *  rather than published as settled proof. */

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
];

/** Citations already embedded in the scoring code that did not hold up
 *  cleanly on a 2026-09-14 recheck — shown, but marked unverified rather
 *  than presented as settled proof. */
export const FLAGGED_CITATIONS: Citation[] = [
  {
    id: "medscape-wealth-tiers",
    label: "Medscape Physician Wealth & Debt Report",
    url: "https://www.medscape.com/p11/medscape-physician-wealth-debt-report-2026-rising-net-worth-2026a10009up",
    proves:
      "Cited as the source for the specialty wealth-tier table (radiology and orthopaedics at the top, 39%).",
    sourceFile: "app/scoring/detector.py",
    flagReason:
      "Medscape republishes this report yearly at a new URL, and the current edition's numbers (urology, gastroenterology, and radiology near a third) don't line up with the 39% figure in the code. Confirm which report year the current table came from before citing it, or update the table to the current report.",
  },
  {
    id: "acp-two-thirds",
    label: "ACP Physicians' Financial Preparedness Report",
    url: "https://www.acpadvisors.org/",
    proves:
      "Cited as the source for \"two thirds of physicians 17+ years in already have an advisor,\" which sets the upper edge of the career-stage scoring window.",
    sourceFile: "docs/RANKING.md",
    flagReason:
      "The specific report found (2021) surveyed over 450 female internists, not physicians generally. Either find the exact source originally used, or narrow the claim to match what this survey actually shows.",
  },
];
