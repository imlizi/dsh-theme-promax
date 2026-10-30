/**
 * Minimal PNG reader shared by the measurement scripts.
 *
 * Handles the subset the reference screenshots actually use: 8-bit RGB/RGBA,
 * non-interlaced. Keeping it dependency-free means `measure` and `probe` can run
 * before `pnpm install` ever touches the skin package.
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

/**
 * @param {string} path
 * @returns {{ width: number, height: number, channels: number, pixels: Buffer }}
 */
export function decode(path) {
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

/**
 * Bind helpers to a decoded image: `at` reads a pixel, `hex` formats it, `css`
 * converts device pixels to CSS pixels for a DPR-2 capture.
 * @param {ReturnType<typeof decode>} img
 * @param {number} scale
 */
export function helpers(img, scale) {
  const at = (x, y) => {
    const i = (y * img.width + x) * img.channels
    return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]]
  }
  const hex = ([r, g, b]) =>
    `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  const css = v => Math.round((v / scale) * 10) / 10
  const near = (target, tol = 2) => c => c.every((v, i) => Math.abs(v - target[i]) <= tol)
  return { at, hex, css, near }
}
