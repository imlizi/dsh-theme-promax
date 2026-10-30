#!/usr/bin/env node
/**
 * Structural probe: turn a screenshot into a vertical layout map.
 *
 * For every device row it counts how many pixels differ from that row's own
 * background sample, then groups consecutive non-empty rows into bands. Reading
 * bands is how we get "tile starts at y, headline starts at y, card starts at y"
 * without eyeballing a scaled preview.
 *
 * Sampling the background per row (rather than once for the image) keeps the
 * sidebar's vertical gradient and the main area's plain white both working.
 *
 *   node scripts/probe.mjs reference/screenshot.png
 *   node scripts/probe.mjs .artifacts/shot.png --sidebar 241
 *
 * Output is in CSS pixels; captures are DPR 2.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { decode, helpers } from './png.mjs'

const SCALE = 2
const here = dirname(fileURLToPath(import.meta.url))

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(argv[i + 1])
}
const target = resolve(argv[0] ?? join(here, '..', 'reference', 'screenshot.png'))
const minInk = flag('min-ink', 3)
const gap = flag('gap', 4)
/** Device-pixel inset that keeps the window's own border and shadow out of the scan. */
const pad = flag('pad', 8)

const img = decode(target)
const { at, hex, css } = helpers(img, SCALE)
const W = img.width
const H = img.height

/** Sidebar edge in device px: first column that stops matching the sidebar tint. */
function findSidebarEdge() {
  const forced = flag('sidebar', 0)
  if (forced) return Math.round(forced * SCALE)
  const mid = Math.round(H * 0.5)
  for (let x = 0; x < W; x++) {
    const [r, g, b] = at(x, mid)
    if (Math.abs(r - 251) > 2 || Math.abs(g - 251) > 2 || Math.abs(b - 251) > 2) return x
  }
  return 0
}
const edge = findSidebarEdge()

/**
 * Group non-empty rows into bands inside `[x0, x1)`.
 * `xProbe` is the column used to sample each row's background.
 */
function bands(x0, x1, xProbe, { tol = 5 } = {}) {
  const out = []
  let cur = null
  let blank = 0
  for (let y = pad; y < H - pad; y++) {
    const bg = at(xProbe, y)
    let n = 0
    let minX = Infinity
    let maxX = -1
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = at(x, y)
      if (Math.abs(r - bg[0]) <= tol && Math.abs(g - bg[1]) <= tol && Math.abs(b - bg[2]) <= tol) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    if (n >= minInk) {
      if (cur && blank <= gap) {
        cur.y1 = y
        cur.minX = Math.min(cur.minX, minX)
        cur.maxX = Math.max(cur.maxX, maxX)
        cur.ink += n
      } else {
        if (cur) out.push(cur)
        cur = { y0: y, y1: y, minX, maxX, ink: n }
      }
      blank = 0
    } else if (cur) {
      blank++
    }
  }
  if (cur) out.push(cur)
  return out.map(b => ({
    y0: css(b.y0),
    y1: css(b.y1 + 1),
    h: css(b.y1 + 1 - b.y0),
    x0: css(b.minX),
    x1: css(b.maxX + 1),
    w: css(b.maxX + 1 - b.minX),
    ink: b.ink,
  }))
}

console.log(
  JSON.stringify(
    {
      image: `${W}x${H} @${SCALE}x → ${css(W)}x${css(H)} CSS`,
      sidebar: { edge: css(edge), bgTop: hex(at(pad, pad)), bgBottom: hex(at(pad, H - pad)) },
      'sidebar bands': bands(pad, edge - pad, pad),
      'main bands': bands(edge + 2, W - pad * 2, edge + pad),
    },
    null,
    2,
  ),
)
