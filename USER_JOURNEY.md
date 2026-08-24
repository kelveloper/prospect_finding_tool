# User Journey & Quick Setup

## Quick setup

```bash
# Terminal 1 — backend (FastAPI on :8000)
cd prospect_finding_tool
source .venv/bin/activate
uvicorn app.main:app --port 8000

# Terminal 2 — frontend (Next.js on :3000)
cd prospect_finding_tool/frontend
npm run dev
```

Open **http://localhost:3000**. On first load the scoreboard ingests
**real data live** — ~200 Illinois physicians from NPPES, license-verified
against IDFPR, enriched with PECOS billing groups and Cook County deeds.
The first load takes a minute or two (four government APIs); after that
it's instant.

Useful extras:

```bash
# Re-ingest fresh live data (e.g. after CMS's monthly PECOS refresh)
rm prospects.db   # then reload the scoreboard, or:
curl -X POST "localhost:8000/ingest/run?state=IL&limit=25"

# Bigger cohort (up to 200 per specialty)
curl -X POST "localhost:8000/ingest/run?state=IL&limit=100"

# Interactive API docs
open http://localhost:8000/docs

# Run the test suite (uses offline fixtures, never external APIs)
.venv/bin/python -m pytest tests/ -q
```

## The user journey (demo script)

**Persona:** a wealth-management advisor looking for their next client.

1. **Scoreboard (`/`)** — real Illinois physicians ranked by fit. The
   featured panel shows the #1 prospect: score ring, tier, qualification/
   timing stats, plain-English summary, signal tags.

2. **Click "View More" → Candidate dossier (`/candidate/{id}`)** — the
   evidence: identity trust badge (which government datasets corroborated
   this person, at what confidence), then Career Signal, Ownership &
   Practice, Financial Activity, and the expandable Score Breakdown.

3. **"Review & Give Feedback" (`/candidate/{id}/follow-up`)** — every
   supporting signal with its source badge (NPI, IDFPR, PECOS,
   COOK_COUNTY) and strength/confidence bars, then the advisor verdict:
   **Good Fit / Revisit Later / Not a Fit** + notes.

4. **Verdict stored** — building the labeled dataset future scoring
   calibration will learn from.

## What to look for on a live board

Live data changes as registries update, so point at **archetypes**, not
fixed names. On the 2026-08 pull these were:

| Archetype | Example found | The story |
|---|---|---|
| **New-to-market surgeon** | Plastic surgeon, Rockford — IL license issued *this month*, NPI 15 yrs old | Experienced physician who just relocated to Illinois: new income, no local advisor |
| **Fresh attending** | Ortho surgeon, Chicago — licensed 3 months ago, NPI 5 yrs | Just finished training; surgeon income starts now |
| **Practice owner** | Dermatologist, Chicago — bills Medicare under her own PLLC | PECOS ownership inference; elite qualification, weak timing |
| **Property buyer** | Ortho surgeon — $1.6M Cook County purchase 15 months ago | The financial-event signal lifting a mid-board prospect |
| **Low-signal contrast** | Pediatrics, enumerated 2017, nothing recent | Why the bottom of the board is the bottom |

**Q&A prep:** likely audience questions (what is PECOS, how do datasets
join, where's the AI, why are scores capped ~62 today) are answered in the
FAQ at the bottom of `HOW_IT_WORKS.md`.

**Caveat for any audience:** these are real people from public records —
the board is research output, not a vetted outreach list.
