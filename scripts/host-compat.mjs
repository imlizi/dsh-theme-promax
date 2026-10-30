#!/usr/bin/env node
/**
 * Host-compatibility regression test.
 *
 * The skin once called `ctx.layout.setSidebarWidth()` unconditionally. Against a
 * 0.2.1-rc.5 desktop build — whose `ui-layout` predates that method — the call
 * threw inside `apply`, the client boot counted the entry as failed, and the
 * whole window refused to start:
 *
 *   web boot: 1 entry did not activate
 *   dsh-theme-promax: failed
 *
 * A cosmetic plugin must never be able to do that, so `apply` now probes every
 * capability it cannot prove at author time. This test pins that behaviour down
 * by running `apply` against the host shapes that exist in the wild.
 *
 *   node scripts/host-compat.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')

/* The build is a browser module: it hands its factory to the host's module
   loader. Capture the factory, then call it with a no-op `require` so the
   module's own exports are observable without any of the host packages. */
let factory
globalThis.window = { __ModuleLoader__: { load: (record) => { factory = record.factory } } }
new Function('window', source)(globalThis.window)
if (typeof factory !== 'function') {
  console.log('FAIL  产物不是可加载的浏览器模块（未调用 __ModuleLoader__.load）')
  process.exit(1)
}
const skin = factory(() => ({}))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : `  — ${detail}`}`)
}

/** Minimal DOM: `apply` owns exactly one style element. */
function installDom() {
  const head = { children: [], appendChild(node) { this.children.push(node) } }
  globalThis.document = {
    head,
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    documentElement: { dataset: {} },
  }
  return head
}

/**
 * Run `apply` against one host shape.
 * @param layout - the `ctx.layout` value this host exposes.
 * @returns everything the run observed.
 */
function runAgainst(layout) {
  const head = installDom()
  const warnings = []
  const realWarn = console.warn
  console.warn = (...args) => { warnings.push(args.join(' ')) }

  const effects = []
  const ctx = {
    effect: (fn) => { effects.push(fn()); return () => {} },
    theme: { overrideTokens: () => () => {} },
    locale: { register: () => () => {} },
    slots: { inject: () => () => {}, register: () => () => {} },
    layout,
  }

  let error = null
  try {
    skin.apply(ctx)
  } catch (thrown) {
    error = thrown
  } finally {
    console.warn = realWarn
  }
  return { error, warnings, styleTags: head.children.length }
}

const calls = []
const modern = runAgainst({ setSidebarWidth: (px) => { calls.push(px) } })
check('新版宿主：apply 不抛错', modern.error === null, modern.error?.message ?? '')
check('新版宿主：写入 240.5', calls.length === 1 && calls[0] === 240.5, JSON.stringify(calls))
check('新版宿主：样式表已挂载', modern.styleTags === 1)
check('新版宿主：无告警', modern.warnings.length === 0, modern.warnings.join(' | '))

// The exact 0.2.1-rc.5 shape: the service exists, the method does not.
const legacy = runAgainst({})
check('旧版宿主（无 setSidebarWidth）：apply 不抛错', legacy.error === null, legacy.error?.message ?? '')
check('旧版宿主：样式表仍挂载', legacy.styleTags === 1)
check('旧版宿主：给出降级告警', legacy.warnings.some(w => w.includes('setSidebarWidth')),
  legacy.warnings[0]?.slice(0, 80) ?? '(无告警)')

// A host that does not even mount the layout service.
const absent = runAgainst(undefined)
check('无 layout 服务：apply 不抛错', absent.error === null, absent.error?.message ?? '')
check('无 layout 服务：给出降级告警', absent.warnings.some(w => w.includes('setSidebarWidth')))

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length > 0) console.log(`失败：${failed.map(f => f.name).join('、')}`)
process.exit(failed.length === 0 ? 0 : 1)
