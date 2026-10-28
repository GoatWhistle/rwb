import fs from "node:fs"
import path from "node:path"
import { launch } from "../tools/browser.mjs"

const HERE = import.meta.dirname
const OUT = path.join(HERE, "assets")
const glyphs = JSON.parse(fs.readFileSync(path.join(HERE, "data", "glyphs.json"), "utf8"))
const wordmark = fs.readFileSync(path.join(HERE, "..", "src", "img", "wordmark.inline.svg"), "utf8")

const C = {
  ink: "#1D1D1B",
  white: "#FFFFFF",
  cobalt: "#2348FF",
  azure: "#328EF9",
  sky: "#78E9FF",
  cyan: "#3BC4EE",
  rail: "#518FF2",
  violet: "#7F57EB",
  muted: "#8A8A93",
  danger: "#D3263A",
  success: "#0E7C55",
  deep: "#1A36CC",
  slate: "#5E5E66",
}

const jobs = []
const add = (name, w, h, body, viewBox = `0 0 ${w} ${h}`) => jobs.push({ name, w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">${body}</svg>` })

const letters = [...wordmark.matchAll(/<path class="wm-l" style="--i:(\d)" d="([^"]+)"\/>/g)]
for (const [, i, d] of letters) {
  add(`wm-${i}-ink`, 1006, 196, `<path fill="${C.ink}" d="${d}"/>`, "0 0 251.5 49")
}
add("wm-ink", 1006, 196, letters.map(([, , d]) => `<path fill="${C.ink}" d="${d}"/>`).join(""), "0 0 251.5 49")

const markInner = glyphs.mark.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
add("mark", 256, 256, markInner, "0 0 64 64")

for (const [name, inner] of Object.entries(glyphs.icons)) {
  for (const [tone, color] of [["white", C.white], ["cobalt", C.cobalt], ["ink", C.ink], ["violet", C.violet], ["danger", C.danger], ["success", C.success], ["muted", C.muted]]) {
    add(`ico-${name}-${tone}`, 192, 192, `<g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`, "0 0 24 24")
  }
}

const rng = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const N = 10
const A = 42
const B = 21
const T = 34
const PLATES = [
  { name: "raw", top: 530, color: C.violet },
  { name: "core", top: 390, color: C.rail },
  { name: "mart", top: 250, color: C.cyan },
]
const point = (top, u, v) => [500 + (u - v) * A, top + (u + v) * B]
const poly = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
const mix = (hex, other, k) => {
  const a = hex.match(/\w\w/g).map((x) => parseInt(x, 16))
  const b = other.match(/\w\w/g).map((x) => parseInt(x, 16))
  return `#${a.map((v, i) => Math.round(v * (1 - k) + b[i] * k).toString(16).padStart(2, "0")).join("")}`
}
const random = rng(7)
for (const plate of PLATES) {
  const shift = (p) => [p[0], p[1] + T]
  const left = [point(plate.top, 0, N), point(plate.top, N, N), shift(point(plate.top, N, N)), shift(point(plate.top, 0, N))]
  const right = [point(plate.top, N, N), point(plate.top, N, 0), shift(point(plate.top, N, 0)), shift(point(plate.top, N, N))]
  const under = [point(plate.top, 0, 0), point(plate.top, N, 0), point(plate.top, N, N), point(plate.top, 0, N)]
  add(
    `st-${plate.name}-base`,
    1000,
    1000,
    `<polygon points="${poly(left)}" fill="${mix(plate.color.slice(1), "000000", 0.22)}"/><polygon points="${poly(right)}" fill="${mix(plate.color.slice(1), "000000", 0.38)}"/><polygon points="${poly(under)}" fill="${mix(plate.color.slice(1), "000000", 0.45)}"/>`,
  )
  for (let i = 0; i < N; i += 1) {
    let cells = ""
    for (let j = 0; j < N; j += 1) {
      const c = point(plate.top, i + 0.5, j + 0.5)
      const pts = [point(plate.top, i, j), point(plate.top, i + 1, j), point(plate.top, i + 1, j + 1), point(plate.top, i, j + 1)].map((p) => lerp(p, c, 0.07))
      const light = 1 - (i + j) / (2 * N)
      const o = Math.min(1, Math.max(0.35, 0.55 + light * 0.45 - random() * 0.12))
      cells += `<polygon points="${poly(pts)}" fill="${plate.color}" fill-opacity="${o.toFixed(2)}"/>`
    }
    add(`st-${plate.name}-row${i}`, 1000, 1000, `<rect x="0" y="0" width="1000" height="1000" fill="none"/>${cells}`)
  }
}
{
  const top = PLATES[2].top
  const H = 2 * A
  const up = (p) => [p[0], p[1] - H]
  const b0 = point(top, 4, 4)
  const b1 = point(top, 6, 4)
  const b2 = point(top, 6, 6)
  const b3 = point(top, 4, 6)
  add("st-shadow", 1000, 1000, `<polygon points="${poly([b0, b1, b2, b3])}" fill="#000000" fill-opacity="0.18"/>`)
  add(
    "st-cube",
    1000,
    1000,
    `<polygon points="${poly([up(b3), up(b2), b2, b3])}" fill="${C.cobalt}"/><polygon points="${poly([up(b2), up(b1), b1, b2])}" fill="${C.deep}"/><polygon points="${poly([up(b0), up(b1), up(b2), up(b3)])}" fill="#7D93FF"/>`,
  )
}

const series = JSON.parse(fs.readFileSync(path.join(HERE, "data", "series.json"), "utf8"))
const tables = [112650, 103886, 99441, 99224, 99441, 32951, 3095, 71]
const tableColors = [C.cobalt, C.azure, C.cyan, C.rail, C.violet, C.deep, C.sky, C.muted]
const units = tables.map((c) => Math.max(1, Math.round(c / 1000)))
const CELL = 30
const GAP = 5
const cols = Math.ceil(units.reduce((a, b) => a + b, 0) / 19)
const WW = cols * (CELL + GAP)
const WH = 19 * (CELL + GAP)
let k = 0
units.forEach((u, t) => {
  let rects = ""
  for (let n = 0; n < u; n += 1) {
    const col = Math.floor(k / 19)
    const row = k % 19
    rects += `<rect x="${col * (CELL + GAP)}" y="${row * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="7" fill="${tableColors[t]}"/>`
    k += 1
  }
  add(`wf-${t}`, WW, WH, rects)
})
fs.writeFileSync(path.join(HERE, "data", "waffle.json"), JSON.stringify({ w: WW, h: WH, colors: tableColors }))

fs.mkdirSync(OUT, { recursive: true })
const browser = await launch()
const page = await browser.newPage({ deviceScaleFactor: 2 })
for (const job of jobs) {
  await page.setViewportSize({ width: job.w, height: job.h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${job.svg}</body></html>`)
  await page.screenshot({ path: path.join(OUT, `${job.name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: job.w, height: job.h } })
}
await browser.close()
console.log(`${jobs.length} assets`)
