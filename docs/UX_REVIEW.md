# Design review — Nam

An experienced product/UX designer walked through TellTale and gave feedback on
the prototype. This is his review, separated from the rest of the conversation,
turned into a work order and a test plan.

**Logged:** 2026-09-20. **Reviewer:** Nam (product / UX design).
**Verdict:** keep the design, fix six things. Not a redesign.

> "That's cool." · "It's really nice." · "The bones are there."
> "I like it. The only thing is the landing page."

His concerns were **clarity, interaction consistency, onboarding, and the size
of the landing page** — not the concept, the information architecture or the
visual language. Read the priority table as the work order; each item below
says what he said, what to change, and where the code is.

---

## The work order

| | Change | Why it is where it is |
|---|---|---|
| **P0** | Shrink the launch screen to a small welcome card | His single clearest note, and the cheapest to do — the overlay already sits over the scoreboard |
| **P0** | Make **Fit** and **Why now** understandable on sight | He had to ask what both meant. A first-time advisor will too |
| **P0** | Make the next action obvious — who do I call first? | The product's whole job. Ranking already does it; the page has to *say* it |
| **P1** | Remove the duplicate click target on the identity block | Concrete, located, one file |
| **P1** | Hover / selected / expanded states | "Did I actually click that?" is a trust problem, not a polish problem |
| **P1** | Contact details easy to find | The advisor's next step is a phone call. Do not bury the number |
| **P1** | Refresh: icon, not a slab | Concrete, one file |
| **P2** | First-run onboarding, optional and skippable | Real value, most build, easiest to get wrong |
| **P2** | Avatar on the prospect pages | Breaks up text-heavy pages. Cards already have initials |
| **P2** | Board / Book control consistency | Polish |
| **P2** | Keep using the JPMC icon set | Already doing it — do not drift |
| **Then** | **Put it in front of 2–3 real users** | Everything above is a hypothesis until someone tries it |

Nam's most repeated recommendation was the last row. The test plan is at the
bottom of this document.

---

## P0 · Shrink the launch screen

> "My initial thing is, this is really big." · "This is a lot of empty space."
> "Why not just keep it, like, a simple pop-up window?" · "It's just smaller.
> Like, way smaller."

His argument: TellTale would live inside an advisor application such as Connect
or Coach, so the advisor is **already authenticated** before they arrive. An
entire screen that exists to say *Begin* is a toll gate, not an onboarding.

He did **not** say drop the welcome entirely — he saw the value in signalling
"you're in the right place." He said it does not deserve a whole page:

```
Welcome back, Ariel
New prospects have been identified for your book.
                                  Start reviewing →
```

**What he described:** scoreboard visible and dimmed behind, a dark scrim at
around **20%**, a small welcome card, one Start action.

**Good news — the architecture is already right.** `LaunchOverlay.tsx` renders
over a scoreboard that is already painted underneath, then slides away. This is
a presentational change, not a rebuild: replace the full-bleed gradient and the
three-tile grid with one centred card on a 20% scrim.

- `frontend/src/components/LaunchOverlay.tsx` — the full-viewport gradient and
  the `grid-cols-[minmax(0,400px)_minmax(0,1fr)]` tile layout
- `frontend/src/components/launch/` — `BeginTile`, `FoundTodayTile`,
  `ViewerTile`, `LaunchTile`. The *content* of these three tiles has to survive
  as three lines of text in one card, not three squares
- Keep: the per-tab `hasLaunched()` logic in `lib/session.ts`, the reduced-motion
  path, the `aria-modal` dialog semantics, the scroll lock

**Done when** the welcome is a card of roughly 400×240, the board is legible
behind it, and Start is the only control.

---

## P0 · Make "Fit" and "Why now" understandable

> "If I was a user, would I know what fit means?" · "And then what is 'Why Now?'"

Nam asked what both meant, mid-demo. That is the finding — **not** that the
words are wrong.

On **Fit**: the rename from Score came from a real worry, that a 58 reads like a
failing grade. Nam's point was that the team is not the judge of whether the
replacement landed. He was explicit that he was not arguing for Score. He was
arguing against deciding this at a whiteboard. This one goes to the test plan,
not to a ticket.

