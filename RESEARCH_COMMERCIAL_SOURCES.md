# Commercial Data Source Research (for team implementation)

Researched 2026-08-23. Question: for each data pillar the prototype runs on,
what are the best **paid, commercially-licensed** upgrades, what do they add
over the free sources we already use, and what would a sensible buy order be?

All vendors below sell B2B commercial licenses (that is their business
model) — unlike scraping-based routes, none carry the LinkedIn/Proxycurl
legal risk. Prices are from public sources where available; "quote" means
sales-assisted pricing only.

---

## Pillar 1 — Physician identity, specialty, demographics

**Have today (free):** NPPES API — identity, specialty, license numbers,
practice address, phone. Live in our pipeline; the identity spine.

**What free lacks:** self-reported and often stale (~30-40% of addresses
outdated per vendor studies); no emails; no group-practice linkage quality;
no claims volumes.

| Vendor | Adds over NPPES | Price signal | Notes |
|---|---|---|---|
| **IQVIA OneKey** | Gold-standard HCP reference: verified affiliations, 1.2M US physicians, 248 specialties | **$100K+/yr**, multi-year | Enterprise only; overkill for now |
| **Definitive Healthcare** | Affiliations, claims-based procedure volumes (income proxy!), executive contacts | **$30–50K/yr** single seat | Volume data is a unique wealth signal |
| **Veeva OpenData** | HCP reference, compliant CRM-ready | quote | Pharma-oriented |
| **H1** | Profiles, career histories, KOL data | quote | Research-oriented |
| **Ribbon Health** | Provider data API (directory accuracy) | quote | API-first, developer-friendly |
| **Provyx / CarePrecise** (budget) | Cleaned NPPES + enrichment | low $100s/mo | Cheap upgrade path |

