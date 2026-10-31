import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import css from './styles/base.css'
import { SKIN_TOKENS } from './theme.ts'
import { NS, en, zh } from './locales.ts'
import { ICON_OVERRIDES, installIconOverrides } from './icons.ts'
import { HeroContent } from './hero/HeroContent.tsx'

/**
 * Services this browser half needs before it can contribute UI.
 *
 * Every name here is a hard dependency: the client boot treats one entry that
 * cannot activate as fatal for the whole window (`web boot: 1 entry did not
 * activate`), so nothing goes on this list that the skin does not call. The
 * skin reaches ui-layout's markup through CSS only, which is why `layout` is
 * not here.
 */
export const inject = ['slots', 'theme', 'locale']

/**
 * Mount the skin: one owned stylesheet, one token-override layer, and the
 * seats that replace shipped presentation. Every registration is an effect, so
 * disabling the bundle unwinds the skin without touching the host packages.
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

  // `slots.inject` waits for the declaration instead of throwing on an unknown
  // key, so a host without this seat simply never renders the skin's hero stack
  // and keeps its own headline. Nothing to probe here.
  ctx.effect(
    () => ctx.slots.inject('conversation.hero.content', () => ctx.slots.register({
      name: 'conversation.hero.content',
      locale: NS,
    }, HeroContent)),
    'skin: hero stack',
  )
}
