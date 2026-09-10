# Docs

Nineteen documents and four visuals, flat on purpose — they cross-reference each
other as siblings, so nesting them into folders would break roughly two dozen
links for no gain. Read top to bottom: the sections below run from *decide this*
through *how it works* to *why we chose it*.

## Decide first

Open questions where the code and the pitch disagree. Nothing here is broken in
production, but each one changes what the product claims.

| | |
|---|---|
| [`OWNERSHIP_TENURE_BIAS.md`](OWNERSHIP_TENURE_BIAS.md) | The ownership signal has no date, so it selects for physicians established for twenty years — the opposite of the thesis. Three options, one recommendation |
| [`KNOWN_GAPS.md`](KNOWN_GAPS.md) | Four things that are wrong or misleading on screen, found while demoing — starting with out-of-state doctors labelled Illinois |

## Start here

| | |
|---|---|
| [`../README.md`](../README.md) | What the platform is, the pipeline, the API |
| [`../QUICKSTART.md`](../QUICKSTART.md) | Running locally in ~3 minutes |
| [`USER_JOURNEY.md`](USER_JOURNEY.md) | The demo script, and what to point at on a live board |

## How it works

| | |
|---|---|
| [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md) | Pipeline mechanics, plus the demo-day FAQ |
| [`RANKING.md`](RANKING.md) | The scoring math, with worked examples — the single source of truth |
| [`DATA_SOURCES.md`](DATA_SOURCES.md) | The four live pulls: what each gives us, field by field |
| [`SHARED_DATABASE.md`](SHARED_DATABASE.md) | Running one board for a team instead of a local SQLite file |
| [`HANDOVER.md`](HANDOVER.md) | Engineering handover and code analysis |

## Product decisions

| | |
|---|---|
| [`PRESENTING_SIGNALS.md`](PRESENTING_SIGNALS.md) | How to talk about the three layers without tangling them |
| [`NEW_PROSPECTS.md`](NEW_PROSPECTS.md) | What "new" means, and how the book stays current |
| [`OUTREACH_UI_CONTRACT.md`](OUTREACH_UI_CONTRACT.md) | Where outcome capture lives, and why it is not a separate page |
| [`FEEDBACK_TODO.md`](FEEDBACK_TODO.md) | The 17 manager-review items and their status |
| [`PROGRESS.md`](PROGRESS.md) | What is built, what is next, and where AI fits |
| [`FIX_SUBSPECIALTY_SCORING.md`](FIX_SUBSPECIALTY_SCORING.md) | Why cardiologists were scored as GPs, and what the fix changed |

## Presenting

| | |
|---|---|
| [`PRESENTATION.md`](PRESENTATION.md) | Everything needed to present the build — proven vs inferred, screen by screen |

## Research (dated decision records)

| | |
|---|---|
| [`RESEARCH_COMMERCIAL_SOURCES.md`](RESEARCH_COMMERCIAL_SOURCES.md) | Paid vendor upgrades per pillar, and a sensible buy order |
| [`RESEARCH_CAREER_SIGNAL.md`](RESEARCH_CAREER_SIGNAL.md) | Choosing a real source for career moves |
| [`RESEARCH_PROPERTY_SIGNAL.md`](RESEARCH_PROPERTY_SIGNAL.md) | Choosing a real source for property purchases |
| [`RESEARCH_CONTACT_OUTREACH.md`](RESEARCH_CONTACT_OUTREACH.md) | Channels and contact data once a prospect is ranked |
| [`RESEARCH_COMPETITIVE_UX.md`](RESEARCH_COMPETITIVE_UX.md) | How competing tools present a prospect, and what we took from them |
| [`RESEARCH_TALKING_POINTS.html`](RESEARCH_TALKING_POINTS.html) | Conversation starters: what data exists, what it costs, what it is allowed to do |

## Visuals

Standalone HTML pages — open them in a browser. One traces a single
physician through the engine, one is the script for presenting it live,
and one draws the same system at five levels of detail.

| | |
|---|---|
| [`visuals/one-doctor-trace.html`](visuals/one-doctor-trace.html) | One invented physician's five rows traced from the first query to her score |
| [`visuals/demo-for-team-lead.html`](visuals/demo-for-team-lead.html) | Intro and demo for a one-to-one, with the answers to the questions that actually get asked |
| [`visuals/diagram-levels.html`](visuals/diagram-levels.html) | The same system drawn five ways, each adding one idea &mdash; stop at whichever level lands |

## Historical

| | |
|---|---|
| [`PROJECT_SPEC.md`](PROJECT_SPEC.md) | The original backend prototype spec |