**Verdict:** keep NPPES as the spine (it's the join key). Definitive
Healthcare is the interesting paid add *later* — claims volumes ≈ how busy
(≈ how high-earning) a physician actually is, a signal we can't get free.

---

## Pillar 2 — License verification & recency

**Have today (free):** IDFPR via data.illinois.gov — issue dates, status.
Live; drives 40 timing points. **Illinois only.**

**What free lacks:** other states (the scaling blocker); disciplinary
detail; continuous monitoring.

| Vendor | Adds | Price signal | Notes |
|---|---|---|---|
| **Propelus (PSV API)** | All 56 US jurisdictions, real-time primary-source verification + continuous monitoring | quote | Joint Commission approved |
| **Verifiable** | License verification API, modern DX | quote | Credentialing-oriented |
| **Medallion** | NCQA-accredited PSV via API | quote | Platform + API |

**Verdict:** don't buy for Illinois — free IDFPR covers it. Buy when
expanding to states without open license data. Propelus looks like the
best API-first fit; all three are quote-priced (credentialing-market
pricing, typically per-verification).

---

## Pillar 3 — Ownership / business entities  ← biggest gap, cheapest fix

**Have today:** mock IL SoS file + **live PECOS inference** (self-named
billing groups — 7 real owners found). No formation dates, no officer
records, inference only.

**What's missing:** the legal record — who formed the entity, when
(formation date = timing signal), officers, registered agent, status.

| Vendor | Adds | Price signal | Notes |
|---|---|---|---|
| **Cobalt Intelligence** | Live Secretary-of-State pulls, all 50 states + DC: entity name, status, **formation date, registered agent, officers**, filing history (22 fields) | **$0.50–$2.00 per lookup**, 20 free test lookups, pay-as-you-go | API-first; the data layer other vendors resell |
| **Middesk** | Same core + compliance platform (KYB) | **$1.00+/lookup**, platform subscription | Full-service, heavier |
| **OpenCorporates** | Aggregated registries, historical | **£2,250/yr** (500 calls/mo) | No free commercial tier anymore; annual commitment |

**Verdict: Cobalt Intelligence, clearly.** Pay-per-lookup fits our
targeted pipeline perfectly: we only look up physicians we already track
(~200 prospects ≈ $100–$400 total, vs OpenCorporates' £2,250 floor). The
20 free lookups let us validate against our PECOS-inferred owners before
paying anything. Replaces the mock `il_sos` adapter one-for-one and scales
to all 50 states.

---

## Pillar 4 — Property events (the "financial event")

**Have today (free, LIVE as of 2026-08-23):** Cook County Assessor Parcel
Sales via Socrata — **confirmed to include buyer names**, prices, dates.
Wired into the live pipeline; first run matched 8 real physician purchases
($672K–$2.45M). Full findings: `RESEARCH_PROPERTY_SIGNAL.md`.

**What free lacks:** counties beyond Cook, address-keyed matching
(name+state only → collision risk on common names), mortgage/equity fields.

| Vendor | Adds | Price signal | Notes |
|---|---|---|---|
| **ATTOM** | Nationwide deeds/mortgages **with buyer & seller names**, sale prices, API + bulk | est. **~$500+/mo**, quote-based | The spec's original reference vendor; B2B licensing is their model |
| **First American DataTree** | County recorder docs, deeds, mortgages; bulk licensing | quote | Title-industry depth |
| **Cotality (ex-CoreLogic)** | Property/mortgage analytics | quote, enterprise | Heavyweight |

**Verdict:** ATTOM when budget exists (~$6K/yr) — it's the market-standard
API for exactly our use (deed + buyer name + price + date). DataTree as
the bulk-license alternative if the team prefers files over APIs.
Matching note: property records join by name+address — our conservative
matcher + the NPPES practice address give us the corroboration needed.

---

## Pillar 5 — Career moves & titles

**Have today (free):** PECOS billing groups + facility affiliations, live,
NPI-keyed; snapshot diffs catch job changes monthly.

**What free lacks:** titles ("Partner", "Chief"), sub-monthly freshness,
non-Medicare context.

| Vendor | Adds | Price signal | Notes |
|---|---|---|---|
| **People Data Labs** | Person enrichment incl. job title/history | **$0.28/record** (Pro $98/mo · 350 credits); enterprise ~$2.5K/mo | Publishes pricing; compliant-sourcing claims |
| **Coresignal** | Public-web people/company datasets | from **$49/mo**; ~$0.005/record at volume | Dataset-style, bulk |
| **Definitive / IQVIA** | Curated affiliations (see Pillar 1) | $30K+ | Comes bundled with Pillar 1 buys |

**Verdict:** PECOS stays the backbone (free, NPI-keyed, no legal
questions). PDL is a cheap experiment ($98/mo) to test whether title data
("made partner") adds ranking lift on ~200 prospects before any bigger
commitment.

---

## Recommended buy order (for the team)

| Priority | Buy | Why first | Rough cost |
|---|---|---|---|
| **1** | **Cobalt Intelligence** (entities) | Completes the ownership signal with legal records + formation dates; pay-per-use; validates against PECOS inferences we already have; 20 free lookups to pilot | ~$100–400 for current cohort |
| **2** | **ATTOM** (property) | Activates the untouched 30 timing points — the "financial event" step of the hypothesis | ~$500+/mo, quote |
| **3** | **People Data Labs** (titles) | Cheap experiment for career-title lift | $98/mo |
| **4** | **Propelus/Verifiable** (licenses) | Only when expanding beyond Illinois | quote |
| **5** | **Definitive Healthcare** (volumes) | Claims-based earning proxy; buy when revenue justifies | $30–50K/yr |

**Pilot math:** priorities 1–3 ≈ **under $1K for month one** on the current
~200-prospect cohort — versus $30K–$100K+ for the enterprise platforms,
which only make sense at scale.

## Integration cost (engineering view)

Every vendor above slots into the existing adapter pattern — one new
`app/adapters/<vendor>/` per source, `fetch()` → records, nothing else
changes. Cobalt ≈ the same shape as our IL SoS mock (drop-in). ATTOM ≈ the
Cook County mock shape. PDL ≈ the affiliations mock shape. The pipeline,
matcher, scoring, and UI are already built for all of them.

## Sources

- [Healthcare data providers compared](https://healthcaredatabase.org/commercial-providers/) · [IQVIA OneKey cost](https://healthcaredatabase.org/d/iqvia-onekey/) · [Vendor comparison](https://getprovyx.com/resources/healthcare-data-vendor-comparison/)
- [Propelus PSV API](https://propelus.com/api) · [Verifiable docs](https://docs.discovery.verifiable.com/) · [Medallion PSV](https://medallion.co/resources/blog/simplifying-provider-credentialing-with-primary-source-verification-apis)
- [Cobalt Intelligence SoS API](https://cobaltintelligence.com/) · [Cobalt vs Middesk](https://blog.cobaltintelligence.com/post/how-does-cobalt-intelligence-compare-to-other-providers-like-middesk) · [Middesk SoS API](https://www.middesk.com/blog/secretary-of-state-api)
- [ATTOM transactions data](https://www.attomdata.com/data/transactions-mortgage-data/) · [ATTOM API pricing overview](https://zillapi.com/blog/attom-api/) · [DataTree licensing](https://dna.firstam.com/solutions/data-delivery/property-data-licensing)
- [PDL pricing review](https://syncgtm.com/blog/people-data-labs-review) · [Coresignal vs PDL](https://crustdata.com/blog/coresignal-vs-peopledatalabs)
