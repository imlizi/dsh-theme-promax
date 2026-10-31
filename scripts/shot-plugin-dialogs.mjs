#!/usr/bin/env node
/**
 * Capture and measure the plugin-surface card and the view-options menu.
 *
 *   node scripts/shot-plugin-dialogs.mjs --log /tmp/dsh-web.log [--out .artifacts] [--dark]
 *
 * Three surfaces are reached the way a user reaches them: the sidebar header's
 * sliders button opens the view-options menu, and the plugins panel's 添加插件
 * button opens the install card. The market's index-source card is not mounted
 * in this harness (no market bundle), so it is styled from the host stylesheet
 * and left out of the capture.
 */
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** Read the geometry and computed style of the open dialog and its parts. */
const measureDialog = () => page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog === null) return null
  const pick = (el) => {
    if (el === null) return null
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      fontSize: cs.fontSize, lineHeight: cs.lineHeight, fontWeight: cs.fontWeight,
      color: cs.color, background: cs.backgroundColor, radius: cs.borderRadius,
      padding: cs.padding, border: cs.border, gap: cs.gap, shadow: cs.boxShadow,
    }
  }
  const q = s => dialog.querySelector(s)
  return {
    dialog: pick(dialog),
    title: pick(q('[class*="_title"]')),
    close: pick(q('[class*="_close"]')),
    description: pick(q('[class*="_description"]')),
    body: pick(q('[class*="_body"]')),
    footer: pick(q('[class*="_footer"]')),
    input: pick(q('input')),
    safety: pick(q('[class*="_installSafety"]')),
    buttons: [...dialog.querySelectorAll('button')].map(el => ({
      ...pick(el), text: (el.textContent ?? '').trim().slice(0, 16),
    })),
  }
})

/** Read the open menu card, its rows, and the shape of its corner. */
const measureMenu = () => page.evaluate(() => {
  const list = document.querySelector('[role="menu"][class*="_list"]') ?? document.querySelector('[role="menu"]')
  if (list === null) return null
  const box = el => {
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      w: +b.width.toFixed(1), h: +b.height.toFixed(1), pad: cs.padding, gap: cs.gap,
      radius: cs.borderRadius, bg: cs.backgroundColor, shadow: cs.boxShadow,
    }
  }
  const rows = [...list.querySelectorAll('[role="menuitem"]')]
  const label = list.querySelector('[class*="_label"]:not([class*="_itemLabel"])')
  return {
    list: box(list),
    rowCount: rows.length,
    firstRow: rows.length === 0 ? null : box(rows[0]),
    label: label === null ? null : box(label),
    separator: list.querySelector('[role="separator"]') === null ? null : box(list.querySelector('[role="separator"]')),
    texts: rows.map(el => (el.textContent ?? '').trim().slice(0, 18)),
  }
})

async function shootMenu(name) {
  const handle = page.locator('[role="menu"]').first()
  const b = await handle.boundingBox()
  const report = await measureMenu()
  await page.screenshot({
    path: join(outDir, `menu-${name}${suffix}.png`),
    clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.width + 16, height: b.height + 16 },
  })
  return report
}

const out = {}

// View options: the sidebar header's sliders button — three captions, three
// separators, seven choices. The anchor carries only the label, no
// `aria-haspopup`, so the label is the handle.
const viewOptions = page.locator('[aria-label="视图选项"]').first()
if (await viewOptions.count() > 0) {
  await viewOptions.click()
  await page.waitForTimeout(500)
  out.viewOptions = await shootMenu('viewoptions')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// The plugins panel: 更多 → 浏览更多插件 puts the manager in the dock.
await page.locator('[aria-haspopup="menu"][aria-label="更多"]').first().click()
await page.waitForTimeout(400)
const browse = page.locator('[role="menuitem"]', { hasText: '浏览更多插件' }).first()
if (await browse.count() > 0) {
  await browse.click()
  await page.waitForTimeout(1800)
}

const addPlugin = page.locator('button', { hasText: '添加插件' }).first()
if (await addPlugin.count() > 0) {
  await addPlugin.click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(outDir, `dialog-addplugin${suffix}.png`) })
  out.addPlugin = await measureDialog()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// The install card's split button: its dropdown is a menu too.
const split = page.locator('[aria-haspopup="menu"][aria-label="选择添加插件方式"]').first()
if (await split.count() > 0) {
  await split.click()
  await page.waitForTimeout(500)
  out.addMenu = await shootMenu('addplugin')
  await page.keyboard.press('Escape')
}

console.log(JSON.stringify(out, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 4))
await browser.close()
