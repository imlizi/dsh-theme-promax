#!/usr/bin/env node
/**
 * Screenshot the running Web client at the reference geometry.
 *
 *   node scripts/shot.mjs --log /tmp/dsh-web.log --out .artifacts/shot.png
 *
 * The page is marked as the macOS desktop shell so the frame reserves the same
 * 48px top strip the reference window has, and `window.dshDesktop` is stubbed so
 * the DeepSeek onboarding dialog and the preview notice stay closed.
 */
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = '/Users/zctech/Code/deepseek-harness'
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Resolve a dependency from the app that owns it, not from this package. */
const fromApp = createRequire(join(REPO, 'apps/web/package.json'))
const { chromium } = fromApp('playwright')
const sharp = fromApp('sharp')

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const logPath = args.get('--log') ?? '/tmp/dsh-web.log'
const outPath = resolve(root, args.get('--out') ?? '.artifacts/shot.png')
const headed = process.argv.includes('--headed')

/** Last launch URL printed by the host; the log accumulates across restarts. */
function launchUrl() {
  const text = readFileSync(logPath, 'utf8')
  const hits = [...text.matchAll(/dsh web: (https?:\/\/\S+)/g)]
  if (hits.length === 0) throw new Error(`no "dsh web: <url>" line in ${logPath}`)
  return hits.at(-1)[1]
}

const SHORTCUT_SNAPSHOT = {
  revision: 'skin-stub',
  sequence: 0,
  document: { schemaVersion: 1, profiles: {} },
  status: 'ready',
  error: null,
  usingDefaults: true,
}

const browser = await chromium.launch({ channel: 'chrome', headless: !headed })
const context = await browser.newContext({
  viewport: { width: 1302, height: 740 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
})

await context.addInitScript((snapshot) => {
  Object.assign(window, {
    dshDesktop: {
      protocolVersion: 1,
      keyboard: { subscribe: () => () => {}, closeWindow: async () => {} },
      shortcuts: {
        get: async () => snapshot,
        subscribe: () => () => {},
        recording: async () => {},
        edit: async () => ({ status: 'not-ready', snapshot }),
      },
    },
  })
  const mark = () => { document.documentElement.setAttribute('data-platform', 'darwin') }
  if (document.documentElement === null) document.addEventListener('DOMContentLoaded', mark, { once: true })
  else mark()
}, SHORTCUT_SNAPSHOT)

const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', error => errors.push(String(error)))

await page.goto(launchUrl(), { waitUntil: 'load' })
await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
await page.waitForTimeout(600)
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => document.getAnimations()
  .every(a => a.playState === 'finished' || a.playState === 'idle'), undefined, { timeout: 15_000 })

/** Anything covering the first screen means the shot is not comparable. */
const blocked = await page.evaluate(() => ({
  inert: document.body.inert,
  dialogs: [...document.querySelectorAll('[role="dialog"]')].map(n => (n.textContent ?? '').slice(0, 120)),
}))

const rects = await page.evaluate(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }
  return {
    frame: pick('[class*="frame"]'),
    sidebar: pick('[class*="sidebarCol"]'),
    content: pick('[data-conversation-content]'),
    scroll: pick('[data-conversation-scroll]'),
    seat: pick('[data-composer-seat]'),
    stack: pick('[class*="_composerStack"]'),
    tray: pick('[class*="_heroWorkspaceRow"]'),
    hero: pick('.skin-hero'),
    tile: pick('.skin-hero__tile'),
    title: pick('.skin-hero__title'),
    chips: pick('.skin-hero__chips'),
    card: pick('[data-composer-card]'),
  }
})

mkdirSync(dirname(outPath), { recursive: true })
await page.screenshot({ path: outPath, animations: 'disabled' })
const meta = await sharp(outPath).metadata()
writeFileSync(resolve(dirname(outPath), 'regions.json'), `${JSON.stringify({ rects, blocked, errors, image: meta.width + 'x' + meta.height }, null, 2)}\n`)

if (blocked.dialogs.length > 0 || blocked.inert) {
  console.error('BLOCKED: a dialog covers the first screen —', JSON.stringify(blocked))
}
if (errors.length > 0) console.error(`console errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}`)
console.log(`shot ${meta.width}x${meta.height} → ${outPath}`)
console.log(JSON.stringify(rects, null, 1))

await browser.close()
