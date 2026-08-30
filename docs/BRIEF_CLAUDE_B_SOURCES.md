# Claude B — make the two Sources pages readable

You are one of two Claudes working in this repo at the same time. **Stay inside
your files.** Claude A is re-theming `globals.css` and must not collide with
you.

## Your files — do not edit anything else

```
frontend/src/app/prospect/[id]/breakdown/page.tsx     (52 lines)
frontend/src/components/BreakdownExplorer.tsx        (540 lines)  ← the big one
frontend/src/app/prospect/[id]/follow-up/page.tsx    (125 lines)
frontend/src/components/MatchEvidencePanel.tsx       (330 lines)
```

**Do not edit `globals.css`.** Claude A is rewriting it. If you need a style,
use existing Tailwind utilities and the existing `--color-*` tokens. Never
hard-code a hex value — the app is about to gain a second colour theme, and a
literal colour will not follow it.

## Shared-machine rules

- The dev server is **already running on :3000**. Do not start another; a
  second one silently lands on :3001 and shows the wrong thing.
- The backend is **already running on :8000**.
- Use `npx --no-install tsc --noEmit` to check your work. It writes nothing.
- **Do not run `npm run build`.** Claude A shares `.next/` and two builds at
  once corrupt each other.
- Do not commit. Ariel commits when both of you are done.
- Node 18 is the shell default and cannot run this project. Prefix commands
  with `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`.

## Context you need first

These two pages are **not advisor workflow**. They are the sources behind the
board — reached only from a small "Sources" footnote at the bottom of the
profile, never from a button. Their audience is an advisor asking *"how do you
know?"*, or a manager checking the model. Optimise for someone reading
carefully, not someone in a hurry.

Reach them at:

- `http://localhost:3000/prospect/<id>/breakdown`
- `http://localhost:3000/prospect/<id>/follow-up`

Get a real id with:

```
curl -s "http://localhost:8000/prospects/ranked" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])"
```

## The job

Both pages are crowded and hard to read. Make them scannable without removing
information — this is the one place in the product where the detail belongs.

### Known problems on the breakdown page

- **The same numbers appear twice on one screen.** The left "The Calculation"
  card and the right "Scoring Rules" panel both print
  `strength × weight = points` for every signal — e.g. `Practice entry —
  0.10 × 15 = 1.5` shows in both. See `BreakdownExplorer.tsx` lines ~152 and
  ~177. Deduplicating this is probably the single biggest win.
- The gates tab embeds the same arithmetic inside prose verdicts (~lines 271,
  288), which makes long sentences longer.
- The rules panel lists every band for every signal (`Within 6 months 1.00`,
  `6–12 months ago 0.85`, …) with only the active one highlighted. That is a
  lot of dimmed rows for one live value — consider whether the inactive bands
  need to be visible by default.

### Known problems on the follow-up page

- The assessment card repeats the score ring, the summary and the
  qualification/timing stats that the profile page already showed a moment
  ago.
- The supporting-signals list gives every signal equal visual weight, with
  `85% strength · 100% confidence` on each. Those percentages are model
  internals; decide whether they earn their prominence.

### Patterns already used in this codebase — reuse, don't reinvent

- `components/Collapsible.tsx` — native `<details>` panel with a title, a hint
  line and a badge. Used on the profile to fold the dossier away. Ideal for
  "show me the bands" or "show the full working".
- `components/BookView.tsx` — an exclusive accordion via
  `<details name="…">`, so opening one panel closes the others. No JS.
- `components/Citation.tsx` — the footnote-weight link style.
- The `eyebrow` utility for small caps section labels.

### Constraints

- **Do not delete information.** Fold it, group it, or defer it behind a
  disclosure — but a curious reader must still be able to reach every number
  that is there today.
- **Contrast:** body text must clear 4.5:1. Note `--color-ink-faint` is only
  2.35:1 on white — do not use it for anything a reader must actually read.
  `--color-ink-muted` (5.65:1) is the safe muted tone.
- Keep both pages working at 1024px wide as well as full width.
- `--color-*` tokens only, no hex literals. See the note above about theming.

### Definition of done

- Both pages read as calm, structured documents rather than dense screens.
- Nothing that was reachable before has become unreachable.
- `npx --no-install tsc --noEmit` passes.
- `npx --no-install eslint <your files>` is clean.

### Ariel is working with you on this one

Show a plan before large edits, and prefer one change at a time so she can
react. `BreakdownExplorer.tsx` is 540 lines — do not rewrite it wholesale in
one pass.
