# Demo script — for a one-to-one with your team lead

**Shape:** short intro, then the tool, then stop talking.
**Do not open the diagram.** Keep it in a tab. If he asks how it is built,
open it then — see [`visuals/one-doctor-trace.html`](visuals/one-doctor-trace.html).
**Length:** about two minutes of intro and demo, then questions.

Companion: [`KNOWN_GAPS.md`](KNOWN_GAPS.md) — what to say if he finds something odd.

---

## Before you start

Have these tabs open, in this order:

1. The opening page (before you press Begin)
2. The board
3. **Rahul Aggarwal** — his profile, his sources page, his contact section
4. The book view
5. Spare: **Beth Ann Adams** (only if ownership comes up)

Backend on the default `prospects.db`. Do **not** run an ingest live.

---

## 1. The intro — about 45 seconds

Say this before anything is on screen.

> Every advisor is chasing the same people. The ones who are already rich.
> But by the time somebody shows up on a wealth list, they have usually had an
> advisor for ten years. So you are not really pitching to them at that point.
>
> So we asked a different question. Could we find people earlier, while they are
> still building it?
>
> We started with doctors, because a doctor's career leaves a public trail. They
> get a license. They enter practice. Some of them open their own practice. Some
> of them buy a house. And every one of those things is public record — they were
> just sitting in four separate government databases that nobody had joined up.
>
> So we joined them up, scored the people, and ranked them. Let me show you.

**Then stop and share your screen.** Do not explain the architecture yet.

---

## 2. The demo

### The opening page

> This is what an advisor sees when they open it. Three things — who they are,
> what came in today, and a button to start.

*One line only. Press Begin.*

### The board

> Two hundred and nineteen real Illinois-licensed doctors, pulled from federal
> and state registries, ranked best first. This is an advisor's Monday morning.

**Say "Illinois-licensed", not "Illinois doctors".** 183 of them actually
practise in Illinois; the rest hold an Illinois license and work elsewhere. It
is a small word and it is the true one.

### One person, all the way through

*Open Rahul Aggarwal, number one.*

> Let me follow one person. He is top of the list today, and here is why.
>
> He got his Illinois license two months ago. And two months ago he bought a
> house for one point one million dollars. Those are two separate government
> records, and they are the same person.
>
> So both of those say the same thing: this is somebody whose money situation is
> changing **right now**. That is the moment we are trying to catch.

*Then the comparison — this is the most important sentence in the whole demo.*

> And here is what I would pay attention to. Somebody further down this list
> bought a house for more than twice as much, and he still ranks above her.
> Because hers was two years ago and his was two months ago.
>
> The bigger house scores lower. That is the whole idea — this is not a rich
> list, it is a timing engine.

### What the advisor actually does with it

*Open his contact section. This is the part your friend said was missing.*

> And this is the part that matters for an advisor. It gives them the practice
> address, the phone number, and the one thing to open the conversation with —
> which for him is the new license.
>
> Notice what it does not give them: the house. The property tells **us** when to
> call. The advisor would never mention it.

**Do not follow the suggestion to "mention the house in the outreach".** The
system deliberately withholds it — see the rules in `app/outreach/service.py`.
Saying we would reference a property purchase is the fastest way to turn a demo
into a compliance conversation.

### The loop back

*Point at the outreach buttons. Do not click through.*

> Then once the advisor has actually reached out, they tell us what happened.
> Did they speak to them. Did they become a client, or were they not a fit.
>
> Right now we just store those answers. But that is the loop we want to close —
> those are real outcomes we could tune the ranking against, instead of the
> weights we picked ourselves.

**Say "we store them". Never say "it re-scores".** Nothing in `app/scoring/`
reads these events yet.

### The list

*Switch to the book view.*

> That was one person. Day to day an advisor is working a list, so it is the
> same data in two shapes — the board for scanning, the book for working
> through. And they can filter it and save that view with a name, so Monday
> starts where Friday stopped.

---

## 3. Then stop

Say something like:

> That is the tool. Happy to go into any part of it.

**Then be quiet and let him ask.** His questions will tell you which part he
cares about, and you almost certainly have the answer on a screen already. Do
not fill the silence by starting on the architecture.

---

## 4. The questions you will get

### "What is the difference between the score and the evidence badge?"

**This is the one you got stuck on. Learn this answer.**

> They answer two different questions. The **score** is how good this prospect
> looks. The **evidence** is how much we actually know about them.
>
> We look for seven signals on each person. The evidence badge is just how many
> of the seven we found — five or more is strong, four is partial, three or
> fewer is thin. The score is what those signals are *worth* once they are
> weighted.

*And the example that makes it land:*

> So you can have a high score built on thin evidence. Alex Brewer scores higher
> than Rahul on fit — seventy-five against fifty-six — but we hold fewer facts
> about him. That is exactly why we show both numbers instead of blending them
> into one.

The three headings on the sources page — **Career Signal**, **Ownership &
Practice**, **Financial Activity** — are just how the page is *grouped for
reading*. They are not how the badge is calculated. If he asks, say that
plainly.

### "Does it look up one person at a time?"

> No, it is a bulk sweep. One run pulls hundreds of doctors, resolves them,
> scores them all and ranks them — that is where the two hundred and nineteen
> come from. If I show you the diagram it follows a single person through, but
> only because that is easier to read than three hundred at once.

*This is what confused a reader of the diagram, so pre-empt it.*

### "How is the score calculated?"

> Two questions. First, should we care about this person at all — that is sixty
> percent, and it is things like their specialty and whether they own a
> practice. Second, why now — that is forty percent, and it is all recency.
>
> Those weights are ours, not calibrated yet. In production we would tune them
> against what advisors actually convert.

### "Can I filter to just the people who bought a house?"

> Yes, in the book view — you can filter and save the view. There are no
> pre-built default filters yet, which is a fair thing to add.

Do not oversell this. Filter, save, name — that is what exists.

### "Is the book split per advisor?"

> No. The advisor ID is shown, but nothing is scoped to it yet. Who owns which
> prospect is a data question we have not answered.

Never describe it as built.

### "That dermatologist is nineteen years in — wouldn't she already have an advisor?"

> Probably, yes. And the tool agrees — her timing score is five and a half out
> of a hundred. She ranks on fit, not on timing.
>
> The honest gap is that our ownership signal comes from Medicare billing, which
> says who is paid today but carries no start date. So we cannot yet tell a
> practice formed last month from one formed in 2006. It is written up, and the
> fix is the state business registry.

---

## 5. Only if he asks how it is built

Open [`visuals/one-doctor-trace.html`](visuals/one-doctor-trace.html) and use the
"Saying it out loud" section at the bottom of that page.

Two things to say first, because both confused a reader before:

- **"Row" here means a record, not a person.** Row 1 is her registry record, row
  2 is her license record, and so on. It is five facts about one doctor, not
  five doctors.
- **"This follows one person, but the real run does hundreds at once."**

If he starts giving architecture feedback, that is a good sign — write it down
rather than defending. You do not have to have every answer in a one-to-one.
