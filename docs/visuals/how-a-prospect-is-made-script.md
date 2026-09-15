# Talk script — How a Prospect Is Made

Companion to the "How a Prospect Is Made" diagram (four sources, three gates, two questions, one number). Delivered standing at the screen, pointing — main pass ≈ 2.5–3 minutes, one stop per box, left to right, top to bottom, in the exact order the chart reads. Q&A at the end.

Two habits for this walkthrough: don't leave a box until you've pointed at it — your hand should never be ahead of or behind your mouth. And land the likely objections where the box sits, not in Q&A afterward — Medicare's specialty limit is spoken the moment your hand is on the Medicare box, not saved for someone to raise it.

## Live walkthrough — point, then speak

**1 · Point: the top box, "NPPES · the NPI Registry."**
"Everything starts here. No NPI row, no prospect. This one source decides whether a physician exists in this system at all — every box after it only decides where she ranks."

**2 · Point: sweep left to right across the three boxes below it — IL Licensing, Medicare Billing, County Deeds — without stopping yet.**
"That one row hands over three keys, and each goes to a different source, for a different reason — Illinois's own licensing board, Medicare's enrollment system, and the county recorder of deeds."

**3 · Point: "IL Licensing."**
"Licence number goes to IDFPR — the Illinois Department of Financial and Professional Regulation. It turns a claim into a fact and gives us a start date."

**4 · Point: "Medicare Billing." Hold here — this is the longest stop on purpose.**
"NPI goes to PECOS — Medicare's own provider enrollment system. It tells us whether she's the employee or the employer — if the billing group she's reassigned her Medicare payments to carries her own surname, she owns it; someone else's group name, she's on salary. It's the one free signal we get for that. It isn't universal, though: Medicare doesn't cover cosmetic procedures by law, so a heavily cosmetic dermatology or plastic surgery practice can look quiet here even while fully enrolled. We've already priced the fix — a business-registry lookup by name that finds ownership without touching Medicare at all — we built and tested it, it's just paid, so it isn't switched on yet."

**5 · Point: "County Deeds."**
"Surname goes to the Cook County Recorder of Deeds. It's the only window into someone's personal life — a fresh mortgage is often the actual moment someone picks up the phone and calls an advisor."

**6 · Point: the "GATE 1 · MATCHED ON A KEY?" diamond, then trace the dashed arrow to "dropped."**
"Three searches, all optional — a miss costs points, never the person. Everything that comes back hits gate one: did we match a real, valid row on one of those keys? Wrong kind of record, it's dropped right here."

**7 · Point: "GATE 2 · EXACTLY THE SAME PERSON?", then trace its dashed arrow to "dropped."**
"Gate two is stricter — is this exactly the same person? Identity rows merge; every event has to find its exact owner. Close but not exact is dropped, never guessed. Pinning a house on the wrong doctor is worse than losing it."

**8 · Point: "ONE PROFILE."**
"What survives becomes one profile, and every merge is written down with its score and its reason. Nothing past this point is a black box."

**9 · Point: "GATE 3 · CAN WE SCORE IT?", then trace both dashed arrows.**
"Gate three: can we actually score it? A licence that isn't active means she isn't ranked at all, whatever else is true. A career move we've only seen once needs a second sweep to prove — it sits on the profile, scoring nothing, until then."

**10 · Point: "VALUE" and "TIMING" side by side — touch both, don't linger on either.**
"What's left becomes two numbers, kept deliberately separate. Value: how much wealth is likely — three signals that add to a hundred. Timing: did something just happen — the single strongest fresh event, never a sum, halving every year."

**11 · Point: the "PRIORITY = Value × (0.6 + 0.4 × Timing / 100)" pill where the two arrows meet.**
"Timing sets how much of the value counts — sixty percent when nothing's happened, all of it when something fresh did. That's the whole point: timing can never lift a poor fit above a strong one."

**12 · Point: "BAND BY STANDING."**
"The label comes from standing, not the raw number. Top five percent are Top Prospects — number one is always Top, even in a quiet week."

**13 · Point: sweep across the three boxes at the bottom — Ranked board, Profile, Contact kit.**
"Three things reach the advisor: a ranked board, a profile with an LLM-written summary where every point traces back to a row, and a contact kit that leads with the trigger."

---

## Questions you will get

**Why multiply instead of add?**
"Adding treats a fresh event as if it were wealth. A pediatrician two years in, value 30, who just bought a house, timing 100, against a surgeon ten years in, value 80, with nothing recent. Adding gives the pediatrician 58 and the surgeon 48 — the house just bought forty points from nowhere. Multiplying gives 30 and 48. The surgeon stays on top, because timing can only scale what's there. You can wait for a good prospect. You can't turn a bad one into a good one by calling at the right moment."

