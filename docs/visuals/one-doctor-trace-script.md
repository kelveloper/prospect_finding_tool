# Talk script — One Doctor, End to End

Companion to `one-doctor-trace.html`. Main script ≈3 minutes; Q&A ammunition at the end.

## Setup
- "One physician followed through the entire pipeline — invented person, real rules. Every threshold and number on this page is what the system actually does."

## Step 1 — the only question a human writes
- "Only one question in this whole pipeline is written by a human: who are the Illinois orthopaedic surgeons? It goes to the NPI Registry — NPPES — and that's the **one required source** on the page: no NPI row, no prospect. One source decides whether she exists; the other three only decide where she ranks."
- "Row 1 pays for everything else: it hands over three keys — a licence number, an NPI, a surname — and every later search uses one of them. Nothing downstream is ever found by guesswork."

## Steps 2–4 — cast the net
- "Three searches at the same time, because none needs the others — the sweep costs NPPES plus the *slowest* source, not the sum of all four. All optional: a miss costs points, never the person."
- "Each source is asked with the strongest key it understands — IDFPR by licence number, PECOS by NPI, Cook County by name, because a county clerk doesn't record your NPI when you buy a house."
- "Each answers a question no other source can. **Licensing** turns a claim into a fact and starts the clock. **Medicare** doesn't tell us what she makes — it tells us whether she's the employee or the employer; and 98% of US physicians participate in Medicare, ~99% of orthopaedic surgeons, so we're reading the one enrollment roll that's public and nearly universal. **Deeds** are the only window into her personal life — a fresh mortgage is the moment people actually call an advisor."

## The teal dotted line — the keys appear twice
- "Watch the three keys. Up here they're search terms — cast the net. Follow the dotted line to gate 2: they return as evidence — check what the net caught. A search asks the world *what's filed under this key* and over-collects; the gate asks ourselves *do these two records agree* and under-accepts."

## The gates
- "Gate 1: is the row real? Gate 2: is it *hers*? Gate 3: is the claim earned? Each kills something different — junk rows, orphan rows, unproven claims."
- "Gate 2 runs in strict order: first identity rows merge into people, *then* every event goes shopping for its owner among the finished people — 'whose event is this?' is a question about the people, so the people have to exist first."
- "The exits say different things on purpose: at the required source a failure means someone *never becomes a prospect*; at the optional ones it's 'the row, not the doctor.'"

## Row 5 — the payoff
- "Five rows in, four out. The surname net caught two deeds — Reyes, and Reyes-Martin. Row 5 is a perfectly real deed; it sails through gate 1. Gate 2 offers it to *every* physician in the book, nobody matches exactly, and it's discarded — attached to nobody. The code's own comment: *attaching a property purchase to the wrong person is worse than missing one.*"
- "And every row walks through that gate — even the ones matched by licence number, where the check is trivial. That's deliberate, and I'm happy to say why." *(← planted hook)*

## Steps 6–7 — facts become claims
- "Step 6 is the last moment everything is a quote — four rows, each with a receipt. Step 7 is where the system forms opinions: this NPI date *means* she is seven months into her career; this PLLC *means* she's an owner; this deed *means* money just moved. Seven signals, and every one carries two honesty numbers — how much it matters if true, and how sure we are it's true."
- "Notice the licence does two different jobs, and that's not double-counting: that it's *active* is the gate — a lapsed licence and she isn't ranked at all, whatever else is true. That it's *eight months old* is a timing event. What a thing is, versus when it happened."

## Gate 3 and the score
- "Seven claims reach the last gate. Six are backed. The seventh — career move — would be worth the most of anything here, a hundred, and scores exactly zero, because proving someone *moved* takes two photographs and we've taken one. Valuable-but-unproven earns nothing."
- "Two questions, two numbers. **Is there money here?** Three facts that are all true at once, so they add: orthopaedics is the top wealth tier, forty-five; she bills under her own PLLC, twenty-five; she is seven months in — first attending years — five. **Value 75.** The money isn't all there yet, and the score says so."
- "**Did something just happen?** Not a sum — the single strongest fresh event. The house, two months ago, eighty times a freshness of point-eight-nine: **71**. The licence is the runner-up at nineteen, and it only counts at half weight because it's a *first* licence — graduation, not a relocation. Every event halves in value each year."
- "Then the two multiply. Timing sets how much of her value she keeps: sixty percent when nothing has happened, all of it when something big just did. Point-six plus point-four times point-seven-one is **×0.885**. Seventy-five times that: **66.4**."
- "Why multiply and not add? Because adding lets a broke doctor with a fresh event outrank a wealthy one having a quiet month. Multiplying means timing can only decide how much of *her own* value she keeps. You can wait for a good prospect; you can't turn a bad one into a good one by calling at the right moment."
- "And sixty-six is not a grade. The best number on a quiet week sits in the sixties by design, so the label comes from standing: the top five percent of the book are Top Prospects, and on today's book 66.4 is #1 of 1,088."

