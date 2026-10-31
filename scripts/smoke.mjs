#!/usr/bin/env node
/**
 * Interactive smoke test for the skinned client.
 *
 * The visual diff only proves the first screen *paints* right; this proves it
 * still *works* after the hero-phase layout was inverted. Each step reports
 * pass/fail and keeps going, so one broken control does not hide the rest.
 *
 *   node scripts/smoke.mjs --log /tmp/dsh-web.log
 *
 * Screenshots of the interesting states land in `.artifacts/smoke-*.png`.
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
const outDir = resolve(root, '.artifacts')
mkdirSync(outDir, { recursive: true })

const url = [...readFileSync(logPath, 'utf8').matchAll(/dsh web: (https?:\/\/\S+)/g)].at(-1)[1]

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : `  — ${detail}`}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1302, height: 740 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  colorScheme: 'light',
})
await context.addInitScript(() => {
  Object.assign(window, {
    dshDesktop: {
      protocolVersion: 1,
      keyboard: { subscribe: () => () => {}, closeWindow: async () => {} },
      shortcuts: {
        get: async () => ({
          revision: 'smoke',
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
  document.documentElement.setAttribute('data-platform', 'darwin')
})

const page = await context.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('[data-composer-card]', { timeout: 30_000 })
await page.waitForTimeout(800)

// 1. Services: the earlier sandbox runs left the session controller dead, and a
// dead controller still paints a perfect first screen.
const fatal = errors.filter(e => /sessionController|workspaceRegistry|RemoteError|unavailable/.test(e))
check('会话服务可用', fatal.length === 0, fatal.length === 0 ? '' : fatal[0].slice(0, 140))

// 2. Skin applied: the hero headline, the tray and the card all exist and are
// placed by the skin's rules rather than the shipped centring. The headline
// belongs to the host (the skin only re-anchors the phase), so only its
// presence is asserted — the two anchors below are the skin's own work.
const geom = await page.evaluate(() => {
  const r = s => {
    const el = document.querySelector(s)
    if (el === null) return null
    const b = el.getBoundingClientRect()
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }
  }
  return { headline: r('[class*="_headline"]'), tray: r('[class*="_heroWorkspaceRow"]'), card: r('[data-composer-card]') }
})
check('首屏标题在位', geom.headline !== null && geom.headline.h > 0, JSON.stringify(geom.headline))
check('工作区托盘就位', geom.tray !== null && Math.abs(geom.tray.y - 594) < 2, JSON.stringify(geom.tray))
check('输入卡贴底', geom.card !== null && Math.abs(geom.card.y - 632) < 2, JSON.stringify(geom.card))

// 3. The skin no longer injects a hero occupant, so the shipped headline must
// be the one on screen: a leftover `.skin-hero` would mean a stale bundle.
const staleHero = await page.evaluate(() => document.querySelectorAll('.skin-hero').length)
check('无残留 hero 注入', staleHero === 0, `节点 ${staleHero}`)

// 4. The composer itself must still take typing (Lexical, IME-safe surface).
const editor = page.locator('[class*="_input"][contenteditable]').first()
await editor.click()
await page.keyboard.type('皮肤冒烟测试')
await page.waitForTimeout(300)
const typed = await page.evaluate(() => document.querySelector('[class*="_input"][contenteditable]')?.textContent ?? '')
check('输入框可键入', typed.includes('皮肤冒烟测试'), JSON.stringify(typed.slice(0, 24)))

// 5. The placeholder must disappear once there is a draft.
const placeholderVisible = await page.evaluate(() => {
  const p = document.querySelector('[class*="_placeholder"]')
  if (p === null) return false
  return getComputedStyle(p).visibility !== 'hidden' && p.textContent !== ''
})
check('有草稿时占位符隐藏', !placeholderVisible)

await page.screenshot({ path: join(outDir, 'smoke-typed.png') })

// 6. `@` opens the reference picker: proves the trigger plugins still mount
// inside the re-anchored card.
await page.keyboard.press('Enter')
await page.keyboard.type('@')
await page.waitForTimeout(500)
const atOpen = await page.evaluate(() => document.querySelectorAll('[role="listbox"],[role="menu"],[class*="_menu"]').length)
check('@ 触发候选浮层', atOpen > 0, `浮层节点 ${atOpen}`)
await page.screenshot({ path: join(outDir, 'smoke-at.png') })

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// 7. Workspace picker in the tray.
const wsChip = page.locator('[class*="_heroWorkspaceRow"] button').first()
const wsOk = await wsChip.count() > 0
if (wsOk) {
  await wsChip.click()
  await page.waitForTimeout(500)
  const menu = await page.evaluate(() => document.querySelectorAll('[role="menu"],[role="listbox"]').length)
  check('托盘工作区菜单可打开', menu > 0, `菜单节点 ${menu}`)
  await page.screenshot({ path: join(outDir, 'smoke-workspace.png') })
  await page.keyboard.press('Escape')
} else {
  check('托盘工作区菜单可打开', false, '未找到托盘按钮')
}
await page.waitForTimeout(300)

// 8. Settings row at the sidebar foot.
const settings = page.locator('[class*="_sidebarCol"] [class*="_settings"], [class*="_sidebarCol"] button').last()
const settingsOk = await settings.count() > 0
if (settingsOk) {
  await settings.click()
  await page.waitForTimeout(700)
  const dialog = await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length)
  check('设置面板可打开', dialog > 0, `dialog 节点 ${dialog}`)
  await page.screenshot({ path: join(outDir, 'smoke-settings.png') })
  await page.keyboard.press('Escape')
} else {
  check('设置面板可打开', false, '未找到设置入口')
}

// 9. New session: the shell's own button, which the skin does not own but does
// restyle, and which sits above the re-anchored column.
await page.waitForTimeout(400)
const newSession = page.locator('[class*="_newSession"]').first()
if (await newSession.count() > 0) {
  await newSession.click()
  await page.waitForTimeout(900)
  const state = await page.evaluate(() => ({
    card: document.querySelector('[data-composer-card]') !== null,
    phase: document.querySelector('[data-conversation-content]')?.getAttribute('data-content-phase') ?? null,
  }))
  check('新建会话后回到 hero', state.card && state.phase === 'hero', JSON.stringify(state))
  await page.screenshot({ path: join(outDir, 'smoke-new-session.png') })
} else {
  check('新建会话后回到 hero', false, '未找到新会话按钮')
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length > 0) console.log(`失败：${failed.map(f => f.name).join('、')}`)
console.log(`控制台错误 ${errors.length} 条`)
if (errors.length > 0) console.log(errors.slice(0, 4).join('\n'))

await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
