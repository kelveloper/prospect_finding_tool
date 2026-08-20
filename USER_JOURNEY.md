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

Open **http://localhost:3000** — the scoreboard auto-ingests the showcase
data on first load. That's it.

Useful extras:

```bash
# Reset the database (fresh ingest on next page load)
rm prospects.db

# Pull REAL Illinois physicians instead of the showcase cast
curl -X POST "localhost:8000/ingest/run?mode=live&state=IL&limit=25"

# Interactive API docs
open http://localhost:8000/docs

# Run the test suite (40 tests)
.venv/bin/python -m pytest tests/ -q
```

> Note: switching between sample and live data? Delete `prospects.db`
> first so the boards don't mix.

## The user journey (demo script)

**Persona:** a wealth-management advisor looking for their next client.

1. **Scoreboard (`/`)** — ranked physician prospects, highest fit first.
   The featured panel shows the #1 prospect: score ring, tier badge,
   qualification/timing stats, plain-English summary, and signal tags
   ("Practice Owner", "Recent Property Purchase").

2. **Click "View More" → Candidate dossier (`/candidate/{id}`)** — the
   full evidence, one card per dimension:
   - **Career Signal** — license status, issue date, specialty, recent advancement
   - **Ownership** — their PLLC/LLC: entity name, formation date, source, strength
   - **Financial Activity** — property purchase: address, price, date, source
   - **Identity Resolution** — which datasets corroborated this person, at what confidence
   - **Score Breakdown** — the 60/40 math, fully traceable
   - **Practice Location** — address and phone

3. **"Review & Give Feedback" (`/candidate/{id}/follow-up`)** — why they
   ranked here: every supporting signal with strength/confidence bars, then
   the advisor verdict: **Good Fit / Revisit Later / Not a Fit** + notes.

4. **Verdict is stored** — building the labeled dataset a future scoring
   model calibrates against. (No retraining in the prototype, by design.)

## The demo cast (sample mode)

| Prospect | Score | The story to tell |
|---|---|---|
| **John A Smith** | 89.2 | The hero: ortho surgeon, licensed 8mo ago, formed **Smith Orthopedics PLLC** 5mo ago, bought a **$985k property** 2mo ago — the full career → ownership → financial-event chain |
| **David Chen** | ~77 | Recently licensed dermatologist + fresh property purchase; also shows fuzzy identity matching ("D Chen" ≡ "David Chen") |
| **Maria Gonzalez** | ~76 | Cardiologist with her own PLLC — strong qualification, timing cooling off |
| **Robert Kaplan** | ~72 | Perfect career signals + new attending role, but no ownership yet |
| **Priya Raman** | ~67 | **Career advancement**: named Partner 4 months ago |
| **Sarah Okafor** | ~45 | The contrast: owns an LLC and property, but everything is *old* — weak timing |
| **Emily Tran** | ~36 | Inactive license; Ownership/Financial cards show "None on record" |
| **Michael Brooks** | ~28 | Bottom of the board: standard specialty, no signals, enumerated 2017 |

**Suggested path:** Scoreboard → Smith's dossier (the three signal cards) →
his follow-up page (signal evidence + cast a verdict) → back to the board →
click Okafor or Tran to show the contrast → mention live mode pulls 194
real IL physicians with real verified licenses.
