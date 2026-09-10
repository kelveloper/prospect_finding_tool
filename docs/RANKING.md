# The Ranking System, Explained

The single source of truth for how a prospect's number is made. Code:
`app/scoring/engine.py` (the arithmetic), `app/scoring/detector.py` (the
signals and every constant). Changed 2026-09-09; the previous formula is
described at the end for anyone reading old score history.

## 1. Two questions, kept as two numbers

| Number | The question | How it is built |
|---|---|---|
| **Value** (0–100) | *Is there money here?* | Three facts that are all true at once, so their points **add** |
| **Timing** (0–100) | *Did something just happen?* | The single strongest fresh event — never a sum |

```
Priority = Value × (0.60 + 0.40 × Timing / 100)
```

Timing decides how much of a prospect's own value they keep: 60% when
nothing has happened, 100% when something big just did. It can never lift
a poor fit above a strong one. You can wait for a good prospect; you cannot
turn a bad one into a good one by calling at the right moment.

The `0.60` floor is `TIMING_FLOOR` (`app/config.py`, env `TIMING_FLOOR`).
Raise it toward 0.8 and timing barely matters; drop it toward 0.3 and a
quiet 80 falls below a noisy 30, which is the failure multiplication exists
to prevent.

**Who we are aiming at, stated once so every constant follows from it:**
physicians 5–15 years into practice in high-earning specialties with a
recent wealth event. Under 35, 96% of physicians are below $1M net worth
(Medscape); at 17+ years in, two thirds already use an advisor (ACP). The
window is between.

## 2. The licence gate

Before any arithmetic: a prospect whose Illinois licence status is present
and **not active** (NOT RENEWED, INACTIVE, SUSPENDED, PROBATION…) has
Priority 0, sorts last, and shows as "Not ranked". No IDFPR record at all
is not a verdict — those prospects stay ranked, and their identity
confidence (0.6 when single-source) already discounts their timing.
`ACTIVE CHAPERONE REQUIRED` counts as active. One function:
`is_rankable()` in `engine.py`.

## 3. Value — is there money here? (adds to 100)

| Component | Max | Strength (0–1) |
|---|---:|---|
| **Specialty wealth tier** | 45 | The share of that specialty with a net worth over $5M (Medscape Physician Wealth & Debt Report), scaled so the top is 1.0: radiology, orthopaedic and neurological surgery 1.0 · cardiology 0.9 · anesthesiology 0.8 · plastic surgery 0.75 · otolaryngology 0.7 · ob/gyn, urology, general surgery 0.65 · gastroenterology, ophthalmology 0.6 · nephrology, pathology 0.55 · emergency medicine, unlisted 0.5 · internal medicine 0.4 · dermatology, oncology, neurology 0.35 · psychiatry, family medicine 0.3 · pediatrics, rheumatology 0.25 |
| **Practice ownership** | 25 | entity strength × tenure factor. Active PLLC/PC/SC 1.0, other entity 0.6, ×0.6 if inactive. Tenure factor by years since NPI enumeration: under 10 → 1.0 · 10–20 → 0.6 · 20+ → 0.3 · unknown → 0.6. Ownership three years in is emergence; twenty years in is an established practice the pitch is too late for. |
| **Career stage** | 30 | A hump, not a ramp, by years since enumeration (licence date as fallback): under 3 → 5 pts · 3–5 → 15 · **5–15 → 30** · 15–20 → 20 · 20+ → 10 · unknown → 15 |

`points = max × strength`, strongest signal per component, duplicates never
double-count. The licence itself earns no points — it is the gate.

## 4. Timing — did something just happen? (strongest event only)

For every dated event:

```
event score = weight × 0.5 ^ (months old / 12) × identity confidence
Timing      = the highest event score
```

An event loses half its value every year: 1.0 this month, 0.71 at six
months, 0.50 at a year, 0.25 at two, 0.13 at three.

| Event | Weight | How it is detected |
|---|---:|---|
| Formed own practice | 100 | A new Medicare billing group whose name carries the doctor's surname and a practice suffix — PLLC, PC, SC (PECOS, month-to-month diff) |
| Formed own company, not a practice | 60 | The same, but an LLC or LTD — discounted the way the ownership value signal discounts it |
| Made partner / chief | 100 | Senior role keywords — **no live source today**; the hook is dormant until a source with role titles lands |
| Bought property | 80 | Cook County deed, matched by exact name and state |
| New licence, 3+ years after entering practice | 60 | A relocation: an established physician rebuilding financial relationships |
| New licence, under 3 years | 30 | A residency graduate: debt, not assets |
| Employer billing group or facility change | 30 | PECOS diff; the employer's paperwork more often than the doctor's career |

Identity confidence is the weakest merge in the profile (1.0 licence
number, 0.95 exact name, 0.6 single-source). It multiplies timing, never
value: a deed pinned to a single-source profile is worth 60% of the same
deed on a licence-verified one.

## 5. Max, min, and what the numbers mean

