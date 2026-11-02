#!/usr/bin/env node
/**
 * Capture and measure the shell's dropdown menus.
 *
 *   node scripts/shot-menu.mjs --log /tmp/dsh-web.log [--out .artifacts] [--dark]
 *
 * Each menu is reached the way a user reaches it (row context menu, plugin
 * header menu), then the card is screenshotted on its own at DPR 2 and every
 * value the stylesheet controls is read back from the live element, so the
 * skin's rules can be checked against numbers instead of eyeballed.
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
const dark = process.argv.includes('--dark')
const suffix = dark ? '-dark' : ''

const guard = startSessionGuard()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1302, height: 740 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  colorScheme: dark ? 'dark' : 'light',
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
  if (globalThis.location.search.includes('scheme=dark')) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.setAttribute('data-ds-dark-theme', '')
    }, { once: true })
  }
})

const page = await context.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
await page.goto(dark ? `${url}&scheme=dark` : url, { waitUntil: 'load' })
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
await page.waitForTimeout(200)

/** Read the open menu's geometry and the computed style of every part. */
const measure = () => page.evaluate(() => {
  const list = document.querySelector('[role="menu"][class*="_list"]') ?? document.querySelector('[role="menu"]')
  if (list === null) return null
  const box = el => {
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      font: cs.fontSize, line: cs.lineHeight, weight: cs.fontWeight,
      pad: cs.padding, gap: cs.gap, radius: cs.borderRadius, bg: cs.backgroundColor,
      color: cs.color, shadow: cs.boxShadow, border: cs.border,
    }
  }
  const rows = [...list.querySelectorAll('[role="menuitem"]')]
  const sep = list.querySelector('[role="separator"]')
  const icon = list.querySelector('[class*="_itemIcon"]')
  const label = list.querySelector('[class*="_itemLabel"]')
  const shortcut = list.querySelector('[class*="_shortcut"]')
  const lb = list.getBoundingClientRect()
  return {
    list: box(list),
    rows: rows.map(el => {
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: (el.textContent ?? '').trim().slice(0, 24),
        x: +(b.x - lb.x).toFixed(1), y: +(b.y - lb.y).toFixed(1),
        w: +b.width.toFixed(1), h: +b.height.toFixed(1),
        pad: cs.padding, radius: cs.borderRadius, gap: cs.gap,
        font: cs.fontSize, line: cs.lineHeight,
      }
    }),
    icon: icon === null ? null : box(icon),
    iconSvg: icon === null ? null : box(icon.querySelector('svg') ?? icon),
    label: label === null ? null : box(label),
    shortcut: shortcut === null ? null : box(shortcut),
    separator: sep === null ? null : box(sep),
    separatorMargin: sep === null ? null : getComputedStyle(sep).margin,
    rowCount: rows.length,
  }
})

/** Screenshot the open menu card with an 8px halo, so its shadow is visible. */
async function shoot(name) {
  const handle = page.locator('[role="menu"]').first()
  const b = await handle.boundingBox()
  const report = await measure()
  await page.screenshot({
    path: join(outDir, `menu-${name}${suffix}.png`),
    clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.width + 16, height: b.height + 16 },
  })
  return report
}

const out = {}

// Session menu: the row's context menu, six rows with shortcut hints.
const sessionRow = page.locator('[class*="_sessionRow"]:not(:has-text("新会话"))').first()
if (await sessionRow.count() > 0) {
  await sessionRow.click({ button: 'right' })
  await page.waitForTimeout(500)
  // Park the pointer on the first row so the hover fill is captured too.
  const first = page.locator('[role="menuitem"]').first()
  if (await first.count() > 0) await first.hover()
  await page.waitForTimeout(250)
  out.session = await shoot('session')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// Panellist menu: the sidebar header's More button, two icon rows.
const moreButton = page.locator('[aria-haspopup="menu"][aria-label="更多"]').first()
if (await moreButton.count() > 0) {
  await moreButton.click()
  await page.waitForTimeout(500)
  const first = page.locator('[role="menuitem"]').first()
  if (await first.count() > 0) await first.hover()
  await page.waitForTimeout(250)
  out.more = await shoot('more')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// Workspace menu: three rows, one of them destructive.
const workspaceRow = page.locator('[class*="_projectRow"]').first()
if (await workspaceRow.count() > 0) {
  await workspaceRow.click({ button: 'right' })
  await page.waitForTimeout(500)
  const first = page.locator('[role="menuitem"]').first()
  if (await first.count() > 0) await first.hover()
  await page.waitForTimeout(250)
  out.workspace = await shoot('workspace')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// Model picker: a custom card with two-line rows, the tallest shape the skin
// touches — a regression here would show as clipped subtitles.
const modelTrigger = page.locator('[aria-haspopup="menu"][aria-label^="选择模型"]').first()
if (await modelTrigger.count() > 0) {
  await modelTrigger.click()
  await page.waitForTimeout(500)
  out.model = await shoot('model')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

console.log(JSON.stringify(out, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 3))
await guard.release()
await browser.close()
