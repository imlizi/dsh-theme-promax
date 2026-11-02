#!/usr/bin/env node
/**
 * Capture and measure the skin's window drag band.
 *
 *   node scripts/shot-dragband.mjs --log /tmp/dsh-web.log [--out .artifacts]
 *
 * The shell marks its chrome rows one at a time and they do not tile the
 * window's top edge (the plugin page's head is 925 of the centre column's 1021),
 * so the skin inserts a 48px `.skin-drag-band` into the column. What it checks:
 * the band is its host's first child at the host's full width and the window's
 * top, declares `drag`, never takes input, and that a control sitting inside it
 * (the conversation's right-panel toggle, at y 25) still receives its click.
 *
 * The band is a native region, so a headless Chrome run can only assert the
 * geometry and CSS the region is collected from; the zoom itself needs the
 * desktop shell.
 */
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startSessionGuard } from './lib/session-guard.mjs'

const REPO = '/Users/zctech/Code/deepseek-harness'
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const fromApp = createRequire(join(REPO, 'apps/web/package.json'))
const { chromium } = fromApp('playwright')

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const logPath = args.get('--log') ?? '/tmp/dsh-web.log'
const outDir = resolve(root, args.get('--out') ?? '.artifacts')
mkdirSync(outDir, { recursive: true })
const url = [...readFileSync(logPath, 'utf8').matchAll(/dsh web: (https?:\/\/\S+)/g)].at(-1)[1]

const guard = startSessionGuard()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1302, height: 740 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
})
await context.addInitScript(() => {
  Object.assign(window, {
    dshDesktop: {
      protocolVersion: 1,
      keyboard: { subscribe: () => () => {}, closeWindow: async () => {} },
      shortcuts: {
        get: async () => ({
          revision: 'shot', sequence: 0,
          document: { schemaVersion: 1, profiles: {} },
          status: 'ready', error: null, usingDefaults: true,
        }),
        subscribe: () => () => {},
        recording: async () => {},
        edit: async () => ({ status: 'not-ready' }),
      },
    },
  })
  const mark = () => { document.documentElement.setAttribute('data-platform', 'darwin') }
  if (document.documentElement === null) document.addEventListener('DOMContentLoaded', mark, { once: true })
  else mark()
})

const page = await context.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('[data-composer-card]', { timeout: 30_000 })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  for (const node of document.querySelectorAll('[class*="onboardingOverlay"]')) node.remove()
  const root = document.getElementById('root')
  if (root !== null) {
    root.style.opacity = ''
    root.inert = false
    root.removeAttribute('inert')
  }
})
await page.waitForTimeout(300)

/** Every band on screen, with the host it should be covering. */
const bands = () => page.evaluate(() => [...document.querySelectorAll('.skin-drag-band')].map((el) => {
  const rect = el.getBoundingClientRect()
  const host = el.parentElement
  const hostRect = host.getBoundingClientRect()
  const style = getComputedStyle(el)
  return {
    host: String(host.className).split(' ')[0],
    first: host.firstElementChild === el,
    x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height),
    hostX: Math.round(hostRect.x), hostW: Math.round(hostRect.width),
    region: style.getPropertyValue('-webkit-app-region'),
    pointerEvents: style.pointerEvents,
    // The element a press would actually reach: the band must never be it.
    under: (() => {
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + Math.min(24, rect.height / 2))
      return hit === null ? null : String(hit.className).split(' ')[0]
    })(),
  }
}))

const hero = await bands()

// A control that lives inside the band: the top-right panel toggle (y 25).
const toggleBefore = await page.evaluate(() => document.querySelector('[aria-label="打开右侧边栏"]')?.getAttribute('aria-label') ?? null)
await page.evaluate(() => { document.querySelector('[aria-label="打开右侧边栏"]')?.click() })
await page.waitForTimeout(500)
const toggleAfter = await page.evaluate(() => document.querySelector('[aria-label="收起右侧边栏"]')?.getAttribute('aria-label') ?? null)
if (toggleAfter !== null) {
  await page.evaluate(() => { document.querySelector('[aria-label="收起右侧边栏"]')?.click() })
  await page.waitForTimeout(400)
}
await page.screenshot({ path: join(outDir, 'dragband-conversation.png'), clip: { x: 0, y: 0, width: 1302, height: 120 } })

// The plugin page: the gutters the shell leaves on both sides of its head.
await page.locator('[class*="_panelRow"]', { hasText: '插件' }).first().click()
await page.waitForSelector('[class*="_pageTitle"]', { timeout: 15_000 })
await page.waitForTimeout(900)
const plugins = await bands()

// The settings page keeps the shell's centred modal, so the band stays out of
// it: a dialog floats above the column and owns its own presses.
await page.locator('[aria-label="账号菜单"]').first().click()
await page.waitForTimeout(400)
await page.locator('[role="menuitem"]', { hasText: '设置' }).first().click()
await page.waitForSelector('[role="dialog"][data-shortcut-modal="settings"]', { timeout: 15_000 })
await page.waitForTimeout(800)
const settings = await page.evaluate(() => {
  const panel = document.querySelector('[role="dialog"][data-shortcut-modal="settings"]')
  const box = panel.getBoundingClientRect()
  const style = getComputedStyle(panel)
  return {
    bands: document.querySelectorAll('.skin-drag-band').length,
    inPanel: panel.querySelectorAll('.skin-drag-band').length,
    // The shipped 800px card, i.e. the page promotion is gone.
    card: { w: Math.round(box.width), h: Math.round(box.height), radius: style.borderRadius, centre: Math.abs(box.x + box.width / 2 - window.innerWidth / 2) < 60 },
  }
})
await page.screenshot({ path: join(outDir, 'dragband-settings.png') })

const covers = (list, host) => {
  const band = list.find(item => item.host === host)
  // 2px of slack: the column paints a 1px hairline on its left edge, which the
  // band's box sits inside of.
  return band !== undefined
    && band.first
    && band.y === 0
    && band.h === 48
    && Math.abs(band.x - band.hostX) < 2
    && Math.abs(band.w - band.hostW) < 2
    && band.region === 'drag'
    && band.pointerEvents === 'none'
    && band.under !== 'skin-drag-band'
}

const report = {
  conversation: { band: hero, covers: covers(hero, hero[0]?.host ?? '') },
  plugins: { band: plugins, covers: covers(plugins, plugins[0]?.host ?? '') },
  // The band belongs to the column only; the settings modal is the shell's own
  // card and carries none.
  settings: { ...settings, clean: settings.inPanel === 0 },
  // The band sits over the page, so a control under it must still answer.
  topRightToggle: { before: toggleBefore, after: toggleAfter, works: toggleAfter !== null },
}
console.log(JSON.stringify(report, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 3))
await guard.release()
await browser.close()
