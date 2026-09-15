# Citations — source of truth for a "View info origin" page

Every claim the app makes about a prospect, or about why the ranking works
the way it does, traces back to one of these. Format below is meant to be
lifted directly into a frontend list: a label, a link, and one sentence on
what it proves. Solid citations first, ready to publish. One flagged item
sits at the bottom — don't wire that one into the app until it's resolved.

---

## Live sources — what the pipeline actually queries

- **NPPES / NPI Registry** — https://npiregistry.cms.hhs.gov/api/ — Proves a
  physician's identity, specialty, license number, and practice address. The
  one required source; no NPI row, no prospect. *(`app/adapters/npi/live.py`)*

- **Illinois IDFPR license roster** —
  https://data.illinois.gov/resource/pzzh-kp68.json — Proves an Illinois
  medical license is real, active, and dates it, which drives the timing
  score's "newly licensed" points. *(`app/adapters/idfpr/live.py`,
  `docs/DATA_SOURCES.md`)*

- **CMS PECOS, Group Practice Reassignment** —
  https://data.cms.gov/provider-data/dataset/27ea-46a8 — Proves who a
  physician bills Medicare under, which is how the system infers whether
  she's the employee or the employer. *(`app/adapters/pecos/client.py`,
  `docs/RESEARCH_CAREER_SIGNAL.md`)*

- **Cook County Assessor Parcel Sales** —
  https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json — Proves a
  real property purchase, the "financial event" that drives the timing
  score's strongest trigger. *(`app/adapters/cook_county/live.py`)*

## Why Medicare/PECOS isn't a universal signal

- **KFF, Medicare opt-out** —
  https://www.kff.org/medicare/how-many-physicians-have-opted-out-of-the-medicare-program/
  — Proves overall physician Medicare participation is about 98%, with
  opt-out concentrated in specific specialties (psychiatry, plastic
  surgery).

- **JMIR Dermatology, opt-out trends among dermatologists** —
  https://derma.jmir.org/2022/4/e42345 — Proves dermatology's opt-out rate
  specifically (about 1.8%), the number behind Christina's specialty-coverage
  question.

- **CMS coverage policy, LCD L39506** —
  https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=39506&ver=3
  — Proves cosmetic procedures are statutorily excluded from Medicare
  coverage for every participating physician — the real mechanism behind the
  cosmetic-specialty gap, not opt-out.

## Vendor sources backing the future-implementations roadmap

- **Cobalt Intelligence** — https://cobaltintelligence.com/ — Proves a paid,
  person-name-searchable business-registry lookup exists and is priced, the
  fix for the ownership-dating and cosmetic-specialty gap.

- **ATTOM property data** —
  https://www.attomdata.com/data/transactions-mortgage-data/ — Proves a paid
  nationwide property feed exists to extend the deed/timing signal beyond
  Cook County.

- **Propelus** — https://propelus.com/api — Proves a paid, all-56-jurisdiction
  license verification API exists to extend past Illinois-only licensing.

## Research backing the Value score's rules

- **Becker's Hospital Review, physician net worth above $5M, by specialty** —
  https://www.beckershospitalreview.com/compensation-issues/physician-net-worth-above-5m-by-specialty/
  — Proves the specialty wealth-tier table's top row: radiology and
  orthopaedics tied at 39% net worth $5M+, cardiology 35%, anesthesiology
  31%, plastic surgery 29% — quoting Medscape's Physician Wealth & Debt
  Report 2026 directly, and matching the code's scaled values almost
  exactly. Re-verified 2026-09-14; an earlier search had surfaced a
  different, less specific Medscape article and flagged this
  unnecessarily. *(`app/scoring/detector.py`)*

---

## Flagged — do not publish until resolved

- **"Two-thirds of physicians 17+ years in already have an advisor"**
  (`docs/RANKING.md`, attributed to ACP). Two problems, not one, found on a
  2026-09-14 recheck. First, the report is real and does say two-thirds —
  but of over 450 **female internists** specifically
  ([2021 ACP report PDF](https://www.acponline.org/sites/default/files/documents/practice-resources/physician-wellbeing/acp_physicians_financial_preparedness_report.october2021.pdf)),
  not physicians generally, so the claim as used overstates its scope.
  Second, the URL this citation first pointed to, acpadvisors.org, is a
  *different organization* — the American College of Physician Advisors, a
  hospital utilization-review group with nothing to do with this report.
  Either find a source that covers physicians generally, or narrow the
  ranking rationale to match what this report actually shows.
