# Outreach capture — UI contract (backend ↔ frontend)

Agreed direction: **no separate feedback page or panel.** The advisor's
flow on a profile is score → summary → Reach Out, and the outcome
capture lives inline under the contact tiles — it is the last thing
they do before moving to the next prospect. (The old good-fit /
revisit-later feedback feature is removed; outcomes replace it.)

## The inline controls ("Log The Outcome")

- **Connected** → `POST /prospects/{id}/outreach` `{"event_type": "connected", "channel": "phone"}`
- **Couldn't Reach** → reason modal, then `{"event_type": "not_connected", "notes": "<reason>"}`
- **Follow Up Later** → reason modal **with date picker**, then
  `{"event_type": "follow_up_later", "notes": "<what they said>", "follow_up_on": "2026-11-15"}`
- **Became Client** → `{"event_type": "converted"}`
- **Didn't Work Out** → reason modal, then `{"event_type": "not_converted", "notes": "<reason>"}`

`channel` is optional: `"mail" | "phone" | "email" | "other"`.
`occurred_at` (ISO date) is optional and defaults to today.
`follow_up_on` applies only to `follow_up_later`.

## What the backend gives back

- `POST /prospects/{id}/outreach` → `201` with the stored event
  (`id, prospect_id, event_type, channel, notes, occurred_at, follow_up_on, created_at`).
  `404` unknown prospect, `422` invalid event_type.
- `GET /prospects/{id}/outreach` → newest-first event list. Rendered as
  the "Last action" line under the buttons (includes "circling back
  <date>" when a follow-up is set).
- Every row in `GET /prospects/ranked` carries:
  - `outreach_status`: latest event type or `null` — status chips and
    the book-view column.
  - `is_new`: created within the last 48 h — NEW badge + list-top alert
    (see docs/NEW_PROSPECTS.md).
  - `advisor_summary` / `summary_source`: the narrative for "Why This
    Prospect, Now" (falls back to `reason_summary` when null).
- `GET /analytics/outreach-funnel` → conversion by score band (not
  advisor-facing; the model-recalibration view).
