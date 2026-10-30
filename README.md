# dsh-skin-promax

Desktop UI skin for dsh: a 1:1 reproduction of the reference first screen and
sidebar (`reference/screenshot.png`, 2604×1480 at DPR 2 → 1302×740 CSS).

This package lives outside the repository on purpose. It is a **bundle**: it
ships a Cordis configuration layer that inserts one client plugin row, and it
is installed into a profile rather than built into the app.

## What it replaces

| Surface | Mechanism | Notes |
|---|---|---|
| Palette, radii, elevation | `ctx.theme.overrideTokens('dsh-skin-promax', …)` | Alias tokens only; both schemes are always written |
| Blank-session hero stack | `conversation.hero.content` slot | Needs the upstream seat added in `packages/client/ui-conversation` |
| Composer card | CSS variables + `[data-composer-card]` | The real `InputBar` stays mounted: IME, `@`, `/`, drag-drop and the queue are untouched |
| Sidebar shell | composition: `ui-sidebar` row disabled, this bundle registers `sidebar` | Planned (S3); the inner `sidebar.*` seats stay owned by their packages |

## Build

```sh
# tsdown comes from the dsh checkout; no local install is required to build
/Users/zctech/Code/deepseek-harness/node_modules/.bin/tsdown
```

Outputs:

- `lib/index.js` — the Host half the loader imports (registers nothing).
- `lib/client.js` — a `window.__ModuleLoader__.load({ id, factory })` closure
  factory. Only the platform modules (`react`, `@deepseek-ai/cordis`,
  `@deepseek-ai/dsh-client-ui-slots`, `…-ui-primitives`, `…-ui-dockkit`,
  `…-client-store`, `zod`, `@tanstack/react-virtual`) stay external; everything
  else is inlined, and `*.css` is inlined as a string the plugin injects itself.

## Install

```sh
dsh plugin --profile desktop add /Users/zctech/Code/dsh-skin-promax
```

Reopen the app. Remove with `dsh plugin --profile desktop remove dsh-skin-promax`.

For a source checkout, `pnpm dsh web --patch ./cordis.patch.yml` loads the same
bundle without touching the profile.

## Verify

```sh
node scripts/measure.mjs   # re-derive tokens/bboxes from the reference
```

Measured baseline (CSS px): sidebar 240.5 wide, `#FBFBFB`; main `#FFFFFF`;
hero tile 110×110 r28 with the mark at 78×72.5; title 26/600 at y 365.5;
chips 346×34 at y 427; workspace tray 736×56 at y 594.

## Known differences

- The suggestion chips stage a draft through `inputActions.setDraft`; they do
  not submit.
- `conversation.hero.content` replaces the shipped fish + headline block, so the
  `conversation.hero.brand.mark` seat is unused while this skin is active.
- Copy lives in the skin's own `skin.promax` namespace (zh + en). Other
  locales fall back to English.
- The composer is restyled, not rebuilt: any value still hardcoded in
  `InputBar.module.css` will drift by a few pixels until it is parameterized
  upstream.
