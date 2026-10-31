#!/usr/bin/env node
/**
 * Host-compatibility regression test.
 *
 * Two failure modes are pinned here, both of them seen in the wild against a
 * real desktop build:
 *
 *   1. A **hard** dependency. `web boot: 1 entry did not activate` treats one
 *      failed entry as fatal for the whole window, so a cosmetic plugin that
 *      declares a service it does not actually call takes the app down. The
 *      skin once listed `layout` in `inject` while using it for nothing.
 *
 *   2. A **console line**. Even when nothing throws, a presentation plugin has
 *      no business narrating a cosmetic mismatch on every boot of an app that
 *      looks correct.
 *
 * So `apply` is run against every host shape that exists in the wild, and each
 * run must be silent and throw-free.
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

/** Minimal DOM: `apply` owns one style element and patches the icon sprite. */
function installDom({ querySelector = true } = {}) {
  const head = { children: [], appendChild(node) { this.children.push(node) } }
  // The skin publishes its rename hint as a custom property on <html>.
  head.styleWrites = []
  globalThis.document = {
    head,
    body: {},
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    documentElement: {
      dataset: {},
      style: { setProperty: (name, value) => { head.styleWrites.push([name, value]) } },
    },
    // No sprite in this DOM: the icon installer must fall back to watching.
    ...(querySelector ? { querySelector: () => null } : {}),
  }
  // Watching for a sprite that never arrives must not throw either.
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  }
  return head
}

/**
 * Run `apply` against one host shape.
 * @param overrides - services this host exposes, merged over a full stub.
 * @param dom - DOM capabilities this host has; defaults to a full minimal DOM.
 * @returns everything the run observed.
 */
function runAgainst(overrides = {}, dom = {}) {
  const head = installDom(dom)
  const warnings = []
  const errors = []
  const realWarn = console.warn
  const realError = console.error
  console.warn = (...args) => { warnings.push(args.join(' ')) }
  console.error = (...args) => { errors.push(args.join(' ')) }

  const slots = []
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    theme: { overrideTokens: () => () => {} },
    // `bind`/`subscribe` are the LocaleFace members the hint effect uses; the
    // stub echoes keys so the written value stays observable.
    locale: { register: () => () => {}, bind: () => key => key, subscribe: () => () => {} },
    slots: {
      inject: (name) => { slots.push(name); return () => {} },
      register: () => () => {},
    },
    ...overrides,
  }

  let thrown = null
  try {
    skin.apply(ctx)
  } catch (error) {
    thrown = error
  } finally {
    console.warn = realWarn
    console.error = realError
  }
  return {
    thrown,
    warnings,
    errors,
    slots,
    styleTags: head.children.length,
    styleWrites: head.styleWrites,
  }
}

/* ---- the declaration itself ------------------------------------------- */

// `inject` is the one line that can kill the whole window: a name the host does
// not mount turns into a fatal boot entry, whether or not the skin ever uses it.
check('inject 不含 layout（硬依赖会让缺该服务的宿主整窗启动失败）',
  !skin.inject.includes('layout'), skin.inject.join(', '))
check('inject 仍声明皮肤真正用到的服务',
  ['slots', 'theme', 'locale'].every(name => skin.inject.includes(name)), skin.inject.join(', '))

/* ---- every host shape, silent and throw-free -------------------------- */

/* A `ui-layout` that throws on *any* property read. The skin must never touch
   it: reaching for a service it does not need is how the whole window died
   before. */
const sealedLayout = new Proxy({}, {
  get(_, key) { throw new Error(`皮肤访问了 layout.${String(key)}`) },
  has() { throw new Error('皮肤探测了 layout') },
})

const shapes = [
  // The stock host: every declared service mounted, full DOM.
  ['完整宿主', {}, {}],
  // A layout service that cannot be read at all — proves the skin leaves it be.
  ['layout 不可访问', { layout: sealedLayout }, {}],
  // A host that does not mount the layout service at all.
  ['无 layout 服务', { layout: undefined }, {}],
  // Partial shims and non-browser runs.
  ['DOM 无 querySelector', {}, { querySelector: false }],
]

for (const [label, overrides, dom] of shapes) {
  const run = runAgainst(overrides, dom)
  check(`${label}：apply 不抛错`, run.thrown === null, run.thrown?.message ?? '')
  check(`${label}：控制台无输出`,
    run.warnings.length === 0 && run.errors.length === 0,
    [...run.warnings, ...run.errors].map(line => line.slice(0, 70)).join(' | '))
  check(`${label}：样式表已挂载`, run.styleTags === 1, String(run.styleTags))
}

/* ---- the seats the skin actually fills -------------------------------- */

const stock = runAgainst()

// The rename dialogs read their hint from this variable; a quoted CSS string is
// the only shape `content: var(--skin-rename-hint)` accepts.
check('重命名提示写入皮肤变量',
  stock.styleWrites.some(([name, value]) => name === '--skin-rename-hint' && /^".*"$/.test(value)),
  JSON.stringify(stock.styleWrites))
check('英雄区座位已申请',
  stock.slots.includes('conversation.hero.content'), stock.slots.join(', ') || '(无)')

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length > 0) console.log(`失败：${failed.map(f => f.name).join('、')}`)
process.exit(failed.length === 0 ? 0 : 1)
