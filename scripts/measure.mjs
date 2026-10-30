#!/usr/bin/env node
/**
 * Re-derive the design tokens from `reference/screenshot.png`.
 *
 * The reference is a 2604x1480 PNG (DPR 2), so every measurement is divided by
 * SCALE to reach CSS pixels. Run it whenever the reference changes:
 *
 *   node scripts/measure.mjs
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCALE = 2
const here = dirname(fileURLToPath(import.meta.url))
const file = join(here, '..', 'reference', 'screenshot.png')

/**
 * Minimal PNG decoder (8-bit RGB/RGBA, no interlacing) so the script has no
 * dependency on an image library.
 * @param {string} path
 */
function decode(path) {
  const buf = readFileSync(path)
  let pos = 8
  let idat = Buffer.alloc(0)
  let width = 0
  let height = 0
  let colorType = 0
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString('latin1')
    const data = buf.subarray(pos + 8, pos + 8 + length)
    pos += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat = Buffer.concat([idat, data])
    } else if (type === 'IEND') break
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  const raw = inflateSync(idat)
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    const line = Buffer.from(raw.subarray(p, p + stride))
    p += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      if (filter === 1) line[i] = (line[i] + a) & 255
      else if (filter === 2) line[i] = (line[i] + b) & 255
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        line[i] = (line[i] + pr) & 255
      }
    }
    line.copy(out, y * stride)
    prev = line
  }
  return { width, height, channels, pixels: out }
}

const img = decode(file)
const at = (x, y) => {
  const i = (y * img.width + x) * img.channels
  return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]]
}
const hex = ([r, g, b]) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
const css = v => Math.round((v / SCALE) * 10) / 10

/** Bounding box of every pixel matching `pred` inside a region. */
function bbox(pred, [x0, y0, x1, y1]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!pred(at(x, y))) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
const near = (target, tol = 2) => (c) => c.every((v, i) => Math.abs(v - target[i]) <= tol)
const report = (name, box) => ({
  name,
  x: css(box.x),
  y: css(box.y),
  width: css(box.width),
  height: css(box.height),
})

const W = img.width
const H = img.height

/** First x where the sidebar colour stops, scanning the middle of the frame. */
let sidebarEdge = W
for (let x = 0; x < W; x++) {
  if (!near([251, 251, 251], 2)(at(x, Math.round(H * 0.5)))) { sidebarEdge = x; break }
}

const tokens = {
  reference: `${W}x${H} @${SCALE}x → ${W / SCALE}x${H / SCALE} CSS`,
  colors: {
    sidebar: hex(at(40, Math.round(H * 0.4))),
    main: hex(at(Math.round(W * 0.8), Math.round(H * 0.4))),
    text: hex(at(Math.round(W * 0.55), Math.round(H * 0.5))),
  },
  geometry: [
    { name: 'sidebar width', width: css(sidebarEdge) },
    report('hero tile (mark strokes)', bbox(c => c[0] < 120, [1200, 300, 1900, 700])),
    report('hero title', bbox(c => c[0] < 80, [500, 680, 2600, 830])),
    report('suggestion chips', bbox(c => c[0] > 230 && c[0] < 242, [700, 830, 2100, 1000])),
    report('workspace tray', bbox(near([243, 243, 243], 2), [500, 1000, 2600, 1300])),
  ],
}

console.log(JSON.stringify(tokens, null, 2))
