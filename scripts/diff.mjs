#!/usr/bin/env node
/**
 * Compare the shot against the reference and report where it still differs.
 *
 *   node scripts/diff.mjs [--shot .artifacts/shot.png] [--out .artifacts]
 *
 * Two thresholds: a blurred pass (T=12) counts differences a human would see
 * once font antialiasing is smoothed away; a raw pass (T=48) counts hard
 * differences. Window decoration (outer border, traffic lights) is masked and
 * counted separately so it never hides a real regression.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = '/Users/zctech/Code/deepseek-harness'
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const fromApp = createRequire(join(REPO, 'apps/web/package.json'))
const sharp = fromApp('sharp')

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const shotPath = resolve(root, args.get('--shot') ?? '.artifacts/shot.png')
const outDir = resolve(root, args.get('--out') ?? '.artifacts')
const refPath = resolve(root, 'reference/screenshot.png')

if (!existsSync(shotPath)) {
  console.error(`missing shot: ${shotPath} — run scripts/shot.mjs first`)
  process.exit(2)
}

const SCALE = 2
const VISIBLE_T = 12
const HARD_T = 48

/** CSS-space rectangles. Region coordinates are fixed so a shifted layout cannot hide. */
const REGIONS = [
  { name: 'sidebar', x0: 0, y0: 0, x1: 241.5, y1: 740 },
  { name: 'hero', x0: 241.5, y0: 170, x1: 1302, y1: 500 },
  { name: 'composer', x0: 241.5, y0: 560, x1: 1302, y1: 740 },
  { name: 'rest', x0: 241.5, y0: 0, x1: 1302, y1: 740 },
]

/** Pixels excluded from every region: window border and native traffic lights. */
function masked(cssX, cssY) {
  if (cssX < 4 || cssY < 4 || cssX > 1298 || cssY > 736) return 'border'
  if (cssX >= 6 && cssX <= 86 && cssY >= 6 && cssY <= 34) return 'trafficLights'
  return null
}

