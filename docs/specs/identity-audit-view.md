# Spec: Identity audit view — filter prospects by merge-evidence quality

**Status:** ready to build · **Audience:** any coding agent working in this repo
**Goal:** an internal, operator-only view ("my eyes only" — not advisor-facing) that classifies every prospect by the *quality of the identity evidence* holding their profile together, filters the ranked board by that class, and makes it easy to spot high-ranked prospects resting on weak merges.

Motivating rule (from `app/identity/resolver.py`): a profile's `identity_confidence` = the **weakest** merge in its cluster ("confidence = weakest link"). A licence-number merge is 1.0; exact name + state is 0.95; a first-initial + specialty merge squeaks by at 0.85; a single-source profile that never merged with anything sits at 0.6. The verdict (merged / not) is binary at threshold 0.80, but the certainty is not — and today that certainty is stored yet invisible on the board.

---

## 1. Current state (verified)

- `Prospect.identity_confidence` — persisted (`app/models/entities.py:44`), set by the pipeline (`app/services/pipeline.py`, `_apply`) from the resolver's weakest-link value. Single-source default is **0.6** (`resolver.py:51`, "no corroboration").
- `identity_matches` table (`entities.py:170`) — one row per merge/attach: `source_a/b`, `record_a_id/b_id`, `score`, `reason`. Reasons are human-readable strings written by `resolver.py` / `enrichment.py`: `"license number match"`, `"exact first name, same last name, same state"`, `"first initial match, …"`, `"NPI match"`, `"exact first and last name, same state"` (the name-only deed attach).
- `GET /prospects/ranked` returns `RankedProspect` (`app/schemas/api.py:27`) — currently exposes **no** identity fields.
- Frontend: `frontend/src/components/Scoreboard.tsx` renders the board; `MatchEvidencePanel.tsx` + `EvidenceBadge.tsx` already render match evidence inside the dossier/detail view — reuse their visual language, don't invent a new one.
- No auth/roles exist in this app. "My eyes only" therefore means **hidden by default, not access-controlled** (see §4) — say so honestly in any UI copy.

---

## 2. Identity tiers (computed server-side, one place)

Add a pure function (suggested: `app/identity/audit.py`) that classifies a prospect from its persisted `identity_matches` + `identity_confidence`:

| tier key | rule (weakest merge score = `identity_confidence`) | meaning |
|---|---|---|
| `certain` | 1.0 with ≥1 match whose reason contains `license number` or `NPI` | held together by a unique ID |
| `strong` | ≥ 0.95 | exact name + state corroboration |
| `barely` | 0.80 – 0.94 | cleared the threshold without certainty (e.g. first-initial + specialty at 0.85) |
| `single_source` | no identity merges at all (confidence 0.6) | one source, uncorroborated — never faced the judge |

Orthogonal boolean flags (independent of tier — a prospect can be `strong` yet unflagged or flagged):

- `license_matched` — any match with reason `"license number match"`. **This answers Kelvin's second ask directly:** filter for prospects where this is *false* = "not licence-matched, for my eyes only."
- `has_name_only_events` — any attach with reason `"exact first and last name, same state"` (score 0.9): events (deeds) pinned by name alone, the weakest attach key.
- `weakest_link` — `{score, reason, source_a, source_b}` of the minimum-score match, so the UI can say *why* a profile is `barely` ("0.85 — first initial match, npi↔idfpr").

## 3. API

Extend `RankedProspect` with the fields above (`identity_tier`, `identity_confidence`, `license_matched`, `has_name_only_events`, `weakest_link`). Always include them (it's cheap; the *UI* gates visibility) — but eager-load `identity_matches` in the ranked query to avoid N+1. Add `?tier=` filter param to `/prospects/ranked` (comma-separated tier keys) so filtering happens server-side and ranking order is preserved within the filter.

## 4. UI — the audit toggle

- **Entry point:** an "Identity audit" toggle that is *not in the normal chrome* — suggested: a small toggle inside the existing RefreshData hover panel (already the home of the dev-only Test sweep button), persisted in `localStorage`. When off (default), the board looks exactly as today; advisors never see any of this.
- **When on, the board gains:**
  - a small evidence badge per row: `● licence` (certain) / `● name` (strong) / `◐ barely 0.85` / `○ single-source` — color-ramped, using `EvidenceBadge.tsx`'s style; `barely` shows its numeric weakest score.
  - filter chips above the board: All · Certain · Strong · Barely · Single-source · **Not licence-matched** · Name-only events — with per-chip counts (e.g. "Barely (7)"). Chips drive the `?tier=`/flag filters; rank order is preserved so Kelvin can see how each class ranks.
  - hovering a `barely`/flag badge shows the `weakest_link` reason verbatim ("0.85 — first initial match, same last name, same state, same specialty").
- **The risk view (the payoff):** a one-line callout when the filtered view is All: "N of the top 20 rest on barely/single-source identity" — the exact prospects where a high score meets weak evidence, i.e. where a wrong congratulations-call could happen. Clicking it applies the Barely+Single-source filter.
- Row click still opens the existing dossier, whose `MatchEvidencePanel` shows the full receipts — this feature is the board-level index into evidence that already exists at detail level.

## 5. What else belongs here (ranked; 1–3 are cheap, build them; 4–5 optional)

1. **Tier counts in the header** of audit mode: "142 certain · 31 strong · 7 barely · 12 single-source" — the health of the whole book at a glance, and it trends sweep to sweep.
2. **Name-only-events flag on rows** (deeds attached at 0.9) — a *true* profile can still carry the one event type most exposed to a Reyes-Martin-style near-miss; this is where an operator double-checks before an advisor leads with "congrats on the house."
3. **Sort by identity_confidence** (ascending) within audit mode — weakest books first.
4. **Orphan log (needs new persistence — flag as follow-up):** discarded enrichment rows (the row-5s) are currently dropped in memory and stored nowhere (`enrichment.py:53-54` just `continue`s). Add an `unmatched_enrichments` table written by the matcher (source, record id, owner name, best score, best reason, ran_at) and a small "Discarded events" list in audit mode. This is the only item requiring a migration.
5. **CSV export** of the audited board (rank, name, score, tier, weakest reason) for offline review.

## 6. Acceptance criteria

1. With audit mode off, the board is pixel-identical to today; nothing identity-related renders.
2. Toggling audit mode on shows badges + chips; "Not licence-matched" filters to exactly the prospects with no `license number match` evidence, ranked in their normal order.
3. A `barely` prospect's badge shows its weakest score, and hover reveals the stored reason string verbatim.
4. Tier counts sum to the total prospect count; chips + counts agree with the API filter results.
5. `/prospects/ranked?tier=barely,single_source` returns only those tiers, ordered by score; no N+1 (verify query count).
6. The single-source tier correctly includes prospects with zero `identity_matches` rows (confidence 0.6) — including ones created before this feature.
7. Existing tests stay green (`pytest tests/`); new tier-classification logic has unit tests covering each tier boundary (0.79 vs 0.80, 0.94 vs 0.95, no-matches).

## 7. Out of scope

Real access control (no auth system exists — the toggle hides, it does not protect); changing any matching threshold or rule; persisting discarded rows beyond the optional §5.4 follow-up; advisor-facing display of identity mechanics.
