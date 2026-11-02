import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import css from './styles/base.css'
import { SKIN_TOKENS } from './theme.ts'
import { NS, en, zh } from './locales.ts'
import { ICON_OVERRIDES, installIconOverrides } from './icons.ts'

/**
 * Services this browser half needs before it can contribute UI.
 *
 * Every name here is a hard dependency: the client boot treats one entry that
 * cannot activate as fatal for the whole window (`web boot: 1 entry did not
 * activate`), so nothing goes on this list that the skin does not call. The
 * skin reaches ui-layout's markup through CSS only, which is why `layout` is
 * not here; it no longer registers any slot occupant, which is why `slots` is
 * not here either.
 */
export const inject = ['theme', 'locale']

/**
 * Mount the skin: one owned stylesheet and one token-override layer. Every
 * registration is an effect, so disabling the bundle unwinds the skin without
 * touching the host packages.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-theme-promax'
    tag.textContent = css
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'skin: stylesheet')

  ctx.effect(
    () => ctx.theme.overrideTokens('dsh-theme-promax', SKIN_TOKENS),
    'skin: alias tokens',
  )

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skin: dictionaries')

  // The rename dialogs are shipped markup with no description slot, so their
  // hint line is a `::before` whose `content` reads this variable. Writing it
  // from the skin's dictionary keeps the line translated (and keeps it absent
  // entirely on a host that never registers the namespace, because an unset
  // variable leaves `content` at `normal`).
  ctx.effect(() => {
    const publish = (): void => {
      const text = ctx.locale.bind(NS)('rename.hint')
      document.documentElement.style.setProperty('--skin-rename-hint', JSON.stringify(text))
    }
    publish()
    return ctx.locale.subscribe(publish)
  }, 'skin: rename hint')

  // Icon artwork is one `<symbol>` per glyph in ui-theme's document sprite, so
  // the skin swaps symbols instead of forking icon components. The table is
  // empty until a sprite is imported (`scripts/import-sprite.mjs`) or an entry
  // is added by hand; either way the shipped set renders unchanged elsewhere.
  ctx.effect(() => installIconOverrides(ICON_OVERRIDES), 'skin: icon artwork')

  // The window's top edge has to answer a double-click with a zoom, and only a
  // native drag region does that. The shell marks its chrome rows one at a
  // time, and they do not tile the edge: the plugin page's head is 925 of the
  // column's 1021, and its outer 48px gutters belong to no row. A press there
  // falls through to the page, where macOS's own double-click selects the
  // nearest word.
  //
  // So the skin contributes the missing row itself (`.skin-drag-band` in
  // styles/base.css) to the centre column. The strip carries `data-window-drag`
  // rather than declaring its own app-region — that attribute is both the
  // shell's one drag rule and what its recall pass watches, so the window's
  // rects are refreshed when the surface mounts or is replaced.
  //
  // Order is load-bearing: the native hit test lets the *last* collected box
  // containing a point decide, so the band stays a host's first child — every
  // control under it (the conversation's top-right toggle, the plugin
  // toolbar) must keep winning the press.
  ctx.effect(() => {
    if (document.documentElement.dataset.platform !== 'darwin') return () => {}

    const COLUMN = '[class*="_centerCol"]'
    const BAND = 'skin-drag-band'

    const makeBand = (): HTMLElement => {
      const band = document.createElement('div')
      band.className = BAND
      band.dataset.windowDrag = ''
      band.setAttribute('aria-hidden', 'true')
      return band
    }

    /** Keep exactly one band as a host's first child, reusing a displaced one. */
    const ensure = (host: Element): void => {
      if (host.firstElementChild?.classList.contains(BAND) === true) return
      const displaced = Array.from(host.children).find(child => child.classList.contains(BAND))
      host.prepend(displaced ?? makeBand())
    }

    const sync = (): void => {
      const column = document.querySelector(COLUMN)
      if (column !== null) ensure(column)
    }

    // Only two containers can change the answer: <body>, where the column is
    // replaced as a whole, and the column itself, where React re-inserts its
    // children around the band. The third case is the very first frame — the
    // column mounts after the skin — and a band that is not there yet is
    // answered by the `band === null` check below.
    const band = (): Element | null => document.querySelector(`.${BAND}`)
    const observer = new MutationObserver((records) => {
      if (band() === null) { sync(); return }
      for (const record of records) {
        const target = record.target
        if (target === document.body
          || (target instanceof Element && target.matches(COLUMN))) {
          sync()
          return
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // A column replaced by a page switch is a child-list change on the frame,
    // which the observer above deliberately ignores; a press re-checks instead.
    document.addEventListener('pointerdown', sync, true)
    document.addEventListener('keydown', sync, true)
    sync()

    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', sync, true)
      document.removeEventListener('keydown', sync, true)
      for (const band of document.querySelectorAll(`.${BAND}`)) band.remove()
    }
  }, 'skin: window drag band')
}