On **Why now**: it means *why should the advisor call this person this week* —
a licence issued last month, a practice just formed, a home just bought. That
is a good idea with a label that does not carry it alone. Cheaper to fix:

```
Why now ⓘ  Recent signals that may make this a timely prospect.
```

**Tooltip candidates**, using the pattern already proven by the score tooltip —
explain the term where the user meets it, rather than in a legend:

| Term | Where |
|---|---|
| Fit | `components/ScoreRing.tsx`, `components/BookView.tsx` (column heading), `components/CandidateDetail.tsx` |
| Why now | `components/CandidateDetail.tsx`, `components/Scoreboard.tsx` (the filter), `components/RowChips.tsx` |
| Identity verified | `components/CandidateDetail.tsx` |
| Qualification · Timing | `app/prospect/[id]/how-we-know/page.tsx` |

**Done when** every term a first-time advisor could not define has an ⓘ within
reach of where it is printed. **Not done** by renaming Fit on a hunch.

---

## P0 · Make the next action obvious

> "Once the user has this information… how do they know what to choose?"
> "Do they just go down the list?"

He kept circling this, which is the tell. The board should answer **"who do I
contact first?"** without anyone standing beside it explaining the ranking.

The ranking already computes the answer. The visual hierarchy has to state it:

```
#1  Rahul Aggarwal
    High Fit · 68
    Why now: New licence + practice ownership
                                   View prospect →
```

- `frontend/src/components/Scoreboard.tsx`, `components/CandidateCard.tsx` —
  rank, fit and the why-now trigger should read as one sentence, not three chips
- The already-contacted state matters here: the real instruction is *start with
  the highest-ranked person you have not called*, so outreach status has to be
  visible on the card, not only inside it

**Done when** a stranger can point at who to call first, unprompted.

---

## P1 · One control, one click target

> "But these two buttons do the same thing?"

Located: `frontend/src/components/CandidateDetail.tsx:167` — a `<details>`
whose whole `<summary>` is clickable (name, location and the identity pill all
open it), containing a bordered **"See the records ▼"** button that looks like a
second, separate control. Both do exactly the same thing.

The code comment at line 208 already records the history: the affordance was a
13px link nobody could find, so it was given a border to read as a control. The
border worked — and produced Nam's question.

**Pick one.** Either the row is the control and the pill becomes plain text with
a chevron, or the row stops being clickable and the button is the only way in.
Do not ship two things that look like two controls and are one.

---

## P1 · Hover, selected, expanded

He clicked things and could not always tell the click had registered. His point:
these small states are how an interface says *the system heard you* — which is a
trust question, not decoration.

States worth being explicit about:

| Interaction | Should show |
|---|---|
| Hover a prospect row | Border or background lift |
| Select a prospect | Persistent highlight that survives navigation back |
| Expand the identity block | Chevron rotates, content visibly opens |
| Switch Board ↔ Book | Which one is active, unmistakably |
| Log outreach | Immediate confirmation, and the row's state changes |

He also suggested using border / highlight / the green state to say "I am
interactive" — which is the other half of the duplicate-button fix above. Let
the component carry the affordance instead of bolting a second button on.

---

## P1 · Contact details easy to find

> "Was his phone number clear for you to reach out to them?"

That was offered as a test question, and it is a good one, because the product
does not exist to be interesting — it exists to get a call made. Practice phone
and practice address should be scannable, not sat among a dozen attributes.

- `frontend/src/components/ContactKitCard.tsx`

---

## P1 · Refresh: icon, not a slab

> "These are big buttons." · "This is huge."

Replace the `Refresh Data` button with the standard circular refresh arrow, a
pattern people already know:

```
Last updated Sep 20  ↻
```

- `frontend/src/components/RefreshData.tsx:396` — the button
- It already lives in the header (`components/Header.tsx`), so his other note —
  put refresh somewhere persistent that works from both Board and Book — is
  largely satisfied. Keep it that way; do not grow a second refresh per view

He also asked **how often it refreshes**. The data updates roughly weekly while
the button fetches new prospects on demand — the UI should make that distinction
legible, since the weekly gate is already enforced in code (`lockedDays`).

---

## P2 · First-run onboarding

> "Is there an onboarding process, too? Like, how do you guide the user?"

