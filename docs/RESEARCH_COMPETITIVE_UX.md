# Competitive UX review — what the market does, and four changes

How Catchlight, Aidentified, Apollo and ZoomInfo present prospects, and what
follows for ProspectIQ's UI.

**Reviewed:** 2026-08-30. Five web searches, three pages read.
**Visuals:**
[teardown + layout reconstructions](https://claude.ai/code/artifact/fe6b0f0f-a41a-4cb9-836f-8e233496b52c) ·
[the four changes drawn in our own components](https://claude.ai/code/artifact/dab01a4e-1d47-4e85-bb77-afd1c69c7f42)

> Read the evidence note at the bottom before quoting any of this. Most sources
> were vendor and comparison content, not primary UX teardowns.

---

## The headline finding

**The market shows its scoring math. We hid ours.**

Every source on lead scoring converges on the same pattern: a per-signal
contribution list next to the score. Demandbase's framing is blunt — if a rep
cannot see *why* a lead scored 87, they will not use it. HubSpot shipped
exactly this in 2025.

The industry format:

```
VP title  +15  ·  pricing page 3× this week  +25  ·  ICP Tier 1  +12
```

That is structurally identical to our `0.85 × 25 = 21` — the thing review
item #10 asked us to hide, and which we moved behind a footnote citation.

**Both can be right.** The industry writes contributions as plain points, not
exposed arithmetic. The objection was to the algebra, not to the transparency.
Keep the explanation, drop the multiplication. That is change 01 below.

---

## The field

| Tool | What it leads with |
| --- | --- |
| **Catchlight** | Score from 100k+ real conversions · estimated investable assets, income, age · AI-written outreach copy · pushes into Wealthbox / Redtail / Salesforce |
| **Aidentified** | 16 event types monitored live · relationship mapping (which existing client knows this prospect) · CRM push with context attached |
| **Apollo / ZoomInfo** | 65+ filters over a 270M contact base · saved lists as the core object · Apollo rated 9.1/10 ease of use on G2 |

### Where we stand

| Capability | ProspectIQ |
| --- | --- |
| Score with a number | have |
| Per-signal contributions shown | behind a footnote |
| Trigger events as the hook | have |
| Filterable table / saved views | filters yes, saving no |
| Generated outreach copy | removed in `26aa4c1` |
| Outcome capture → recalibration | have |
| Wealth estimate on the prospect | missing |
| Relationship mapping | missing |
| **Compliance rules per contact** | **have — nobody else advertises this** |

The last row is worth a slide. No competitor surfaces DNC exposure or routes
every touch to a practice address. In a regulated market that is the strongest
thing we own, and it is currently styled as gray footnotes.

---

## The four changes

Drawn with real data in the second artifact linked above.

### 01 · Contributions, not arithmetic
`BreakdownExplorer.tsx` · ~20 min

Same numbers, advisor phrasing.

| Today | Proposed |
| --- | --- |
| `0.45 × 35 = 15.8` | `Specialty earning tier   +16 of 35` |
| `0.00 × 25 = 0` | `No practice ownership found   — of 25` |

A zero becomes **"not found"** — an absence of evidence rather than a failing
mark. That matters when three of the seven signals are commonly absent.

### 02 · Say how sure we are
`CandidateDetail.tsx` + `CandidateCard.tsx` · ~30 min

Catchlight puts a green check beside its score meaning "we had enough
attributes to be confident"; its *absence* is the warning. We have the same
problem and do not say it.

Measured on the board at time of writing (219 prospects):

```
3 signals →  86 prospects
4 signals → 119
5 signals →  14
```

**A 62 built on three signals is not the same claim as a 62 built on five**,
and the UI currently presents them identically. Proposed: a chip beside the
score — `✓ 5 of 7 signals`, neutral at 4, `3 of 7 · thin` as a warning.

No new data needed: `signal_types` is already on every ranked row.

### 03 · Lead with why now
`CandidateCard.tsx` + `BookView.tsx` · ~15 min

Aidentified sells on event monitoring; we detect the same class of events and
then bury them under specialty and city — both already implied by the name
above and the location filter beside it.

| Today | Proposed |
| --- | --- |
| `Dermatology · Chicago, IL` | `Opened her own practice · Dermatology` |
| `Internal Medicine, Cardiovascular Disease` | `Licensed 2 months ago · bought a home` |

Specialty stays; it just stops going first.

### 04 · Name a filter and keep it
`BookView.tsx` + new storage · ~2 hrs

Saved lists are the core object in Apollo, not a convenience. Our book already
serializes every filter into the URL (`?f_specialty=…&sort=…`) — naming and
storing those strings is the only step left.

A single chip row above the ledger: `Whole book · 219` / `Chicago derms · 23` /
`Score 55+ · 41` / `New this week · 25` / `+ Save this view`.

**"New this week"** is the one that changes the habit — it turns the tool from
a database into a morning routine.

---

## Deliberately not recommended

**Estimated investable assets.** Both advisor-native rivals lead with it and it
is our most visible gap. But we hold no such data, and inferring a dollar figure
from specialty plus a deed price would be a guess wearing a number's clothes.
This product's credibility rests on every claim tracing to a public source.

Raise it as a data-sourcing question, not a UI one.

**Relationship mapping.** Aidentified's "which of your clients knows this
person" needs the advisor's own book of business, which we do not ingest.

**Org charts.** ZoomInfo's buying-committee view solves a B2B problem. We sell
to one physician.

---

## Evidence note

Five web searches and three pages read. Before quoting any of this:

- Most results were **comparison and marketing content**, not primary UX
  teardowns. No vendor publishes annotated screenshots; Apollo's support pages
  return 403 to automated reading.
- **The explainability finding is the best supported** — it recurs across
  independent sources and names a shipped HubSpot feature.
- Feature claims come from **vendor pages**. Catchlight's "100k conversions"
  and Aidentified's "16B connections" are their own numbers.
- The layout reconstructions in the first artifact are **drawn from written
  descriptions, not screenshots**. Apollo's is the best attested (its own
  knowledge base documents the table view, column manager and side panel);
  Catchlight's and ZoomInfo's are thinner.
- The signal-coverage figures in change 02 are **ours**, measured directly
  against the local database — those are solid.

### Sources

- [Demandbase — AI lead scoring](https://www.demandbase.com/blog/ai-lead-scoring/)
- [Catchlight × Wealthbox](https://catchlight.ai/advisor-resources/catchlight-integrates-with-wealthbox-to-deliver-rich-profiles-to-advisors)
- [Aidentified — prospecting tools for advisors](https://www.aidentified.com/resources/prospecting-tools-for-financial-advisors)
- [Apollo / Clay / ZoomInfo comparison](https://coommit.com/blog/ai-sales-prospecting-tools-2026)
- [Apollo — building lead lists](https://www.smartlead.ai/blog/build-lead-lists-with-apollo-io-and-export)
- [B2B SaaS UX patterns](https://www.onething.design/post/b2b-saas-ux-design)
