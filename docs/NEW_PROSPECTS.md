# New prospects — how the book stays current

## What "new" means

A prospect is **new** for 48 hours after its row is first created by an
ingest (`Prospect.created_at`). The backend exposes this as `is_new` on
every row of `GET /prospects/ranked`; no schema migration or manual
flagging involved — it ages out on its own.

## What the advisor sees

- **NEW badge** on the prospect's card in the ranked list (green pill
  next to the name, tooltip explains the 48-hour window).
- **Alert on top of the list**: when any prospect in the book is new, a
  banner renders above the cards — "✨ N new prospects since the last
  ingest — look for the NEW badge below." When nothing is new, the
  banner does not render at all; its presence always means something.

## Why summaries don't go stale when new prospects arrive

Advisor summaries (`advisor_summary`, written by `python -m
app.summaries`) deliberately never mention rank or percentile — the UI
computes "#N of M · Top X%" live from the ranked list on every page
load. So a new arrival re-ranks the book instantly and correctly, and
existing summaries stay true. A summary only goes stale when the
prospect's *own* facts change.

## The refresh workflow after an ingest

```
python -m app.summaries --all --stale            # instant composed text for new/changed rows
python -m app.summaries --export-facts f.json --stale   # facts for just those rows
# ...generate LLM summaries offline from f.json...
python -m app.summaries --import-file s.json     # replaces composed text, source="llm"
```

`--stale` selects prospects with no summary, facts updated since the
summary was generated, or outreach logged since. After a typical ingest
that is a handful of rows — never the whole book.
