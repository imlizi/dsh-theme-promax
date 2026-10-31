#!/usr/bin/env node
/**
 * List the product icon symbols the current screen actually renders.
 *
 *   node scripts/icon-ids.mjs --log /tmp/dsh-web.log [--scope sidebar]
 *
 * Every icon is `<svg data-icon="dsw-icon-<glyph>-<weight>">` pointing at a
 * `<symbol>` in ui-theme's document sprite, so the id printed here is the key
 * `src/client/icons.ts` takes. Elements with a 0×0 box are mounted but not
 * painted (row actions that appear on hover, collapsed chevrons); they are
 * listed too, because they still carry an id worth knowing.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
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
const scope = args.get('--scope') ?? 'body'

/** Last launch URL printed by the host; the log accumulates across restarts. */
function launchUrl() {
  const text = readFileSync(logPath, 'utf8')
  const hits = [...text.matchAll(/dsh web: (https?:\/\/\S+)/g)]
  if (hits.length === 0) throw new Error(`no "dsh web: <url>" line in ${logPath}`)
  return hits.at(-1)[1]
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1302, height: 740 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  colorScheme: 'light',
})
// Stub the desktop shell so the onboarding and preview dialogs stay closed, and
// mark the platform so darwin-only chrome renders like the reference window.
await context.addInitScript(() => {
  Object.assign(window, {
    dshDesktop: {
      protocolVersion: 1,
      keyboard: { subscribe: () => () => {}, closeWindow: async () => {} },
      shortcuts: {
        get: async () => ({
          revision: 'skin-stub',
          sequence: 0,
          document: { schemaVersion: 1, profiles: {} },
          status: 'ready',
          error: null,
          usingDefaults: true,
        }),
        subscribe: () => () => {},
        recording: async () => {},
        edit: async () => ({ status: 'not-ready' }),
      },
    },
  })
  if (document.documentElement) document.documentElement.setAttribute('data-platform', 'darwin')
})

const page = await context.newPage()
await page.goto(launchUrl(), { waitUntil: 'load' })
await page.waitForSelector('[data-composer-card]', { timeout: 30_000 })
await page.waitForTimeout(1200)

const rows = await page.evaluate((selector) => {
  const scope = document.querySelector(selector) ?? document.body
  const seen = new Map()
  for (const svg of scope.querySelectorAll('svg[data-icon]')) {
    const id = svg.dataset.icon
    const box = svg.getBoundingClientRect()
    const label = svg.closest('button')?.getAttribute('aria-label') ?? ''
    const painted = box.width > 0 && box.height > 0
    const key = `${id}|${Math.round(box.width)}x${Math.round(box.height)}|${label}`
    if (seen.has(key)) continue
    seen.set(key, { id, size: `${Math.round(box.width)}x${Math.round(box.height)}`, label, painted })
  }
  const sprite = document.querySelector('[data-dsh-icon-sprite]')
  return {
    icons: [...seen.values()].sort((a, b) => a.id.localeCompare(b.id)),
    symbols: sprite?.querySelectorAll('symbol').length ?? 0,
  }
}, scope)

const width = Math.max(...rows.icons.map(row => row.id.length), 12)
for (const row of rows.icons) {
  const mark = row.painted ? ' ' : '·'
  console.log(`${mark} ${row.id.padEnd(width)}  ${row.size.padStart(6)}  ${row.label}`)
}
console.log(`\n${rows.icons.length} 个图标，精灵共 ${rows.symbols} 个符号（· = 已挂载但当前不绘制）`)
console.log(`替换写法：src/client/icons.ts 的 ICON_REPLACEMENTS['<id>'] = '<svg …/>'`)

await browser.close()
