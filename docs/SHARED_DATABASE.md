# Shared Database — One Board for Everyone

By default each clone uses its own local SQLite file (`prospects.db`,
gitignored) — fine solo, wrong for a team or a deployment. Two ways to
share, both zero-code:

## Option A — one shared backend, SQLite stays local (no external service)

Share the API, not the file. ONE machine keeps `prospects.db` and runs
the backend; everyone else points their frontend at it:

```
# friends' frontend .env.local — no backend needed on their machines
NEXT_PUBLIC_API_URL=http://<host-address>:8000
API_URL=http://<host-address>:8000
```

Address options: LAN IP for same-wifi (`ipconfig getifaddr en0`),
Tailscale for over-the-internet (free, private), `ngrok http 8000` for a
throwaway demo URL. SQLite is safe here because the single backend
process remains its only writer.

Trade-offs: the host machine must be on, and the API has no auth — share
the address only with people you trust. **Never** share the .db file
itself via Dropbox/Drive sync (SQLite corruption risk) or by committing
it to git (binary merge conflicts, feedback clobbering).

## Option B — hosted Postgres (survives the host laptop closing)

The app is already wired for it: `database_url` comes from `.env`
(pydantic-settings), the engine handles Postgres, and `psycopg2-binary`
is in requirements. Neon and Supabase are merely convenient free tiers —
any Postgres works (Railway, RDS, a $5 VPS), or Turso if you prefer to
stay SQLite-flavored. **No code changes — just configuration.**

### Postgres setup (once, ~10 minutes)

1. **Create a free hosted Postgres.** Neon (neon.tech) or Supabase — both
   free tiers are plenty for this data volume (~200 prospects ≈ nothing).
   Copy the connection string; it looks like:
   `postgresql://user:password@host/dbname?sslmode=require`

2. **Everyone puts the same URL in their local `.env`** (create the file
   at the repo root if missing — it is gitignored, never commit it):

   ```
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   ```

3. **Restart the backend.** On first boot `create_all` creates every
   table automatically. Load the UI once — the auto-ingest seeds the
   shared board.

That's it. Everyone now sees the same prospects, the same scores, the
same score history, the same field changes, and — importantly — the
same **feedback**: verdicts one advisor records are visible to all.

## Team rules of the road

- **One ingester at a time.** `Prospect.npi` is unique, so simultaneous
  ingests from two machines can't duplicate people (the second insert
  fails), but they can waste API calls and produce confusing partial
  errors. Convention: one person (or, later, the scheduler) runs
  `POST /ingest/run`; everyone else just reads.
- **Score history and field changes are shared memory now.** Every
  ingest appends snapshots for the whole team — arrows, sparklines, and
  What Changed cards mean the same thing on every screen.
- **Switching back to local:** delete the `DATABASE_URL` line from
  `.env` and you're on your private SQLite again.

## Before a real deployment (not needed for team-sharing)

- **Alembic migrations** — `create_all` creates tables but never alters
  them; the first schema *change* after going shared needs real
  migrations (already on the PROGRESS roadmap).
- **Auth on the API** — the endpoints are open; fine on localhost,
  mandatory to fix before exposing a shared backend to the internet.
- **Hosted API + frontend** — the same `.env` mechanism works wherever
  the backend runs (Railway/Render/Fly for FastAPI, Vercel for the
  Next.js app with `NEXT_PUBLIC_API_URL` pointed at it).
