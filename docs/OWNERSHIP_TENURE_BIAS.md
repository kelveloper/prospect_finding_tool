# Open question: ownership selects for the already-established

**Status:** needs a decision. Found 2026-09-01 while checking a demo prospect.
**Owner:** unassigned. **Blocking:** nothing today, but it undercuts the thesis.
Companions: `RANKING.md` (the scoring math) · `HOW_IT_WORKS.md` (the hypothesis)
· `RESEARCH_COMMERCIAL_SOURCES.md` (the paid fix) · [`KNOWN_GAPS.md`](KNOWN_GAPS.md)
(smaller things found the same way)

---

## The short version

The `OWNERSHIP` signal was meant to catch the moment a physician **forms their
own practice** — the step in our hypothesis where wealth starts compounding.
In practice it appears to be finding physicians who have **owned a practice for
two decades**: exactly the people the pitch says an advisor is too late for.

## What we saw

Every prospect in the book carrying `OWNERSHIP`:

| Prospect | Qualification | Timing | Years since NPI |
|---|---|---|---|
| Beth Ann Adams | 91.5 | 5.5 | 19 |
| Bradley Lane Ashpole | 88.8 | 5.5 | 18 |
| Kelly Lynn Abate | 85.2 | 5.5 | 19 |
| Tahir A Abbasi | 75.8 | 5.5 | 19 |
| Otis George Allen | 75.0 | 5.5 | 21 |
| Ashraf H Abourahma | 69.5 | 5.5 | 20 |

Average tenure in the ownership cohort is **19 years**, against **12 years**
across the book. Every one of them scores **5.5 on timing** — the floor. And
because ownership is worth 25 qualification points, and qualification is 60% of
the total, they land in the **top 20 of 219**. Beth Ann Adams is rank 11.

So the highest-qualification prospects we have are the ones with nothing
recent happening at all.

### How confident is this

**The mechanism is certain. The magnitude is not.** Only 6 prospects carry
ownership, and the book is heavily skewed by the demo page limit — 203 of 219
surnames begin with "A". Re-check the tenure gap after a full sweep before
treating the 19-vs-12 number as real.

## Why it happens

`OWNERSHIP` is inferred from PECOS, which records **who gets paid today**. It
carries no formation date — `event_date` is NULL on all seven ownership signals
in the book, and there is nowhere for a date to come from.

That means a physician who formed their practice last month and one who formed
it in 2006 produce an **identical signal at identical strength**. And since
long-tenured physicians are far likelier to own a practice at all, a dateless
ownership signal quietly selects for tenure.

The scoring then amplifies it: 25 points, weighted 60%, with nothing pulling the
other way.

## Why it matters

From `HOW_IT_WORKS.md`:

> reach them **before** they're rich, when they don't have an advisor yet

A dermatologist nineteen years into practice who already owns her practice is
not becoming wealthy. She is wealthy, and almost certainly already advised. The
signal meant to find emergence is currently our strongest predictor of
establishment.

Worth being precise: she is still a **good fit** — high income, business owner,
the right client profile. She is a bad **emerging** prospect. The tool cannot
currently tell those apart, and the ranking treats them as the same thing.

## Options

**1. Modulate ownership by career tenure.** Free, uses data we already hold.
Ownership at three years since enumeration is strong evidence of emergence; at
nineteen it is evidence of an established practice. Multiply ownership strength
by a tenure factor. Directly targets the hypothesis, no new data source.
*Cost:* an hour, plus `RANKING.md` and the scoring tests. Reshuffles the board.

**2. Make emergence a gate, not a weight.** Also free. If nothing has happened
in the last N months, the prospect is not emerging — surface them on a separate
"high fit, no trigger" list rather than mixed into the ranked board. This fits
the system's existing *gates reject, scoring weighs* philosophy, where trust
questions are binary and value questions are continuous.
*Cost:* similar, but it changes what the board **is**, which is a product call.

**3. Date the ownership.** The state business registry gives a formation date,
turning "owns a practice" into "formed one eight months ago" — which is what the
hypothesis actually wants. Already on the roadmap in
`RESEARCH_COMMERCIAL_SOURCES.md`. *Cost:* paid integration.

## Recommendation

Do **1 and 2 together** — they are cheap, they use data in hand, and they make
the board mean what the pitch says it means. Treat 3 as the real fix when the
paid source lands.

One thing already works the right way and is worth protecting:
`CAREER_ADVANCEMENT`, derived from diffing PECOS between monthly syncs, catches
the actual **switch** to self-billing and carries a real date. That is the
signal that should own emergence. It cannot accrue until there are two
snapshots, which is also why the day-one score ceiling is 91.

## What would change

- `app/scoring/detector.py` — tenure factor on the ownership strength
- `app/scoring/engine.py` — only if emergence becomes a gate
- `docs/RANKING.md` — the worked examples and the component table
- `tests/test_scoring.py`, `tests/test_ownership.py` — thresholds move
- Every stored score is recomputed on the next ingest; `score_history` will show
  a step change that is not a real-world movement. Worth a note in the UI if it
  ships between demos.