His framing: *if I got hired last week and open this tool, what tells me what to
do?* He suggested guided tooltips in the product-tour sense — "click here to…",
"this score represents…" — and immediately guarded it: **do not annoy the
experienced user.**

What he described:

- an opt-in prompt — "Are you new here?" → optional walkthrough
- surfaced only for the first few sessions (he floated five), then gone
- skippable at any point

Nothing exists in the codebase today. This is the largest item on the list and
the easiest to get wrong, which is why it sits at P2 — and why it should be
built *after* the terminology fixes, since a tour that exists to explain a
confusing label is a patch over the wrong hole.

---

## P2 · Avatar on the prospect pages

He was, in his words, "a big proponent" of having a picture — and where there is
no real photo, a generic avatar. The reason was hierarchy, not decoration: the
prospect pages are dense with text and numbers, and a face breaks the wall.

```
[avatar]  Rahul Aggarwal
          Orthopaedic Surgery · Chicago, IL
```

It does not need to be large. `components/CandidateCard.tsx:58` already renders
`candidate.initials`; the detail and dossier pages do not.

---

## P2 · Consistency and the icon set

**Board and Book** are fine as two views — he did not object to having both. But
shared controls, Refresh above all, should use the same icon, shape, colour and
relative position in each. Two views that handle the same control differently
read as two products.

**Icons**: he asked whether the existing JPMC library was being used, was told
yes, and said keep doing that. Do not hand-roll a refresh icon when the design
system ships one — the point is to feel like an authentic internal tool.

---

## The user test

This was the recommendation he returned to most. The team has been debating
Fit vs Score, landing page vs no landing page, is this button clear — and his
answer was that none of it gets settled in the room.

**It does not need to be a study.** He was explicit: "You don't need a big
group." Two or three relevant users will expose the obvious friction. Sit with
them while they use it; do not show screenshots and ask if they like it.

### Protocol

1. **Recruit 2–3** people close to the real user. An actual advisor is best; a
   person who has never seen the tool is still worth more than a teammate.
2. **Say almost nothing.** Hand over one task and stop talking:

   > "Imagine you're an advisor. You've opened this tool and you want to find
   > someone to contact. Show me what you'd do."

3. **Watch.** Where do they click first? What do they hover over and not click?
   Where do they go quiet? Where do they scroll past the thing they needed?
4. **Ask afterwards**, never before.

### The one rule

**Do not explain the UI while they use it.** Saying "this is Fit, which
means…" destroys the only thing that test could have told you. If they ask what
something means, write the question down and ask them to guess — then move on.

### What to find out

| Question | What it tests |
|---|---|
| What do you think **Fit** means? | The rename. Ask the same about **Score** |
| Which makes the ranking easier to understand, Fit or Score? | Settles the debate with evidence |
| What do you think **Why now** is telling you? | Whether the label carries the idea |
| Who would you call first, and why that person? | Whether the ranking reads |
| Show me how you'd contact them | Whether the phone number is findable |
| What's the difference between Board and Book? | Whether two views help or confuse |
| You've called them — what now? | Whether the outreach outcomes make sense |
| What did you expect to happen when you clicked that? | Click-state feedback |
| What did you expect this to be? | Anything they hesitated on |

Closing questions, and the most valuable two:

> **What didn't make sense?**
> **What were you questioning?**

Test **comprehension, not preference.** "Do you like it?" produces a polite yes
and no information.

### Recording it

One page per session: the task, where they clicked in order, every hesitation
with a timestamp, every question they asked aloud, and their answers to the
closing two. Three of those pages will name the real priority list — which may
not be the one above.

---

## Not in scope

The tail of the source conversation — 50 attributes, transaction data, UAT,
production, personas — is a different project discussion that overlapped the
recording. It is **not** part of this design review and should not be worked
from this document.

## Related

- [`FEEDBACK_TODO.md`](FEEDBACK_TODO.md) — the 17 manager-review items
- [`KNOWN_GAPS.md`](KNOWN_GAPS.md) — what is wrong on screen, found while demoing
- [`RESEARCH_COMPETITIVE_UX.md`](RESEARCH_COMPETITIVE_UX.md) — how comparable tools solve these screens
- [`OUTREACH_UI_CONTRACT.md`](OUTREACH_UI_CONTRACT.md) — where outcome capture lives