**What does "timing sets how much of the value counts" mean?**
"Timing never adds points. Nothing recent, the prospect keeps sixty percent of their value. A big fresh event, they keep all of it. The most any event can do is hand someone back their own full value."

**Why does the top score look like a 64?**
"A quiet prospect keeps sixty percent of value, so the best number on a quiet week sits in the sixties by design. That's why the label is standing, not the number."

**What is ownership, and what is tenure?**
"Ownership is whether the doctor runs their own practice or draws a salary from someone else's. We read it from Medicare: when the billing group carries the doctor's own surname, it's their practice. An active PLLC, PC or SC earns the full 25; an LLC in their name, 15. Tenure is years in practice from the NPI date, and it discounts ownership — full under ten years, 0.6 at ten to twenty, 0.3 past twenty. The billing record has no formation date, so tenure stands in for 'when'. Ownership three years in is emergence. At twenty it's an established practice the pitch is too late for."

**Why Medicare?**
"It's keyed by NPI, so the match is exact, never by name. And it answers a question no other free source can: not what the doctor earns, but whether they're the employee or the employer. Coverage isn't flat, though. Formal opt-out is low everywhere but does vary — dermatology sits around 1.8%, versus under 1% overall and about 7% for psychiatry, the highest. But opt-out isn't the real limit: Medicare statutorily excludes cosmetic procedures from coverage, for every participating physician, opted out or not. So a dermatologist can be fully enrolled and still generate almost no Medicare billing if her practice is mostly Botox, fillers, and laser work — those codes are never covered, whether or not she bills them. We've already priced the fix for that: a Secretary-of-State business-registry lookup, searchable by person name, finds practice ownership independent of Medicare billing entirely, and hands us a formation date directly instead of an inference. We built and tested it against real PECOS-found owners — it works — it's just paid, about fifty cents to two dollars a lookup, and it isn't switched on. So today, Medicare is one practice-affiliation signal where available, not a universal one."

**Does Medicare participation vary by specialty?**
"A little on opt-out, a lot on coverage — we checked. Dermatology's opt-out rate is about 1.8%, higher than the roughly 1% overall but well under psychiatry's 7%, the highest of any specialty. But opt-out isn't the mechanism that actually threatens this signal — Medicare statutorily excludes cosmetic procedures from coverage entirely, for every physician, enrolled or not. So a dermatologist can stay fully enrolled and still generate almost no Medicare billing if her practice leans cosmetic, because those services are never a covered claim to begin with. That means the doctors we most want to find — high earners in cash-pay cosmetic practices — really could be under-signaled here, just not for the reason we first said. We already have a costed fix on the shelf: a person-name business-registry lookup that finds ownership without touching Medicare at all, and gives us the formation date we currently have to infer. It's paid, roughly a hundred to four hundred dollars for a cohort, and we haven't turned it on. Until we do, Medicare/PECOS is one practice-affiliation signal where available, not a universal one."

**If they already own a practice on the first sweep, do they get the timing event?**
"No. That's value, not timing. Timing needs a date, and the billing record has none — we can't tell a practice formed last month from one formed in 2005. We can only date a formation by watching the billing group change from one sweep to the next. That's the one event that can't exist on day one, and why a first sweep tops out at 92."

**What is an employer group change?**
"The doctor's billing group is different from last month and the new group isn't in their name — Northwestern to Rush. It's worth 30 because most of these are the employer's paperwork: a hospital renames a billing entity and every doctor inside it 'moves' at once. Nineteen landed on one day in our book, none in a doctor's own name. It isn't zero because sometimes it's real."

**Why is forming a practice worth more than buying a house?**
"A practice steps income up and keeps it there. A house moves money once, and a deed can't tell a windfall from a stretch. And these are ceilings: a fresh house at 80 beats a two-year-old practice formation at 25, and only one event counts."

**What are the specialty tiers based on?**
"Medscape's share of each specialty with net worth over five million, scaled so the top is one."

**Why five to fifteen years?**
"Under 35, most physicians are still below a million net worth. At seventeen-plus years, two thirds already have an advisor. The window is between. Two clocks: years in practice sets value; how long ago the event happened sets timing."

**Is the summary AI-generated?**
"The prose is. The facts and the score never are. The pipeline supplies every fact in the sentences; the LLM only writes the sentences."
