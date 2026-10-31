/**
 * Compare the shipped rename dialog against the reference capture.
 *
 * Both images are DPR-2. The card is located by its own fill and every
 * measurement below is reported relative to the card's own top-left corner, so
 * the two captures can be diffed without knowing where each was framed.
 *
 *   node scripts/compare-rename.mjs <reference.png> <capture.png> [--dark]
 *
 * `--dark` swaps the card-finding and ink thresholds for a dark-scheme capture;
 * it is meant for comparing two dark captures, not a dark one to the reference.
 */
import { decode, helpers } from './png.mjs'

const argv = process.argv.slice(2)
const dark = argv.includes('--dark')
const [refPath, shotPath] = argv.filter(arg => !arg.startsWith('--'))

/** Locate the card and measure its contents in card-relative CSS pixels. */
function probe(path, dark) {
  const img = decode(path)
  const { at, hex } = helpers(img, 2)
  const lum = (x, y) => {
    const [r, g, b] = at(x, y)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const css = v => Math.round((v / 2) * 10) / 10
  const isCard = dark ? (x, y) => lum(x, y) > 25 && lum(x, y) < 60 : (x, y) => lum(x, y) > 246

  // The card is the largest run of its own fill on the middle row.
  let best = null
  for (let y = 4; y < img.height - 4; y += 2) {
    let start = -1
    for (let x = 0; x < img.width; x++) {
      if (isCard(x, y) && start < 0) start = x
      if ((!isCard(x, y) || x === img.width - 1) && start >= 0) {
        const end = isCard(x, y) ? x : x - 1
        if (best === null || end - start > best.width) best = { left: start, right: end, width: end - start, y }
        start = -1
      }
    }
  }
  const { left, right } = best
  const midX = Math.round((left + right) / 2)
  let top = 0
  while (top < img.height && !isCard(midX, top)) top++
  let bottom = img.height - 1
  while (bottom > 0 && !isCard(midX, bottom)) bottom--

  // In the light capture "ink" is darker than the card; in the dark one it is
  // brighter, so the comparison flips with the scheme.
  const box = (x0, y0, x1, y1, thresh) => {
    let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1
    for (let y = Math.max(0, y0); y <= Math.min(img.height - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(img.width - 1, x1); x++) {
        const v = lum(x, y)
        if (dark ? v > thresh : v < thresh) {
          bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x)
          by0 = Math.min(by0, y); by1 = Math.max(by1, y)
        }
      }
    }
    if (bx1 < 0) return null
    return {
      x: css(bx0 - left), y: css(by0 - top),
      w: css(bx1 - bx0 + 1), h: css(by1 - by0 + 1),
      right: css(bx1 - left), bottom: css(by1 - top),
    }
  }
  const cx = v => left + Math.round(v * 2)
  const cy = v => top + Math.round(v * 2)
  // Per-part thresholds: text sits far from the card fill, hairlines do not.
  const T = dark
    ? { text: 110, hint: 100, field: 45, close: 70, button: 45 }
    : { text: 200, hint: 200, field: 240, close: 160, button: 250 }

  return {
    card: { w: css(right - left + 1), h: css(bottom - top + 1) },
    cardFill: hex(at(midX, top + 8)),
    title: box(cx(20), cy(16), cx(300), cy(48), T.text),
    hint: box(cx(20), cy(48), cx(300), cy(76), T.hint),
    field: box(cx(18), cy(78), cx(402), cy(126), T.field),
    close: box(cx(370), cy(8), cx(416), cy(44), T.close),
    cancel: box(cx(240), cy(126), cx(332), cy(170), T.button),
    primary: box(cx(332), cy(126), cx(404), cy(170), T.button),
    primaryFill: hex(at(cx(396), cy(150))),
    cancelFill: hex(at(cx(255), cy(150))),
    border: hex(at(cx(20), cy(102))),
  }
}

const ref = probe(refPath, dark)
const shot = probe(shotPath, dark)
const keys = Object.keys(ref)
const fmt = v => (typeof v === 'object' && v !== null
  ? `x${v.x} y${v.y} ${v.w}x${v.h}`
  : String(v))
console.log('metric'.padEnd(12), 'reference'.padEnd(34), 'capture')
for (const k of keys) {
  const a = fmt(ref[k])
  const b = fmt(shot[k])
  console.log(k.padEnd(12), a.padEnd(34), b, a === b ? '' : '  ←')
}
