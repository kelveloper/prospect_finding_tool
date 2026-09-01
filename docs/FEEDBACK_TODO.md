# Manager feedback — status

Tracking the 17 items from the review. Product items were verified against the
code on the date below; slide items are tracked but live outside this repo.

**Last verified:** 2026-08-30, at `0bd1af0` plus uncommitted book-view and
citation work.
**Deadline:** before the next connect (item 17).

Score: **4 of 16 done**, 3 partial, 9 open. Item 17 is the deadline itself.

---

## Demo / Product — Prospect IQ

### ✅ 12 · Score in context

Percentile is computed live and shown as standing rather than a bare mark, so
`61.6/100` no longer reads like a failing grade.

- `frontend/src/components/CandidateDetail.tsx` — `percentile`, rendered as
  "#1 of 194 · Top 1%"

Still open from the same item: the **richer qualitative description** half
depends on item 16.

### ✅ 13 · Book view

Toggle switches the board between the scoreboard and the book. Every column an
entry prints is sortable both directions, with filters on the columns that
carry them — Excel-style menus on the column headings.

- `frontend/src/components/BookView.tsx` — column menus, sort + filter
- `frontend/src/components/ViewToggle.tsx`, `frontend/src/lib/view.ts`

| Column | Sort | Filter |
| --- | --- | --- |
| # / Fit | Best ↔ lowest first | — |
| Prospect · Specialty | A–Z ↔ Z–A | by specialty |
| Move | Biggest risers ↔ fallers | — |
| Tier | Strong ↔ poor first | by tier |

Plus a free-text look-up over name, specialty and city.

> Note: `Move` is correct but inert until a second ingest exists —
> `score_history` is empty, so every `score_change` is null.

### ✅ 14 · Conversion feedback

Five outcomes recorded per prospect, beyond the old good/bad/save.

- `frontend/src/components/OutreachActions.tsx` — Connected · Couldn't Reach ·
  Follow Up Later · **Became Client** · Didn't Work Out, with channel + notes
- `app/outreach/tracking.py`, `app/repositories/outreach_repo.py`,
  `outreach_events` table

### ⚠️ 16 · LLM summaries — pipeline built, content not generated

The whole path exists and is unused.

- `app/summaries/__main__.py` — `--export-facts` → offline LLM →
  `--import-file`, plus `--stale` to touch only what changed
- `app/summaries/composer.py` — deterministic fallback
- `prospects.advisor_summary` / `summary_source` / `summary_generated_at`

**Blocking fact: 0 of 194 prospects have a summary.** The UI already prefers
`advisor_summary` over `reason_summary`, so filling this in is a content task,
not a code one.

- [ ] Pick the prospects the demo actually clicks through
- [ ] `python -m app.summaries --export-facts facts.json`
- [ ] Write summaries in LLM Suite
- [ ] `python -m app.summaries --import-file summaries.json`
- [ ] Spot-check that they read better than the composed fallback

### ⚠️ 10 · Hide the raw scoring math — reframed, not yet trimmed

**Done — the advisor flow no longer pushes anyone at the model.** Both routes
into explainability were the loudest things on the profile: a full-width
brand button ("Supporting Signal Evidence") and a whole-card link into the
breakdown. They are now footnote-weight citations under a "Sources" heading,
so a busy advisor reads past them and a sceptical one can still follow them.

- `frontend/src/components/Citation.tsx` — small, muted, dotted underline
- `frontend/src/components/CandidateDetail.tsx` — "Sources" block; one beside
  the score itself
- `frontend/src/components/ScoreBreakdownCard.tsx` — summary card again, no
  longer a giant link

The only emphasised action left on the profile is **Log The Outcome**, which
is what the advisor is actually there to do.

**Still open — the math itself.** `strength × weight = points` renders at four
sites on the breakdown page.

- [x] Deleted `frontend/src/components/ScoreCalculation.tsx` — 150 lines of
      dead code duplicating the live calculation card, imported by nothing.
      Its entry in `PRESENTATION.md`'s component list was stale too.
- [x] `frontend/src/components/SourcesDocument.tsx` — was lines 152, 177, 271,
      288. Note 152 and 177 print the *same* products twice on one screen.

> Judgement call: now that the page is framed as backend explainability rather
> than advisor work, keeping the math *there* may be right — it is the "here's
> how scoring works behind the scenes" aside the feedback asked for. What
> mattered was that it stopped competing for advisor attention.

### ❌ 11 · Reorder the demo flow

There is no middle step. The app goes profile → full breakdown, with nothing
simplified in between.

Current routes: `/`, `/prospect/[id]/sources` (the old `/breakdown` and
`/follow-up` routes redirect into its anchors).

- [ ] Build the simplified category-scoring view
- [ ] Order the demo: profile → simple categories → breakdown last, framed as
      backend explainability

### ❌ 15 · Move to action

No click-to-contact anywhere: zero `tel:` or `mailto:` links in the frontend.
`OutreachActions` records what happened *after* a touch; nothing helps make it.

Also note commit `26aa4c1` **dropped letter drafts from the backend**, so there
is currently no generated outreach message at all.

- [ ] `tel:` on the practice line
- [ ] Generate a recommended email/message (pairs with item 16 — dummy it)
- [ ] Decide whether letter drafts come back or email replaces them

---

## Presentation / Slides

No deck in this repo, so these are tracked but unverified here.

- [ ] **1 ·** Slide 2 — say which population the 23,600 covers (Illinois? US?)
- [ ] **2 ·** Restructure to SCQA; state the answer within the first ~2 minutes,
      before slide 4, not slide 10. Christina is sending a skill to evaluate the
      deck against SCQA.
- [ ] **3 ·** Slide 5 — explain NPPES, PECOS, IDFPR in context on first use
- [ ] **4 ·** Slide 5 — wrap "a missing goal is safer than attaching another
      person's evidence" in its why: confident validated recommendations beat a
      higher count of loose ones
- [ ] **5 ·** Slide 6 — concrete examples for specialty earning, active license
      and standing, and a one-line reason a PLLC outranks an LLC
- [ ] **6 ·** Slide 7 — kill the eye chart; blow up one image or drop the slide
      (Yash's recommendation) since the demo covers it
- [ ] **7 ·** Slide 8 — merge or cut; qualification-vs-timing overlaps earlier
      slides
- [ ] **8 ·** Slide 9 — likely cut; keep a high-level line up front and move the
      detail into the demo
- [ ] **9 ·** Add the missing architecture slide — asked for last time too.
      Source material: `docs/HOW_IT_WORKS.md`, `docs/PROJECT_SPEC.md`

---

## Logistics

- [ ] **17 ·** Everything above lands before the next connect, which starts the
      presentation circuit

---

## Beyond the review

A competitive UX pass against Catchlight, Aidentified and Apollo produced four
further changes — see **[RESEARCH_COMPETITIVE_UX.md](RESEARCH_COMPETITIVE_UX.md)**.

The one that bears on item 10: the market's standard is a per-signal
contribution list next to the score, so hiding ours ran against the grain.
Writing them as points (`+16 of 35`) rather than arithmetic
(`0.45 × 35 = 15.8`) satisfies both the feedback and the convention.

---

## Suggested order

1. **16** — content task, unblocks the richer-summary half of 12
2. **15** — `tel:` is quick; the message half leans on 16
3. **11** — the one genuinely new screen
4. **10** — one open question: does the math stay on the breakdown page now
   that nothing pushes an advisor there?
5. **9** — architecture slide, twice-asked
6. Remaining slide items
