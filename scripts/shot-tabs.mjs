#!/usr/bin/env node
/**
 * Screenshot the shell's segmented tab control (track + selected pill).
 *
 *   node scripts/shot-tabs.mjs --log /tmp/dsh-web.log [--out .artifacts] [--dark]
 *
 * The Plugins page only draws its tabs once a plugin contributes one, which a
 * bare harness profile may not have; the agent-preset guide always does. The
 * harness walks Settings → Agent 预设 → 模式说明 and clips the control, so the
 * fills the skin's rule has to keep apart are read from the live element.
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

/** Read the control's track, pill and label colours. */
const measure = () => page.evaluate(() => {
  const list = document.querySelector('[role="tablist"]:has([role="tab"])')
  if (list === null) return null
  const pill = list.querySelector('[class*="_indicator"]')
  const pick = el => {
    if (el === null) return null
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius,
      font: cs.fontSize, weight: cs.fontWeight, border: cs.border, shadow: cs.boxShadow,
    }
  }
  return {
    track: pick(list),
    pill: pick(pill),
    tabs: [...list.querySelectorAll('[role="tab"]')].map(el => ({
      text: (el.textContent ?? '').trim(),
      selected: el.getAttribute('aria-selected'),
      ...pick(el),
    })),
    box: list.getBoundingClientRect().toJSON(),
  }
})

// Settings → Agent 预设 → 模式说明 opens the guide dialog, whose first control
// is the same segmented tabs the Plugins page header uses.
await page.locator('[aria-label="账号菜单"]').first().click()
await page.waitForTimeout(400)
await page.locator('[role="menuitem"]', { hasText: '设置' }).first().click()
await page.waitForTimeout(800)
await page.locator('button', { hasText: 'Agent 预设' }).first().click()
await page.waitForTimeout(800)
const guide = page.locator('button', { hasText: '模式说明' }).first()
if (await guide.count() === 0) {
  console.log('no guide button; the settings page did not open')
  await browser.close()
  process.exit(1)
}
await guide.click()
await page.waitForTimeout(800)

const report = await measure()
if (report === null) {
  console.log('no segmented tabs in the guide dialog')
  await browser.close()
  process.exit(1)
}
const { box } = report
delete report.box
await page.screenshot({
  path: join(outDir, `tabs${suffix}.png`),
  clip: { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 },
})
console.log(JSON.stringify(report, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 3))
await browser.close()