| | Value | Timing | Priority |
|---|---|---|---|
| Top-tier surgeon, 5–15 years in, owns an active PLLC formed this month | 100 | 100 | **100** |
| The same doctor with nothing recent | 100 | 0 | 60 |
| Pediatrics, under 3 years in, no ownership, nothing recent | 23 | 0 | **13.8** |

The live band is 13.8–100 and, since a quiet prospect keeps 60% of value,
the best raw number on a quiet week sits in the 60s. That is why the
board's bands come from standing, not from the number (§7).

Reading the two numbers together:

| Value | Timing | What to do |
|---|---|---|
| 60+ | 50+ | Call this week |
| 60+ | under 50 | Real prospect, no trigger — nurture |
| under 60 | 50+ | Something happened, but the money is thin |
| under 60 | under 50 | Skip |

## 6. Two worked examples (real prospects, 9 Sep 2026)

**David Brogan — diagnostic radiology, 9 years in, bought a house on 15 May.**
Value: specialty 45 × 1.0 = 45 · ownership 0 · career stage 30 → **75**.
Timing: property 80 × 0.5^(3.8/12) = 80 × 0.80 → **64.1** (confidence 1.0).
Priority: 75 × (0.6 + 0.4 × 0.641) = 75 × 0.856 = **64.2**. Rank #1.

**Robert Atkenson — orthopaedic surgery, 20 years in, owns his practice, nothing recent.**
Value: 45 + ownership 25 × 1.0 × 0.3 = 7.5 + career stage 10 → **62.5**.
Timing: **0**. Priority: 62.5 × 0.6 = **37.5**. A great client for whoever
already has him, and a poor prospect for a call — the tenure factor and the
career-stage hump are what moved him from #18 under the old formula.

## 7. Bands by standing

Top Prospect / Promising / Neutral / Weak / Poor come from the prospect's
**rank in the live book**: top 5% · next 15% · next 30% · next 30% · bottom
20%. #1 is always a Top Prospect; the top band always holds at least one.
Gated prospects are not counted in the book and are always Poor.

Fixed score cuts (the old 80/60/50/35) labelled nobody Top and 829 of 1,179
Weak on a book whose scores ran 22–67 — a presentation problem the maths
cannot fix. A band is relative on purpose: if the whole book improves, a
label can move without the score moving. `tier_for_standing()` in
`engine.py`; stamped per request by `RankingService`.

## 8. Rules that keep it honest

- **Strongest signal per component** — duplicates never double-count; timing
  never sums.
- **Zero rows stay visible** — "Practice ownership: 0/25" doubles as "what
  would raise this score".
- **Deterministic** — same data in, same score out. No LLM, no randomness.
- **Traceable** — every point maps to a stored signal row, every signal to
  a source record, every merge to a logged score and reason.
- **Field names are older than the formula** — the columns and API fields
  are still `qualification_score` / `timing_score` / `total_score`; the UI
  prints them as Value / Timing / Priority. No migration was needed.

## 9. Changing it, and re-scoring the book

| What | Where |
|---|---|
| Point budgets, timing weights, the floor, the band shares | `app/scoring/engine.py` (`VALUE_WEIGHTS`, `TIMING_WEIGHTS`, `TIMING_FLOOR`, `TIER_SHARES`) |
| Specialty tiers, tenure factors, career-stage bands, licence and career event fractions, the half-life | `app/scoring/detector.py` |
| The floor as an environment setting | `app/config.py` (`TIMING_FLOOR`) |
| The licence gate | `app/scoring/engine.py` (`is_rankable`) |
| The rulebook the detail page shows | `frontend/src/components/SourcesDocument.tsx` (`RULEBOOK`) |

Scores are recomputed for everyone on every sweep. To switch the whole book
without waiting for one:

```bash
python -m app.scoring --rescore --dry-run --histogram   # look first
python -m app.scoring --rescore                          # write
python -m app.summaries --all --stale                    # recompose *composed* summaries
```

Careful with the last step: after a rescore every prospect looks stale, and
`--all --stale` recomposes LLM-written summaries too. Export the facts and
regenerate the LLM summaries offline instead (`python -m app.summaries
--export-facts`), or restore them from a copy. The rescore appends one
score-history snapshot per prospect whose movement is the formula, not the
world; the board's "What changed" alert lights up once. The book was
rescored on 2026-09-09.

## 10. The formula before 2026-09-09

`total = qualification × 0.60 + timing × 0.40`, where qualification was
physician standing 40 + specialty tier 35 + ownership 25 and timing was the
**sum** of licence recency 40 + property 30 + practice entry 15 + career
advancement 15 on a staircase decay (1.0 / 0.85 / 0.6 / 0.3 / 0.1). Measured
on the real book it was indifferent to career stage (rank correlation with
years in practice +0.09), so residency graduates and 20-year practice owners
both reached the top 20, and adding timing let a poor fit with a fresh event
outrank a strong fit with a quiet month. Old score-history rows were made by
that formula.
