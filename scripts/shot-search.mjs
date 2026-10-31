#!/usr/bin/env node
/**
 * Capture and measure the sidebar's session search field.
 *
 *   node scripts/shot-search.mjs --log /tmp/dsh-web.log [--out .artifacts] [--dark]
 *
 * The field only exists in its expanded state, so the run clicks the header's
 * magnifier first. What it checks: the field's own box against the 30px header
 * band it sits in. The header clips its overflow, so a field taller than the
 * band loses its top and bottom borders — the bug this script exists to catch.
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

// Expand the field: the magnifier in the section header.
await page.locator('[aria-label*="搜索会话"]').first().click()
await page.waitForTimeout(600)
// Park the pointer away from the clear button so its resting fill is captured.
await page.mouse.move(600, 400)
await page.waitForTimeout(200)

const report = await page.evaluate(() => {
  const input = document.querySelector('input[placeholder="搜索会话名称"]')
  if (input === null) return null
  const field = input.closest('[class*="_searchExpanded"]')
  const header = field?.closest('[class*="_sectionHeader"]')
  const box = el => {
    if (el == null) return null
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      border: cs.border, radius: cs.borderRadius, background: cs.backgroundColor,
      overflow: cs.overflow, padding: cs.padding,
    }
  }
  const headerBox = box(header)
  const fieldBox = box(field)
  return {
    header: headerBox,
    field: fieldBox,
    input: box(input),
    clear: box(field?.querySelector('[class*="_clearButton"]') ?? null),
    magnifier: box(field?.querySelector('[class*="_searchButton"]') ?? null),
    // The two boxes must agree: a taller field is clipped by the header.
    fitsBand: headerBox !== null && fieldBox !== null
      && Math.abs(fieldBox.h - headerBox.h) < 0.5
      && fieldBox.y >= headerBox.y - 0.5
      && fieldBox.y + fieldBox.h <= headerBox.y + headerBox.h + 0.5,
  }
})

await page.screenshot({ path: join(outDir, `search${suffix}.png`) })
if (report !== null) {
  await page.screenshot({
    path: join(outDir, `search-crop${suffix}.png`),
    clip: { x: 0, y: Math.max(0, report.header.y - 18), width: 260, height: 76 },
  })
}

console.log(JSON.stringify(report, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 3))
await browser.close()
