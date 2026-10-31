#!/usr/bin/env node
/**
 * Turn an SVG sprite into the skin's icon overrides.
 *
 *   node scripts/import-sprite.mjs --in ~/Downloads/icons.svg --map scripts/icon-map.txt
 *   node scripts/import-sprite.mjs --in icons.svg --dry-run
 *
 * The app renders every icon as `<use href="#dsw-icon-<glyph>-<weight>">`, so an
 * imported sprite has to answer one question per glyph: which of its symbols
 * stands in for it. Two ways to answer:
 *
 *   - automatically, when the sprite already speaks the product vocabulary —
 *     `dsw-icon-apps-add-outline-regular`, or the bare glyph name
 *     `apps-add-outline` (which then serves both weights);
 *   - through a map file, `glyph=spriteSymbol` per line, for a sprite with its
 *     own naming (this is the normal case for a design-system export).
 *
 * Anything left unanswered keeps the shipped artwork, so a partial sprite is a
 * valid result rather than a broken app.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = '/Users/zctech/Code/deepseek-harness'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARTWORK = join(REPO, 'packages/client/ui-primitives/src/icons/artwork.ts')

const WEIGHTS = ['regular', 'medium']

/** Every glyph the product set ships, read from the upstream artwork table. */
function productGlyphs() {
  const source = readFileSync(ARTWORK, 'utf8')
  return new Set([...source.matchAll(/^ {2}'([a-z0-9-]+)': \{ size:/gm)].map(match => match[1]))
}

/**
 * Pull `<symbol>` elements out of a sprite.
 *
 * Attribute order and quoting vary by exporter, so this walks the opening tag
 * rather than assuming one shape; nesting is not a concern because `<symbol>`
 * cannot contain another.
 * @param source - sprite file contents.
 * @returns one record per symbol: its id, the attributes to carry over, and its inner markup.
 */
function readSymbols(source) {
  const symbols = []
  for (const match of source.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const attributes = match[1]
    const id = /\bid\s*=\s*"([^"]+)"/.exec(attributes)?.[1] ?? /\bid\s*=\s*'([^']+)'/.exec(attributes)?.[1]
    if (id === undefined) continue
    // The wrapper drops the id (it becomes the symbol's own id) and keeps the
    // geometry attributes: viewBox above all, plus fill/stroke defaults.
    const carried = attributes.replace(/\bid\s*=\s*(?:"[^"]*"|'[^']*')/, '').trim()
    symbols.push({ id, carried, inner: match[2].trim() })
  }
  return symbols
}

/**
 * Prefix a symbol's internal element ids so several symbols can live in one
 * document.
 *
 * Every icon ends up in ui-theme's single sprite, so two symbols that both name
 * a mask `mask` would collide and the second would silently paint with the
 * first's geometry — the shipped artwork avoids this by naming masks
 * `dsw-icon-<glyph>-<weight>-mask`. Exporters do not know about that, so the
 * importer rewrites each id and every reference to it.
 * @param markup - the symbol's inner markup.
 * @param prefix - the product id the symbol is being imported as.
 * @returns markup whose ids are unique document-wide.
 */
function scopeIds(markup, prefix) {
  const ids = new Set([...markup.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map(match => match[1]))
  if (ids.size === 0) return markup
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let out = markup
  // References first, so the id rewrite below cannot double-prefix them.
  for (const id of ids) {
    out = out
      .replace(new RegExp(`url\\(\\s*#${escape(id)}\\s*\\)`, 'g'), `url(#${prefix}-${id})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*["'])#${escape(id)}(["'])`, 'g'), `$1#${prefix}-${id}$2`)
  }
  for (const id of ids) {
    out = out.replace(new RegExp(`(\\sid\\s*=\\s*["'])${escape(id)}(["'])`, 'g'), `$1${prefix}-${id}$2`)
  }
  return out
}

const args = new Map()
const aliases = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (arg === '--dry-run') { args.set(arg, true); continue }
  if (arg === '--map') {
    const path = process.argv[i + 1]
    if (path === undefined) {
      console.error('--map 需要一个映射表路径')
      process.exit(1)
    }
    for (const line of readFileSync(resolve(path), 'utf8').split('\n')) {
      const text = line.replace(/#.*/, '').trim()
      if (text === '') continue
      const [glyph, spriteId] = text.split('=').map(part => part.trim())
      if (glyph === undefined || spriteId === undefined || spriteId === '') {
        console.error(`映射表这一行看不懂：${line.trim()}`)
        process.exit(1)
      }
      aliases.set(glyph, spriteId)
    }
    i += 1
    continue
  }
  if (arg === '--alias') {
    const [glyph, spriteId] = (process.argv[i + 1] ?? '').split('=').map(part => part?.trim())
    if (glyph === undefined || spriteId === undefined || spriteId === '') {
      console.error(`--alias 需要 <图标名>=<精灵id> 形式，收到 "${process.argv[i + 1] ?? ''}"`)
      process.exit(1)
    }
    aliases.set(glyph, spriteId)
    i += 1
    continue
  }
  args.set(arg, process.argv[i + 1])
  i += 1
}