## Close — the three outputs
- "The advisor gets a ranked board — who to look at first, with the band from where she stands; a dossier — an LLM-written summary of who she is and why now, with every point of the priority traced to its source row and every move in her score explained; and a contact kit — the practical opener, leading with the new PLLC. One handwritten question, four public sources, one defensible number."

**If asked "so is the summary AI-generated?"** — "Two tiers, on purpose. The moment a prospect is created, a deterministic composer writes a first narrative from the signals — so no prospect ever shows raw pipeline text. An offline LLM pass then upgrades summaries in batches, and an LLM summary is never silently overwritten by a sweep: if the underlying facts change, the summary is flagged *stale* until the next LLM refresh rewrites it. The facts and the score are never LLM-generated — only the prose that explains them. The LLM writes the sentences; the pipeline supplies every fact in them."

---

## Q&A back pocket (don't volunteer)

**"Why gate the licence rows too — isn't the licence unique?"**
Concede: "It is — that check would be safe at the door." Fine print: "But 'unique' has fine print — formats differ between sources, NPPES licence fields go stale, and two different licence numbers only prove two different people *if the states agree*; every caveat lives in one file, the resolver." Receipt: "And gate 2 is the only door into a profile, and the door writes a receipt — matched by licence number, 1.0. Uniqueness makes the check easy; it doesn't make the receipt optional." Close: *"The gate isn't the bouncer for that row — it's the notary."*

**"Why not match results as they arrive?"**
"A sweep is two hundred doctors across four sources answering at different speeds — arrival order means nothing. The only moment the room is guaranteed full is after every source finishes, so that's the only moment we match. Otherwise we congratulate a doctor on a house she never bought."

**"What happens when a merge fails — is the licence info thrown out?"**
"Gate 2 has two failure modes. An *event* with no owner is discarded — a fact with no person is worthless. An *identity* record that fails to merge is never destroyed — the records simply stay two people. Nothing is deleted at the identity layer; things are only kept apart. And below-threshold has two flavors: 0.70 means 'probably, unproven — ask again with more data'; 0.00 means 'provably different — stop asking.'"

**"What's 'weaker evidence'?"**
"A written ladder in one file: licence number 1.0, exact name + state 0.95, first initial 0.70 — and 0.70 is under the 0.80 bar unless something corroborates (same specialty adds 0.15 → 0.85, merges barely). A barely-merge is remembered: a profile's identity confidence is its *weakest* merge, forever."

**"What's the highest score possible?" — THE CEILINGS**
- **Value can hit 100 on day one:** a top-tier surgeon 5–15 years in who bills under her own active PLLC — 45 + 25 + 30.
- **Day-one priority ceiling: 92.** The hundred-point timing event is *forming her own practice*, and that is detected by comparing this month's billing groups with last month's — it cannot exist on a first sweep. The best day-one event is a house bought this month: 80. So 100 × (0.6 + 0.4 × 0.8) = 92.
- **100 is reachable, but only over time.** It certifies that we watched her move. The presentation phrasing: "the last eight points can only be earned by monitoring a prospect."
- **Dr Reyes at 66.4:** seven months in, so career stage is 5 of 30 — the money isn't there yet, on purpose. Her Value is 75; a fresh house keeps 88.5% of it. Ten years from now with the same PLLC she would be Value 100.
- **The floor:** a quiet prospect keeps 60% of Value. A quiet Dr Reyes would be 45. The best number on a quiet week sits in the sixties — which is why bands come from standing, not the number.

**"Why does the number look low — is 66 failing?"**
"No. Nothing recent means sixty percent of value, so sixty-something is where the best quiet prospects live. The label answers the advisor's real question — where does she sit among everyone I could call — and the top five percent of the book are Top Prospects. #1 is always Top."

**"Isn't ownership at seven months suspicious rather than promising?"**
"It's exactly what we're looking for — emergence. Ownership at three years in is a doctor whose wealth is starting to compound; ownership at twenty is an established practice the pitch is too late for, and the tenure factor discounts it to thirty percent. Same fact, different meaning depending on when."

**"What if a source is down?"**
"Every batch request gets one retry — free public APIs hiccup. Fail twice and the whole sweep fails loudly, nothing saved. We'd rather fail loud than save half a picture quietly."

**Acronyms**
NPPES: National Plan and Provider Enumeration System. IDFPR: Illinois Department of Financial and Professional Regulation. PECOS: Provider Enrollment, Chain, and Ownership System. Cook County deeds: county recorder data, no acronym.

**Medicare sources if pressed**
KFF (Nov 2024): 98% of non-pediatric physicians participate; 1.2% opted out. CDC MMWR: ~99% of orthopaedic surgeons accept Medicare.
