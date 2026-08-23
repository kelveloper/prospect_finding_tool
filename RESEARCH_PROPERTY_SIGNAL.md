# Research: Real Data Sources for PROPERTY_EVENT

Researched 2026-08-23. Goal: replace the mock `cook_county` adapter with a
real source for property purchases (the "financial event" in the
hypothesis chain). Decision: **free Cook County open data now; paid vendor
documented for the team when scaling.**

## The headline finding: the free source has buyer names ✅

The open question from earlier research is resolved. Cook County's
**Assessor – Parcel Sales** dataset (`wvhk-k5uv` on
datacatalog.cookcountyil.gov, Socrata API, free, no key) was probed live
and contains:

`buyer_name` · `seller_name` · `sale_price` · `sale_date` · `deed_type` ·
`pin` · `doc_no` · multisale/junk-filter flags

- Current: updated 2026-08-19; 30,688 sales recorded for 2026
- Real prices and real buyer names ("ALEX CUSUMANO — $535,000 — 2026-07-13")
- Quirks handled in the adapter: blank `buyer_name` on some rows,
  duplicate rows per parcel in multi-parcel deals (dedupe by `doc_no`),
  sub-$10k junk transfers (dataset ships a filter flag)

**Limitations of free:**
- **Cook County only** (Chicago metro — the majority of IL physicians, but
  not Rockford/Springfield/etc.)
- Assessor's sales roll, not the recorder's full deed images — fine for
  "bought a property for $X on date Y," which is all the signal needs
- Join is **name+state only** — no address corroboration against the
  physician's known addresses (paid vendors fix this)

## Paid alternatives (for the team)

| Vendor | Coverage | What it adds over free | Price signal |
|---|---|---|---|
| **ATTOM** | Nationwide, 158M properties | Buyer+seller names everywhere, mortgage amounts, AVM values, address-keyed matching, API+bulk | entry ~$95–$500+/mo, quote-based |
| **BatchData** | Nationwide, 155M properties | 20-yr deed/mortgage history, equity & LTV estimates (wealth signals!), transparent pricing | from **$0.01/API call** |
| **First American DataTree** | Nationwide recorder docs | Full deed images, bulk licensing | quote |
| **Cotality (ex-CoreLogic)** | Nationwide | Enterprise analytics | quote, enterprise |
| **Datafiniti / RealEstateAPI** | Nationwide | Mid-market alternatives | varies |

(Note: several comparison sources are vendor blogs — treat feature claims
as marketing until tested.)

**Why paid eventually matters:**
1. **Statewide/national coverage** — free stops at Cook County's border
2. **Address corroboration** — matching "STEVEN MARKS" by name alone in a
   5M-person county risks collisions; paid data keyed by address lets us
   cross-check against the physician's NPPES practice/home addresses
3. **Mortgage & equity fields** — loan amounts and estimated equity are
   direct wealth-trajectory signals the assessor roll doesn't have

**Recommendation to the team:** start the paid conversation with
**BatchData** (pay-per-call fits our targeted lookups; equity/LTV fields
are bonus signals) and **ATTOM** (market standard, most battle-tested) —
both are commercial B2B licenses. Expected pilot cost at our cohort size:
tens of dollars/month (BatchData) to ~$100–500/month (ATTOM entry).

## What we implemented now (free)

`CookCountyLiveDataSource` — targeted Socrata queries: batched
`buyer_name IN (…)` for our tracked physicians' names, last 36 months
(the decay window), price floor, junk filters, dedupe by `doc_no`.
Same conservative name+state attach rules as all name-keyed enrichment;
near-miss protection unchanged.

## Sources

- [Cook County Assessor – Parcel Sales dataset](https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv)
- [ATTOM transactions & mortgage data](https://www.attomdata.com/data/transactions-mortgage-data/)
- [BatchData vs ATTOM comparison (vendor blog)](https://batchdata.io/blog/batchdata-vs-attom-api-feature-comparison-developers)
- [Real-estate API pricing comparison (vendor blog)](https://batchdata.io/blog/real-estate-data-api-pricing-comparison-batchdata-competitors)
