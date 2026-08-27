# ProspectIQ — Frontend

Next.js UI for the Emerging Affluent Prospecting backend (originally scaffolded
in the KelvinSucksEggs repo, now integrated here and wired to live endpoints).

## Pages

- `/` — scoreboard: ranked list on the right, the selected prospect's **full
  profile** on the left — hero (score ring, tier bar, tags, identity trust
  badge) over the dossier: Career Signal / Ownership & Practice / Financial
  Activity, What Changed, Contact Kit and the Score Breakdown summary
  (`GET /prospects/ranked` + `GET /prospects/{id}`; one click on a card swaps
  the profile via `/?id=…`). Auto-triggers a LIVE `POST /ingest/run` when the
  database is empty — the first load takes a minute or two while real
  government APIs are queried.
- `/candidate/[id]/breakdown` — full score & match breakdown: the gates, the
  per-signal calculation and the identity match evidence (`GET /prospects/{id}`)
- `/candidate/[id]/follow-up` — supporting signals with source badges +
  advisor feedback panel (`POST /feedback`, `GET /prospects/{id}/feedback`)

## Run

Start the backend first (from the repo root):

```bash
.venv/bin/uvicorn app.main:app --port 8000
```

Then:

```bash
npm install
npm run dev        # http://localhost:3000
```

The API base URL defaults to `http://localhost:8000`; override via
`.env.local` (see `.env.local.example`).
