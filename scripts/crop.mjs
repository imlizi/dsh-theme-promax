/**
 * Crop and nearest-neighbour zoom a PNG so corner radii and row rhythm can be
 * read at 4–8x. Uses the shared decoder and a minimal zlib-backed encoder.
 *
 *   node scripts/crop.mjs <png> <x> <y> <w> <h> <zoom> <out>
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { decode } from './png.mjs'

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buf) => {
  let c = 0xFFFFFFFF
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const encode = (width, height, rgb) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const [path, xs, ys, ws, hs, zs, out] = process.argv.slice(2)
const x0 = Number(xs)
const y0 = Number(ys)
const w = Number(ws)
const h = Number(hs)
const zoom = Number(zs)
const img = decode(path)
const at = (x, y) => {
  const i = (y * img.width + x) * img.channels
  return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]]
}
const ow = w * zoom
const oh = h * zoom
const buf = Buffer.alloc(ow * oh * 3)
for (let y = 0; y < oh; y++) {
  for (let x = 0; x < ow; x++) {
    const [r, g, b] = at(
      Math.min(x0 + Math.floor(x / zoom), img.width - 1),
      Math.min(y0 + Math.floor(y / zoom), img.height - 1),
    )
    const o = (y * ow + x) * 3
    buf[o] = r
    buf[o + 1] = g
    buf[o + 2] = b
  }
}
writeFileSync(out, encode(ow, oh, buf))
console.log(`${out} ${ow}x${oh}`)
