# Presenting the Signals — How to Say It

Talking points for demos and pitches. The system has three layers that are
easy to tangle; this is the untangled version.

## The three-sentence version (lead with this)

> "We track **seven signals** about each physician, organized into **three
> categories**: their profession, their practice ownership, and their
> financial activity. Every signal answers one of two questions — *is this
> a valuable prospect?* and *is now the right moment?* — and the priority is
> **the first, multiplied by how fresh the second is**."

## The elevator version (one sentence)

> "Seven public-record signals, three categories, one auditable number —
> how much money is there, times how recently something happened."

## Drilling down, one layer at a time

**Layer 1 — the categories (what we watch).** These match the three
section cards on the candidate profile page:

| Category | Plain-English meaning |
|---|---|
| Profession | Who they are as a doctor |
| Ownership | Whether they own their practice |
| Financial activity | Big money moves |

**Layer 2 — the seven signals (what we detect):**

| Category | Signals |
|---|---|
| Profession | Active license · Specialty wealth tier · Career stage (years in) · Newly licensed · Career move |
| Ownership | Bills Medicare under their own PLLC |
| Financial activity | Recent property purchase (≥ $100k, Cook County deeds) |

**Layer 3 — the scoring (how it becomes a rank):**

| Question | How it combines | Signals that answer it |
|---|---|---|
| Is there money here? (**Value**, adds to 100) | the base | Specialty wealth tier (45) + practice owner, discounted by tenure (25) + career stage, peaking at 5–15 years in (30) |
| Did something just happen? (**Timing**, strongest event) | a multiplier from ×0.6 to ×1.0 | Formed own practice (100) · property purchase (80) · relocation licence (60) · first licence (30) · employer group change (30) — halving every year |

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

- **"What's a 100% prospect? When would we see one?"** → Never on first
  ingestion — the day-one ceiling is **91** (career signal needs a
  later-sync diff to fire; full ownership proof needs registry data). Points
  above 91 are earned only by monitoring over time — full answer in the
  `HOW_IT_WORKS.md` FAQ.
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
