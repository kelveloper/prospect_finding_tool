# Claude A — client-facing colour theme

You are one of two Claudes working in this repo at the same time. **Stay inside
your files.** Claude B is editing the two Sources pages and must not collide
with you.

## Your files — do not edit anything else

```
frontend/src/app/globals.css        ← the theme lives here
frontend/src/lib/style.ts           ← style names shown in the menu
frontend/src/components/ViewerMenu.tsx
```

If a change seems to need a component outside this list, **stop and ask** —
that is almost certainly Claude B's territory or shared ground.

## Shared-machine rules

- The dev server is **already running on :3000**. Do not start another; a
  second one silently lands on :3001 and shows the wrong thing.
- The backend is **already running on :8000**.
- Use `npx --no-install tsc --noEmit` to check your work. It writes nothing.
- **Do not run `npm run build`.** Claude B shares `.next/` and two builds at
  once corrupt each other.
- Do not commit. Ariel commits when both of you are done.
- Node 18 is the shell default and cannot run this project. Prefix commands
  with `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`.

## The job

Make **Client view** a real theme: a JPMorgan-Chase-style client-facing look
in their brown/bronze palette, replacing today's blue.

### How theming already works — read this before changing anything

The plumbing is built and working. You are filling it in, not inventing it.

1. `src/lib/style.ts` declares the styles. `STYLES` currently holds `advisor`
   and `client`. Each has a `label` and a `hint` shown in the menu.
2. The avatar in the nav bar (`ViewerMenu.tsx`) writes the chosen style to a
   `data-style` attribute on `<html>` and remembers it in `localStorage`.
3. A small script in `<head>` re-applies it **before the first paint**, so the
   page never renders one theme and snaps to another. See `STYLE_SCRIPT` in
   `style.ts`; it mirrors `LAUNCH_GUARD_SCRIPT` in `lib/session.ts`.
4. Any CSS can then key off it:

```css
[data-style="client"] .something { ... }
```

### The tokens to re-map

`globals.css` defines the palette in a Tailwind v4 `@theme` block — **25
`--color-*` tokens**, grouped as brand/ink, surfaces, and tier accents. Every
component consumes these; almost nothing hard-codes a colour.

**That is the whole trick: override the tokens under `[data-style="client"]`
and the entire app restyles.** You should not need to touch a single component.

```css
[data-style="client"] {
  --color-brand: <bronze>;
  --color-ink: <warm near-black>;
  /* …and so on for the tokens that carry the look */
}
```

Work token by token. Anything you leave alone keeps its advisor value, which
is a reasonable fallback.

### Constraints

- **Contrast is not optional.** Body text must clear **4.5:1** against its
  background. There is a real precedent here: `--color-ink-faint` measures
  2.35:1 on white and had to be replaced in one panel for exactly this reason.
  Check every foreground/background pair you introduce.
- **Keep the tier accents legible.** Strong/promising/neutral/weak/poor must
  stay distinguishable from one another after re-mapping, and ideally still
  read as good→bad.
- **Client view is colour only — it must not hide anything.** Both views show
  identical content; only the palette differs. An earlier draft of this brief
  said otherwise and shipped two `display: none` rules (`.sources-note`,
  `.viewer-sid`) at the bottom of `globals.css`. Delete them.
- Do not rename tokens or change the `@theme` block's advisor values —
  advisor view must look exactly as it does today.

### Definition of done

- Toggling **Client view** from the avatar menu restyles the whole app.
- Toggling back to **Advisor view** returns it to today's blue exactly.
- The choice survives a refresh with no flash of the wrong theme.
- `npx --no-install tsc --noEmit` passes.
- Every text/background pair you introduced clears 4.5:1.

### Worth knowing

- Ariel has not specified exact JPMC hex values. Propose a palette and show it
  before applying all 25 tokens — it is much cheaper to correct three colours
  than twenty-five.
- Adding a third style later is one entry in `STYLES` plus its CSS block; the
  menu builds itself from that list. Do not hard-code style names in the menu.
