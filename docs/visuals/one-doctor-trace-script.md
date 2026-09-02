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
- "Step 6 is the last moment everything is a quote — four rows, each with a receipt. Step 7 is where the system forms opinions: this licence date *means* a career just started; this PLLC *means* she's an owner. Seven signals, and every one carries two honesty numbers — how much it matters if true, and how sure we are it's true."
- "Notice the licence feeds both sides of the scorecard, and that's not double-counting: that it's *active* answers 'should we care'; that it's *eight months old* answers 'why now.' What a thing is, versus when it happened."

## Gate 3 and the score
- "Seven claims reach the last gate. Six are backed and earn points. The seventh — career move — would be worth fifteen and scores exactly zero, because proving someone *moved* takes two photographs and we've taken one. Valuable-but-unproven earns nothing."
- "Should we care: 95. Why now: 76.8. Weighted 60/40 → **87.7**. Worth gets the bigger weight because worth is durable; timing decays."

## Close — the three outputs
- "The advisor gets a ranked board — who to look at first; a dossier — an LLM-written summary of who she is and why now, with every point of the score traced to its source row; and a contact kit — the practical opener, leading with the new PLLC. One handwritten question, four public sources, one defensible score."

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
- **New prospect ceiling: exactly 91.0.** Qualification maxes at 95 (ownership is a billing inference, permanently capped at 0.8 strength → 20 of 25 points). Timing maxes at 85 on a first run (career move locked at 0; everything else at full strength if under 6 months old — the recency cliff). 95×0.6 + 85×0.4 = 91.0.
- **All-time ceiling: 97.** Even with a proven career move (timing 100), the ownership cap holds: 95×0.6 + 100×0.4 = 97.
- **100 is unreachable by design.** Every missing point marks something the system refuses to claim without better evidence.
- Dr Reyes at 87.7 is 3.3 under the new-prospect ceiling — all recency decay (licence 8 months, enumeration 7 months → 0.85 strength past the 6-month cliff).
- So the bands mean something: **>91 = observed changing over time; 97 = perfection under current sources.**

**"What if a source is down?"**
"Every batch request gets one retry — free public APIs hiccup. Fail twice and the whole sweep fails loudly, nothing saved. We'd rather fail loud than save half a picture quietly."

**Acronyms**
NPPES: National Plan and Provider Enumeration System. IDFPR: Illinois Department of Financial and Professional Regulation. PECOS: Provider Enrollment, Chain, and Ownership System. Cook County deeds: county recorder data, no acronym.

**Medicare sources if pressed**
KFF (Nov 2024): 98% of non-pediatric physicians participate; 1.2% opted out. CDC MMWR: ~99% of orthopaedic surgeons accept Medicare.
