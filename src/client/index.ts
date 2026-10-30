import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import css from './styles/base.css'
import { SKIN_TOKENS } from './theme.ts'
import { NS, en, zh } from './locales.ts'
import { HeroContent } from './hero/HeroContent.tsx'

/** Services this browser half needs before it can contribute UI. */
export const inject = ['slots', 'theme', 'locale', 'layout']

/** Sidebar track width of the reference screen, in CSS pixels. */
const SIDEBAR_WIDTH = 240.5

/** Host capability the skin can reach for but cannot require. */
type SidebarWidthSetter = (px: number) => void

/**
 * Read one optional host capability, warning instead of throwing.
 *
 * The client boot treats a single failed entry as fatal for the whole window
 * (`web boot: 1 entry did not activate`), so a presentation plugin that calls
 * an API its host does not ship takes the entire app down with it — which is
 * exactly what happened against a 0.2.1-rc.5 desktop build, where `ui-layout`
 * has no `setSidebarWidth`. Every capability the skin cannot prove at author
 * time is therefore probed: the host that lacks one keeps booting, the skin
 * degrades to what it can still express, and the console names the missing
 * piece and what it was for.
 *
 * @param target - host object that may or may not carry the capability.
 * @param key - capability name.
 * @param reason - what the skin needs it for, printed with the warning.
 * @returns the capability, or `undefined` when this host does not ship it.
 */
function capability<T extends object, K extends keyof T & string>(
  target: T | undefined,
  key: K,
  reason: string,
): T[K] | undefined {
  const value = target?.[key]
  if (value === undefined) {
    console.warn(
      `[dsh-skin-promax] 宿主未提供 ${key}（${reason}）。皮肤已降级，应用启动不受影响。`,
    )
  }
  return value
}

/**
 * Mount the skin: one owned stylesheet, one token-override layer, and the
 * seats that replace shipped presentation. Every registration is an effect, so
 * disabling the bundle unwinds the skin without touching the host packages.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-skin-promax'
    tag.textContent = css
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'skin: stylesheet')

  ctx.effect(
    () => ctx.theme.overrideTokens('dsh-skin-promax', SKIN_TOKENS),
    'skin: alias tokens',
  )

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skin: dictionaries')

  // The reference sidebar is 240.5px, narrower than the shipped track. Only a
  // ui-layout that exposes `setSidebarWidth` can be told so; on any other host
  // the column keeps its own width and every other skin rule still holds.
  ctx.effect(() => {
    const layout = ctx.layout as { setSidebarWidth?: SidebarWidthSetter } | undefined
    const setWidth = capability(layout, 'setSidebarWidth', '侧栏宽度由 ui-layout 写入')
    setWidth?.call(layout, SIDEBAR_WIDTH)
  }, 'skin: sidebar track')

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
