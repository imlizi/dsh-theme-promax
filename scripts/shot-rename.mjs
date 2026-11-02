#!/usr/bin/env node
/**
 * Screenshot the two rename dialogs at the reference geometry.
 *
 *   node scripts/shot-rename.mjs --log /tmp/dsh-web.log --out .artifacts
 *
 * The dialogs are reached the way a user reaches them: the workspace row's
 * menu for the workspace dialog, the session row's menu for the session one.
 * Both are portaled to <body>, so the page is captured whole.
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
/** `--dark` paints the shell's dark scheme (a body attribute, not the media query). */
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
  // The init script can run before the document element exists.
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

// The desktop onboarding welcome covers the whole shell and would swallow every
// click aimed at a row. It is presentation only (role="presentation"), but it
// also fades and inerts #root while mounted, so both have to be undone with it.
await page.evaluate(() => {
  for (const node of document.querySelectorAll('[class*="onboardingOverlay"]')) node.remove()
  const root = document.getElementById('root')
  if (root !== null) {
    root.style.opacity = ''
    root.inert = false
    root.removeAttribute('inert')
  }
  document.body.inert = false
})
await page.waitForTimeout(200)

/** Open a row's context menu and return the visible menu items' labels. */
async function openMenu(locator) {
  await locator.click({ button: 'right' })
  await page.waitForTimeout(500)
  return page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')]
    .map(el => (el.textContent ?? '').trim()))
}

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
    content: pick(q('[class*="_content"]')),
    header: pick(q('[class*="_header"]')),
    title: pick(q('[class*="_title"]')),
    close: pick(q('[class*="_close"]')),
    body: pick(q('[class*="_body"]')),
    footer: pick(q('[class*="_footer"]')),
    input: pick(q('input')),
    hint: getComputedStyle(q('[class*="_body"]') ?? dialog, '::before').content,
    buttons: [...dialog.querySelectorAll('button')].map(el => ({
      ...pick(el),
      text: (el.textContent ?? '').trim(),
      cls: el.className,
    })),
  }
})

const report = {}
report.rows = await page.evaluate(() => ({
  workspace: document.querySelectorAll('[class*="_projectRow"]').length,
  session: document.querySelectorAll('[class*="_sessionRow"]').length,
}))

// --- session rename ---
// The first row is the draft ("新会话"), whose menu has nothing to rename, so
// the harness picks a real session row and opens its context menu.
const sessionRow = page.locator('[class*="_sessionRow"]:not(:has-text("新会话"))').first()
if (await sessionRow.count() > 0) {
  const items = await openMenu(sessionRow)
  report.sessionMenu = items
  const rename = page.locator('[role="menuitem"]', { hasText: '重命名' }).first()
  if (await rename.count() > 0) {
    await rename.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(outDir, `dialog-session${suffix}.png`) })
    report.sessionDialog = await measureDialog()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
}

// --- workspace rename ---
const workspaceRow = page.locator('[class*="_projectRow"]').first()
if (await workspaceRow.count() > 0) {
  const items = await openMenu(workspaceRow)
  report.workspaceMenu = items
  const rename = page.locator('[role="menuitem"]', { hasText: '重命名' }).first()
  if (await rename.count() > 0) {
    await rename.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(outDir, `dialog-workspace${suffix}.png`) })
    report.workspaceDialog = await measureDialog()
    await page.keyboard.press('Escape')
  }
}

// --- workspace delete confirmation ---
// Same card, no field: opening it is harmless, and Escape settles the request
// without deleting anything, so the run never mutates the profile's workspace
// list.
const deleteRow = page.locator('[class*="_projectRow"]').first()
if (await deleteRow.count() > 0) {
  await openMenu(deleteRow)
  const remove = page.locator('[role="menuitem"]', { hasText: '删除工作区' }).first()
  if (await remove.count() > 0) {
    await remove.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(outDir, `dialog-delete${suffix}.png`) })
    report.deleteDialog = await measureDialog()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
}

console.log(JSON.stringify(report, null, 1))
if (errors.length > 0) console.log('errors:', errors.slice(0, 4))
await guard.release()
await browser.close()