const input = args.get('--in')
if (typeof input !== 'string') {
  console.error('用法: node scripts/import-sprite.mjs --in <精灵图.svg> [--map <映射表>] [--dry-run]')
  process.exit(1)
}

const glyphs = productGlyphs()
const symbols = readSymbols(readFileSync(resolve(input), 'utf8'))
if (symbols.length === 0) {
  console.error(`✗ ${input} 里没有 <symbol> 元素。精灵图需要是 <svg><symbol id="…">…</symbol>…</svg> 形式。`)
  process.exit(1)
}
const byId = new Map(symbols.map(symbol => [symbol.id, symbol]))

/** Product ids one glyph's artwork fills: both weights. */
const productIdsFor = glyph => WEIGHTS.map(weight => `dsw-icon-${glyph}-${weight}`)

/** Assignments: product id → the sprite symbol standing in for it. */
const assignments = new Map()
const unknownGlyphs = []

// 1. The map file: the sprite's own vocabulary.
for (const [glyph, spriteId] of aliases) {
  if (!glyphs.has(glyph)) { unknownGlyphs.push(glyph); continue }
  const symbol = byId.get(spriteId)
  if (symbol === undefined) {
    console.error(`✗ 映射表把 ${glyph} 指到 "${spriteId}"，但精灵图里没有这个 symbol`)
    process.exit(1)
  }
  for (const id of productIdsFor(glyph)) assignments.set(id, symbol)
}

// 2. Automatic: symbols that already speak the product vocabulary.
for (const symbol of symbols) {
  if (/^dsw-icon-.+-(regular|medium)$/.test(symbol.id)) { assignments.set(symbol.id, symbol); continue }
  if (glyphs.has(symbol.id)) {
    for (const id of productIdsFor(symbol.id)) assignments.set(id, symbol)
    continue
  }
  const bare = symbol.id.replace(/-(regular|medium)$/, '')
  if (bare !== symbol.id && glyphs.has(bare)) assignments.set(`dsw-icon-${symbol.id}`, symbol)
}

const overrides = new Map()
for (const [id, symbol] of assignments) {
  const inner = scopeIds(symbol.inner, id)
  overrides.set(id, `<svg xmlns="http://www.w3.org/2000/svg"${symbol.carried === '' ? '' : ` ${symbol.carried}`}>${inner}</svg>`)
}

// ---- report ---------------------------------------------------------------
const usedBy = new Map()
for (const [id, symbol] of assignments) {
  const glyph = id.replace(/^dsw-icon-/, '').replace(/-(regular|medium)$/, '')
  const list = usedBy.get(symbol.id) ?? []
  list.push(glyph)
  usedBy.set(symbol.id, list)
}

const width = Math.max(...symbols.map(symbol => symbol.id.length), 12)
const covered = new Set([...assignments.keys()].map(id => id.replace(/^dsw-icon-/, '').replace(/-(regular|medium)$/, '')))
console.log(`精灵 ${symbols.length} 个 symbol → 覆盖 ${covered.size} 个产品图标（写 ${overrides.size} 条）`)
const unused = []
for (const symbol of symbols) {
  const served = [...new Set(usedBy.get(symbol.id) ?? [])]
  if (served.length === 0) { unused.push(symbol.id); continue }
  console.log(`  ✓ ${symbol.id.padEnd(width)}  ${served.join(', ')}`)
}
if (unused.length > 0) console.log(`\n没用到的 symbol（${unused.length}）：${unused.join(', ')}`)

const uncovered = [...glyphs].filter(glyph => !covered.has(glyph))
if (uncovered.length > 0) {
  console.log(`\n仍用出厂图形的图标（${uncovered.length}）：${uncovered.join(', ')}`)
  console.log('要给它们指定，在映射表里加一行 <图标名>=<精灵id>')
}
if (unknownGlyphs.length > 0) {
  console.error(`\n✗ 映射表里有产品图标不认识的名称：${unknownGlyphs.join(', ')}`)
  process.exit(1)
}

if (args.get('--dry-run') === true) {
  console.log('\n--dry-run：没有写文件。')
  process.exit(0)
}

const body = [...overrides]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, document]) => `  '${id}':\n    ${JSON.stringify(document)},`)
  .join('\n')

const outPath = join(root, 'src/client/sprite-data.ts')
writeFileSync(outPath, `/**
 * Generated by scripts/import-sprite.mjs from ${input} — do not edit by hand.
 *
 * One complete SVG document per product icon id. The client half merges this
 * table under its own one-off overrides, so a regenerated sprite replaces the
 * previous one wholesale and anything the sprite omits falls back to shipped
 * artwork.
 */
export const SPRITE_SYMBOLS: Readonly<Record<string, string>> = {
${body}
}
`)
console.log(`\n已写入 ${outPath}（${overrides.size} 条），重新构建后生效。`)
