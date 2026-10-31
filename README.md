# dsh-theme-promax

Desktop UI skin for dsh: a 1:1 reproduction of the reference first screen and
sidebar (`reference/screenshot.png`, 2604×1480 at DPR 2 → 1302×740 CSS).

This package lives outside the repository on purpose. It is a **bundle**: it
ships a Cordis configuration layer that inserts one client plugin row, and it
is installed into a profile rather than built into the app.

## What it replaces

| Surface | Mechanism | Notes |
|---|---|---|
| Palette, radii, elevation | `ctx.theme.overrideTokens('dsh-theme-promax', …)` | Alias tokens only; both schemes are always written |
| Blank-session hero stack | `conversation.hero.content` slot | Needs the upstream seat added in `packages/client/ui-conversation` |
| Composer card | CSS variables + `[data-composer-card]` | The real `InputBar` stays mounted: IME, `@`, `/`, drag-drop and the queue are untouched |
| Rename dialogs (workspace, session) | CSS scoped by `[role='dialog']:has(input[class*='_renameInput'])` | 420×185 card, 20px title, 36px field, 62×32 buttons; the hint line under the title is skin copy injected as `::before` |
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
dsh plugin --profile desktop add /Users/zctech/Code/dsh-theme-promax
```

Reopen the app. Remove with `dsh plugin --profile desktop remove dsh-theme-promax`.

For a source checkout, `pnpm dsh web --patch ./cordis.patch.yml` loads the same
bundle without touching the profile.

## Verify

```sh
node scripts/measure.mjs   # re-derive tokens/bboxes from the reference
node scripts/shot-rename.mjs --log /tmp/dsh-web.log   # capture both rename dialogs
node scripts/compare-rename.mjs reference/rename.png .artifacts/dialog-session.png
```

Measured baseline (CSS px): sidebar 240.5 wide, `#FBFBFB`; main `#FFFFFF`;
hero tile 110×110 r28 with the mark at 78×72.5; title 26/600 at y 365.5;
chips 346×34 at y 427; workspace tray 736×56 at y 594.

## Known differences

- The suggestion chips stage a draft through `inputActions.setDraft`; they do
  not submit.
- `conversation.hero.content` replaces the shipped fish + headline block, so the
  `conversation.hero.brand.mark` seat is unused while this skin is active.
- Copy lives in the skin's own `theme.promax` namespace (zh + en). Other
  locales fall back to English.
- The composer is restyled, not rebuilt: any value still hardcoded in
  `InputBar.module.css` will drift by a few pixels until it is parameterized
  upstream.
- Only the two rename dialogs take the reference's card; the delete-workspace
  dialog in the same menu keeps the shipped modal, because it was not part of
  the reference capture.
- The rename hint is a `::before` on the dialog body, so it is painted copy: it
  is not selectable and screen readers do not read it. A `description` prop
  upstream would replace it cleanly.
