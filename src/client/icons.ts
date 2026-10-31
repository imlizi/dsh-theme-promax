/**
 * Product icon overrides.
 *
 * Every icon in the app is a `<svg data-icon="dsw-icon-…"><use href="#…"/></svg>`
 * pointing at one `<symbol>` in a hidden sprite that ui-theme prepends to
 * <body>. The artwork therefore lives in one place per glyph, and swapping it
 * is a sprite edit rather than a component fork.
 *
 * Two ways in, both ending in {@link ICON_OVERRIDES}:
 *   - a whole sprite, imported by `scripts/import-sprite.mjs` into
 *     `sprite-data.ts` (regenerate rather than edit);
 *   - individual entries in {@link ICON_REPLACEMENTS}, which win over the
 *     imported sprite.
 *
 * ui-theme also accepts replacements through `ThemeDefinition.icons`, but that
 * field rides the *registered* theme: using it means registering a theme and
 * calling `setTheme`, and the runtime's settings adoption immediately writes
 * the durable preference (`light` / `dark` / `system`) back over any custom id,
 * so the replacement is undone on the next settings echo — verified against
 * 0.2.2-alpha.2. The sprite itself is a plain DOM node, so the skin patches it
 * directly instead: no theme registration, no preference write, and unloading
 * the bundle puts the shipped artwork back.
 */
import { SPRITE_SYMBOLS } from './sprite-data.ts'

/** Attributes that size or label one rendering, not the reusable artwork. */
const DROPPED_ATTRIBUTES = new Set(['width', 'height', 'xmlns', 'class', 'aria-hidden'])

const SVG_NS = 'http://www.w3.org/2000/svg'

const SPRITE_SELECTOR = '[data-dsh-icon-sprite]'

/**
 * How long to wait for ui-theme's sprite before calling the client too old.
 * The sprite mounts during boot, so anything approaching a second already
 * means it is not coming; three leaves room for a slow first paint.
 */
const SPRITE_WAIT_MS = 3000

/**
 * Replacement artwork, keyed by sprite symbol id.
 *
 * Ids are `dsw-icon-<glyph>-<weight>`; run `node scripts/icon-ids.mjs` against a
 * running dev server to list the ones the current screen actually uses. Each
 * value is a complete SVG document with a `viewBox`; the root's presentation
 * attributes carry over to the symbol, `width` / `height` / `class` do not
 * (the use site sizes the icon), and painted elements should say
 * `currentColor` so the icon keeps following its slot's text colour.
 *
 * Example — a squarer "more" glyph:
 *
 *   'dsw-icon-apps-add-outline-regular':
 *     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"'
 *     + ' stroke="currentColor" stroke-width="1">'
 *     + '<rect x="1.5" y="1.5" width="13" height="13" rx="4"/>'
 *     + '<path d="M8 4.5v7M4.5 8h7"/></svg>',
 */
export const ICON_REPLACEMENTS: Readonly<Record<string, string>> = {}

/**
 * Everything the client patches into the sprite: the imported sprite first, so
 * a one-off entry in {@link ICON_REPLACEMENTS} can still win over it.
 */
export const ICON_OVERRIDES: Readonly<Record<string, string>> = {
  ...SPRITE_SYMBOLS,
  ...ICON_REPLACEMENTS,
}

/** One override, already applied: the symbol we inserted and the one it replaced. */
interface AppliedOverride {
  readonly symbol: SVGSymbolElement
  readonly previous: SVGSymbolElement
}

/**
 * Build a `<symbol>` from a complete SVG document, matching ui-theme's own
 * conversion so a replacement and a default render identically.
 * @param id - symbol id the use sites reference.
 * @param markup - complete SVG document.
 * @returns the symbol to insert into the sprite.
 */
function toSymbol(id: string, markup: string): SVGSymbolElement {
  const root = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
  const symbol = document.createElementNS(SVG_NS, 'symbol')
  for (const { name, value } of root.attributes) {
    if (!DROPPED_ATTRIBUTES.has(name)) symbol.setAttribute(name, value)
  }
  symbol.id = id
  symbol.append(...[...root.childNodes].map(node => document.importNode(node, true)))
  return symbol
}

/**
 * Swap the given symbols in the mounted sprite, and swap them back on dispose.
 *
 * The sprite is mounted by ui-theme, which may run before or after this plugin,
 * so the installer waits for the node instead of assuming it exists. ui-theme
 * only rewrites a symbol when the artwork it wants differs from what it last
 * wrote, so a patched symbol survives later `theme/change` emissions (a light /
 * dark switch) and is only lost if the shipped artwork itself changes.
 *
 * @param replacements - symbol id → complete SVG document.
 * @returns disposer restoring the shipped artwork.
 */
export function installIconOverrides(
  replacements: Readonly<Record<string, string>>,
): () => void {
  const applied = new Map<string, AppliedOverride>()
  let disposed = false

  const apply = (sprite: Element): void => {
    for (const [id, markup] of Object.entries(replacements)) {
      if (applied.has(id)) continue
      const previous = sprite.querySelector<SVGSymbolElement>(`symbol[id="${id}"]`)
      if (previous === null) {
        console.warn(`[dsh-theme-promax] 图标精灵里没有 ${id}，已跳过这条替换。`)
        continue
      }
      const symbol = toSymbol(id, markup)
      previous.replaceWith(symbol)
      applied.set(id, { symbol, previous })
    }
  }

  const restore = (): void => {
    for (const { symbol, previous } of applied.values()) symbol.replaceWith(previous)
    applied.clear()
  }

  const existing = typeof document === 'undefined' || typeof document.querySelector !== 'function'
    ? null
    : document.querySelector(SPRITE_SELECTOR)
  if (existing !== null) {
    apply(existing)
    return restore
  }

  // No document (node runs that boot the client tree), or a DOM without
  // MutationObserver: there is no sprite to patch and nothing to wait for.
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || document.body == null) {
    return restore
  }

  // The sprite mounts on ui-theme's own schedule; watch for it, then stop.
  let timer: ReturnType<typeof setTimeout> | undefined
  const observer = new MutationObserver(() => {
    const sprite = document.querySelector(SPRITE_SELECTOR)
    if (sprite === null) return
    observer.disconnect()
    if (timer !== undefined) clearTimeout(timer)
    if (!disposed) apply(sprite)
  })
  observer.observe(document.body, { childList: true })

  // A client that never mounts a sprite is not broken, it is older: the icon
  // set predates ui-theme's sprite and the components draw their own `<svg>`.
  // Saying so once beats silently doing nothing — that is how the 0.2.1-rc.5
  // desktop build looked "fine" while none of the overrides were in effect.
  const pending = Object.keys(replacements).length
  timer = setTimeout(() => {
    observer.disconnect()
    if (disposed || pending === 0) return
    console.warn(
      `[dsh-theme-promax] 这个客户端没有图标精灵（${SPRITE_SELECTOR}），${pending} 条图标替换未生效。`
      + '0.2.2 之前的版本把图标直接写在组件里，换图标需要升级客户端。',
    )
  }, SPRITE_WAIT_MS)
  // Node returns a Timeout handle, the browser a number; only the former can
  // keep a process alive, and a test run must not wait out the timer.
  ;(timer as unknown as { unref?: () => void }).unref?.()

  return () => {
    disposed = true
    if (timer !== undefined) clearTimeout(timer)
    observer.disconnect()
    restore()
  }
}
