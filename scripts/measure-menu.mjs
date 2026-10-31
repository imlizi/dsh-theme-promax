/**
 * Read a menu capture the way the stylesheet needs it: card rect and radius,
 * per-row icon/label columns, row pitch, separators, and the hover fill.
 *
 *   node scripts/measure-menu.mjs <png> [--scale 2]
 *
 * The card is found by its shadow line rather than by "the lightest region",
 * because the page behind a menu is often near-white too.
 */
import { decode, helpers } from './png.mjs'

const argv = process.argv.slice(2)
const path = argv[0]
const scaleArg = argv.indexOf('--scale')
const scale = scaleArg < 0 ? 2 : Number(argv[scaleArg + 1])

const img = decode(path)
const { at, hex } = helpers(img, scale)
const css = v => Math.round((v / scale) * 10) / 10
const lum = (x, y) => {
  const [r, g, b] = at(x, y)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Longest run of `pred` on one scanline. */
function run(x0, x1, y, pred) {
  let best = [0, -1], start = -1
  for (let x = x0; x <= x1; x++) {
    const ok = pred(x, y)
    if (ok && start < 0) start = x
    if ((!ok || x === x1) && start >= 0) {
      const end = ok ? x : x - 1
      if (end - start > best[1] - best[0]) best = [start, end]
      start = -1
    }
  }
  return best
}

const light = (x, y) => lum(x, y) > 246
// Horizontal card extent: the widest light run on the tallest scanline.
let card = null
for (let y = 0; y < img.height; y++) {
  const [a, b] = run(0, img.width - 1, y, light)
  if (card === null || b - a > card.right - card.left) card = { left: a, right: b }
}
const midX = Math.round((card.left + card.right) / 2)

// Vertical extent: the card's edge is the shadow line, so the top is the row
// after the first dark pixel that is followed by a run of light ones. The probe
// column sits in the card's left padding, where no label can be mistaken for an
// edge. Page and card fill are only four levels apart, hence the narrow bands.
const probeX = card.left + 4
const cardish = y => lum(probeX, y) >= 243
let top = -1
for (let y = 1; y < img.height - 10; y++) {
  if (lum(probeX, y) >= 236) continue
  let clear = true
  for (let k = 1; k <= 8; k++) if (!cardish(y + k)) { clear = false; break }
  if (clear) { top = y + 1; break }
}
if (top < 0) { top = 0; while (top < img.height && !light(card.left + 2, top)) top++ }
let bottom = img.height - 1
for (let y = top; y < img.height; y++) {
  if (lum(probeX, y) < 236) { bottom = y - 1; break }
}

console.log(`${path}  ${img.width}x${img.height} @${scale}`)
console.log(`card  dev ${card.left},${top} ${card.right - card.left + 1}x${bottom - top + 1}`
  + `  css ${css(card.right - card.left + 1)}x${css(bottom - top + 1)}  fill ${hex(at(midX, top + 3))}`)

// Radius: horizontal inset of the card's first row.
let inset = 0
while (inset < 200 && !light(card.left + inset, top + 1)) inset++
console.log(`radius ~ css ${css(inset)} (first-row inset)`)

// Rows: bands of ink, then per-band column runs.
const bands = []
let cur = null
for (let y = top; y <= bottom; y++) {
  let n = 0
  for (let x = card.left + 1; x < card.right; x++) if (lum(x, y) < 190) n++
  if (n > 0) {
    if (cur === null) cur = { from: y, to: y }
    else cur.to = y
  } else if (cur !== null) { bands.push(cur); cur = null }
}
if (cur !== null) bands.push(cur)

console.log('\nrows (css from card top):')
let prev = null
for (const band of bands) {
  const cols = []
  for (let x = card.left; x <= card.right; x++) {
    let ink = false
    for (let y = band.from; y <= band.to; y++) if (lum(x, y) < 190) { ink = true; break }
    cols.push(ink)
  }
  const runs = []
  let s = -1, gap = 0
  for (let i = 0; i < cols.length; i++) {
    if (cols[i]) { if (s < 0) s = i; gap = 0 }
    else if (s >= 0) { gap++; if (gap >= 6) { runs.push([s + card.left, i - gap + card.left]); s = -1; gap = 0 } }
  }
  if (s >= 0) runs.push([s + card.left, cols.length - 1 + card.left])
  const pitch = prev === null ? '' : `  pitch ${css(band.from - prev)}`
  prev = band.from
  console.log(`  y ${css(band.from - top)}..${css(band.to - top)}  h${css(band.to - band.from + 1)}${pitch}`)
  console.log(`     cols ${runs.map(([a, b]) => `${css(a - card.left)}-${css(b - card.left)}(w${css(b - a + 1)})`).join(' ')}`)
}

// Separators: rows whose only ink is a thin mid-grey horizontal run.
console.log('\nseparators (css y from card top, x from card left):')
for (let y = top; y <= bottom; y++) {
  const [a, b] = run(card.left + 1, card.right - 1, y, (x, yy) => {
    const v = lum(x, yy)
    return v > 170 && v < 244
  })
  if (b - a > (card.right - card.left) * 0.6) {
    const above = y > top ? lum(midX, y - 1) : 0
    const below = y < bottom ? lum(midX, y + 1) : 0
    if (above > 244 && below > 244) {
      console.log(`  y ${css(y - top)}  x ${css(a - card.left)}..${css(b - card.left)}  ${hex(at(a + 2, y))}`)
    }
  }
}

// Hover fill: the flat band that is neither card nor page.
console.log('\nhover fill rows:')
let hoverTop = -1, hoverBottom = -1
for (let y = top; y <= bottom; y++) {
  const [a, b] = run(card.left + 1, card.right - 1, y, (x, yy) => {
    const v = lum(x, yy)
    return v >= 243 && v <= 251
  })
  if (b - a > (card.right - card.left) * 0.7) {
    if (hoverTop < 0) hoverTop = y
    hoverBottom = y
    if (y === hoverTop) console.log(`  from y ${css(y - top)}  x ${css(a - card.left)}..${css(b - card.left)}  ${hex(at(a + 3, y))}`)
  }
}
if (hoverTop >= 0) console.log(`  to y ${css(hoverBottom - top)}  h ${css(hoverBottom - hoverTop + 1)}`)
