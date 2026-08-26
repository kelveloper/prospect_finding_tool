# Presenting the Signals — How to Say It

Talking points for demos and pitches. The system has three layers that are
easy to tangle; this is the untangled version.

## The three-sentence version (lead with this)

> "We track **six signals** about each physician, organized into **three
> categories**: their profession, their practice ownership, and their
> financial activity. Every signal answers one of two questions — *is this
> a valuable prospect?* and *is now the right moment?* — and the score is
> **60% the first, 40% the second**."

## The elevator version (one sentence)

> "Six public-record signals, three categories, one auditable score —
> 60% how valuable the prospect is, 40% how hot the timing is."

## Drilling down, one layer at a time

**Layer 1 — the categories (what we watch).** These match the three
section cards on the candidate profile page:

| Category | Plain-English meaning |
|---|---|
| Profession | Who they are as a doctor |
| Ownership | Whether they own their practice |
| Financial activity | Big money moves |

**Layer 2 — the six signals (what we detect):**

| Category | Signals |
|---|---|
| Profession | Active license · Specialty tier · Newly licensed · Career move |
| Ownership | Bills Medicare under their own PLLC |
| Financial activity | Recent property purchase (≥ $100k, Cook County deeds) |

**Layer 3 — the scoring (how it becomes a rank):**

| Question | Weight | Signals that answer it |
|---|---|---|
| Is this a valuable prospect? (**Qualification**) | 60% | Licensed physician (40) + high-earning specialty (35) + practice owner (25) |
| Is now the right moment? (**Timing**) | 40% | New license (40/15 by source) + property purchase (30) + career move (15) — all fade as they age |

## The trap to avoid

**Do not present the three categories as if they are the score groups.**
They split across the scoring line. The clean phrasing:

> "The categories are how we organize *what we watch*; the score is
> organized by *what the evidence proves* — worth versus timing."

Example that makes it click: a new license is a **profession** fact, but
what it *proves* is **timing** (they just started earning). Ownership is an
ownership fact, and what it proves is **worth**. Same fact, different
question answered.

## Anticipated follow-up questions

- **"Where do the signals come from?"** → Four free government sources
  (NPPES, IDFPR, CMS PECOS, Cook County deeds) — see `DATA_SOURCES.md`.
- **"Why deterministic weights instead of AI?"** → The score must be
  auditable: same data in, same score out, every point traceable to a
  public record — see the FAQ in `HOW_IT_WORKS.md`.
- **"What happens when a signal changes?"** → Every ingest re-scores and
  appends to score history, so prospects visibly rise (new property) and
  sink (license ages out) — `score_change` on the board.
- **"Then what?"** → The contact kit turns the strongest signal into the
  first touch: a trigger-matched letter to the practice —
  `RESEARCH_CONTACT_OUTREACH.md`.