const ref = await sharp(refPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const shot = await sharp(shotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
if (ref.info.width !== shot.info.width || ref.info.height !== shot.info.height) {
  console.error(`size mismatch: reference ${ref.info.width}x${ref.info.height}, shot ${shot.info.width}x${shot.info.height}`)
  process.exit(3)
}

const smoothRef = (await sharp(refPath).blur(0.8).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data
const smoothShot = (await sharp(shotPath).blur(0.8).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data

const width = ref.info.width
const height = ref.info.height
const channels = ref.info.channels

const stats = new Map(REGIONS.map(r => [r.name, { visible: 0, hard: 0, total: 0, minX: 1e9, minY: 1e9, maxX: -1, maxY: -1 }]))
const decoration = { border: 0, trafficLights: 0 }
const diffPixels = Buffer.alloc(width * height * 3)
let globalVisible = 0

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const o = (y * width + x) * 3
    const cssX = x / SCALE
    const cssY = y / SCALE
    const mask = masked(cssX, cssY)

    let visible = 0
    let hard = 0
    for (let c = 0; c < 3; c++) {
      visible = Math.max(visible, Math.abs(smoothRef[i + c] - smoothShot[i + c]))
      hard = Math.max(hard, Math.abs(ref.data[i + c] - shot.data[i + c]))
    }

    const grey = Math.round(0.3 * ref.data[i] + 0.59 * ref.data[i + 1] + 0.11 * ref.data[i + 2])
    const paint = visible > VISIBLE_T
    diffPixels[o] = paint ? 255 : grey
    diffPixels[o + 1] = paint ? 40 : grey
    diffPixels[o + 2] = paint ? 40 : grey

    if (mask !== null) {
      if (visible > VISIBLE_T) decoration[mask] += 1
      continue
    }
    if (visible <= VISIBLE_T) continue
    globalVisible += 1
    for (const region of REGIONS) {
      if (cssX < region.x0 || cssX > region.x1 || cssY < region.y0 || cssY > region.y1) continue
      const s = stats.get(region.name)
      s.visible += 1
      if (hard > HARD_T) s.hard += 1
      s.minX = Math.min(s.minX, cssX)
      s.minY = Math.min(s.minY, cssY)
      s.maxX = Math.max(s.maxX, cssX)
      s.maxY = Math.max(s.maxY, cssY)
    }
  }
}

for (const region of REGIONS) {
  const s = stats.get(region.name)
  s.total = Math.round((region.x1 - region.x0) * (region.y1 - region.y0))
}

mkdirSync(outDir, { recursive: true })
await sharp(diffPixels, { raw: { width, height, channels: 3 } }).png().toFile(resolve(outDir, 'diff.png'))

const regionsPath = resolve(outDir, 'regions.json')
const measured = existsSync(regionsPath) ? JSON.parse(readFileSync(regionsPath, 'utf8')) : { rects: {} }
const EXPECTED = {
  sidebarWidth: 240.5,
  tileWidth: 110,
  // The reference headline is measured as ink (365.5..391.5); its element box
  // starts 3.2px above that at 26.7px/1.2, so the box target is 362.3.
  titleBoxTop: 362.3,
  chipsTop: 427,
  chipsHeight: 34,
  trayTop: 594,
  trayWidth: 708,
  cardTop: 632,
  cardWidth: 735,
  cardHeight: 90.5,
}

const pct = v => `${(v * 100).toFixed(2)}%`
const lines = []
lines.push('# 视觉差距报告', '')
lines.push(`- 参考图 ${ref.info.width}x${ref.info.height}，实拍 ${shot.info.width}x${shot.info.height}`)
lines.push(`- 可见差（blur 0.8, T=${VISIBLE_T}）：${globalVisible} px，占全图 ${pct(globalVisible / (width * height))}`)
lines.push(`- 装饰区排除：边框 ${decoration.border} px，交通灯 ${decoration.trafficLights} px`, '')
lines.push('| 区域 | 可见差 px | 占该区 | 硬差 px | 差异范围 (CSS) |')
lines.push('|---|---|---|---|---|')
for (const region of REGIONS) {
  const s = stats.get(region.name)
  const range = s.visible === 0 ? '—' : `x ${s.minX.toFixed(0)}–${s.maxX.toFixed(0)}, y ${s.minY.toFixed(0)}–${s.maxY.toFixed(0)}`
  lines.push(`| ${region.name} | ${s.visible} | ${pct(s.visible / s.total)} | ${s.hard} | ${range} |`)
}

const r = measured.rects ?? {}
lines.push('', '## 几何（实测 vs 参考）', '')
lines.push('| 项 | 实测 | 参考 | 差 |')
lines.push('|---|---|---|---|')
const geo = [
  ['侧栏宽', r.sidebar?.width, EXPECTED.sidebarWidth],
  ['托盘顶边 y', r.tray?.y, EXPECTED.trayTop],
  ['托盘宽', r.tray?.width, EXPECTED.trayWidth],
  ['输入卡顶边 y', r.card?.y, EXPECTED.cardTop],
  ['输入卡宽', r.card?.width, EXPECTED.cardWidth],
  ['输入卡高', r.card?.height, EXPECTED.cardHeight],
]
for (const [name, got, want] of geo) {
  const delta = typeof got === 'number' ? (got - want).toFixed(1) : '—'
  lines.push(`| ${name} | ${typeof got === 'number' ? got.toFixed(1) : '未找到'} | ${want} | ${delta} |`)
}

const verdict = (stats.get('hero').visible / stats.get('hero').total) < 0.02
  && (stats.get('composer').visible / stats.get('composer').total) < 0.02
lines.push('', `## 结论`, '', verdict ? 'hero 与输入卡区域已接近（<2%）' : 'hero 或输入卡仍有可见差距（>2%），见上表与 diff.png')
if (measured.blocked && (measured.blocked.inert || measured.blocked.dialogs?.length > 0)) {
  lines.push('', '> 注意：截图时页面被对话框遮挡，本报告不可用。')
}
if (measured.errors?.length > 0) {
  lines.push('', '## 控制台错误', '', ...measured.errors.slice(0, 5).map(e => `- ${e}`))
}

writeFileSync(resolve(outDir, 'report.md'), `${lines.join('\n')}\n`)
console.log(lines.join('\n'))
