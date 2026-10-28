import fs from "node:fs"
import path from "node:path"
import pptxgen from "pptxgenjs"

const HERE = import.meta.dirname
const A = (name) => path.join(HERE, "assets", `${name}.png`)
const SER = JSON.parse(fs.readFileSync(path.join(HERE, "data", "series.json"), "utf8"))
const WAF = JSON.parse(fs.readFileSync(path.join(HERE, "data", "waffle.json"), "utf8"))
const SPEECH = JSON.parse(fs.readFileSync(path.join(HERE, "data", "speech.json"), "utf8"))

const K = {
  ink: "1D1D1B",
  fg2: "5E5E66",
  fg3: "8A8A93",
  mist: "F1F1F3",
  lilac: "F0E4FF",
  line: "E2E2E7",
  strong: "C9C9D1",
  white: "FFFFFF",
  cobalt: "2348FF",
  azure: "328EF9",
  cyan: "3BC4EE",
  rail: "518FF2",
  violet: "7F57EB",
  sky: "78E9FF",
  deep: "1A36CC",
  danger: "D3263A",
  success: "0E7C55",
  dangerTint: "FBE9EB",
  successTint: "E3F1EB",
  cobaltTint: "E9EDFF",
  violetTint: "F1ECFD",
}
const SANS = "Inter"
const SERIF = "PT Serif"
const MONO = "Consolas"

const X = (px) => px / 144
const S = (px) => px * 0.5

const pres = new pptxgen()
pres.layout = "LAYOUT_WIDE"
pres.title = "Datum: модель данных Capibara"
pres.author = "Команда RWB"
pres.theme = { headFontFace: SANS, bodyFontFace: SANS }

pres.defineSlideMaster({
  title: "DATUM",
  background: { color: K.white },
  objects: [
    { image: { path: A("mark"), x: X(120), y: X(50), w: X(40), h: X(40) } },
    { text: { text: "datum", options: { x: X(172), y: X(48), w: X(200), h: X(44), fontFace: SANS, bold: true, fontSize: S(28), color: K.ink, margin: 0, valign: "middle" } } },
  ],
  slideNumber: { x: X(1760), y: X(1000), w: X(100), h: X(40), fontFace: SANS, fontSize: S(24), bold: true, color: K.fg3, align: "right" },
})
pres.defineSlideMaster({ title: "BARE", background: { color: K.white } })

let uid = 0
const fxName = (fx, label = "el") => {
  uid += 1
  if (!fx) return `${label}-${uid}`
  const [kind, d = 0, t = 600] = fx.split("@")
  return `fx:${kind}:${Math.round(Number(d))}:${Math.round(Number(t))}:${uid}`
}
const fx = (kind, delayMs, durMs = 600) => `${kind}@${delayMs}@${durMs}`

const text = (slide, runs, o) => {
  const items = typeof runs === "string" ? [{ text: runs }] : runs
  slide.addText(
    items.map((r) => ({ text: r.text, options: { fontFace: r.font ?? o.font ?? SANS, bold: r.bold ?? o.bold ?? false, italic: r.italic ?? false, color: r.color ?? o.color ?? K.ink, fontSize: r.size ? S(r.size) : undefined, breakLine: r.br ?? false, strike: r.strike ? "sngStrike" : undefined } })),
    {
      x: X(o.x),
      y: X(o.y),
      w: X(o.w),
      h: X(o.h ?? o.size * 1.4),
      fontFace: o.font ?? SANS,
      fontSize: S(o.size),
      color: o.color ?? K.ink,
      bold: o.bold ?? false,
      align: o.align ?? "left",
      valign: o.valign ?? "top",
      margin: 0,
      lineSpacingMultiple: o.lh ?? 1.0,
      isTextBox: true,
      fill: o.fill ? { color: o.fill } : undefined,
      objectName: o.name ?? fxName(o.fx, "text"),
    },
  )
}

const box = (slide, o) => {
  const shape = o.shape ?? (o.r ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE)
  slide.addShape(shape, {
    x: X(o.x),
    y: X(o.y),
    w: X(o.w),
    h: X(o.h),
    fill: o.fill ? { color: o.fill, transparency: o.alpha ?? 0 } : { type: "none" },
    line: o.line ? { color: o.line, width: o.lw ?? 1.5, dashType: o.dash ?? "solid" } : { type: "none" },
    rectRadius: o.r ? Math.min(X(o.r), X(Math.min(o.w, o.h) / 2)) : undefined,
    shadow: o.shadow ? { type: "outer", color: "000000", opacity: 0.16, blur: 18, offset: 6, angle: 90 } : undefined,
    objectName: o.name ?? fxName(o.fx, "shape"),
  })
}

const pill = (slide, label, o) => {
  const w = o.w ?? Math.round(label.length * (o.size ?? 21) * 0.6 + 44)
  box(slide, { x: o.x, y: o.y, w, h: o.h ?? 46, r: 23, fill: o.fill ?? K.mist, line: o.line, lw: o.lw, fx: o.fx })
  text(slide, label, { x: o.x, y: o.y, w, h: o.h ?? 46, size: o.size ?? 21, bold: o.bold ?? true, color: o.color ?? K.ink, align: "center", valign: "middle", font: o.font, fx: o.fx })
  return w
}

const line = (slide, x1, y1, x2, y2, o = {}) => {
  slide.addShape(pres.shapes.LINE, {
    x: X(Math.min(x1, x2)),
    y: X(Math.min(y1, y2)),
    w: X(Math.abs(x2 - x1)),
    h: X(Math.abs(y2 - y1)),
    flipH: (x2 < x1) !== (y2 < y1) && x1 !== x2 && y1 !== y2,
    line: { color: o.color ?? K.strong, width: o.lw ?? 2, dashType: o.dash ?? "solid", endArrowType: o.arrow },
    objectName: o.name ?? fxName(o.fx, "line"),
  })
}

const geom = (slide, pts, o) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  slide.addShape(pres.shapes.CUSTOM_GEOMETRY, {
    x: X(x0),
    y: X(y0),
    w: X(Math.max(...xs) - x0 || 1),
    h: X(Math.max(...ys) - y0 || 1),
    points: [...pts.map((p, i) => ({ x: X(p[0] - x0), y: X(p[1] - y0), ...(i === 0 ? { moveTo: true } : {}) })), ...(o.close ? [{ close: true }] : [])],
    fill: o.fill ? { color: o.fill, transparency: o.alpha ?? 0 } : { type: "none" },
    line: o.line ? { color: o.line, width: o.lw ?? 2 } : { type: "none" },
    objectName: o.name ?? fxName(o.fx, "geom"),
  })
}

const img = (slide, name, o) => slide.addImage({ path: A(name), x: X(o.x), y: X(o.y), w: X(o.w), h: X(o.h), objectName: o.name ?? fxName(o.fx, "pic") })

const icon = (slide, name, tone, o) => img(slide, `ico-${name}-${tone}`, { x: o.x, y: o.y, w: o.s, h: o.s, fx: o.fx })

const title = (slide, plain, accent) =>
  text(
    slide,
    [
      { text: plain, bold: true },
      { text: accent, font: SERIF, italic: true, color: K.azure, size: 76 },
    ],
    { x: 120, y: 118, w: 1680, h: 110, size: 68, bold: true, valign: "middle", name: "!!title" },
  )

const stat = (slide, value, caption, o) => {
  text(slide, value, { x: o.x, y: o.y, w: o.w, h: o.vh ?? 70, size: o.size ?? 56, bold: true, color: o.color ?? K.ink, fx: o.fx, valign: "bottom" })
  text(slide, caption, { x: o.x, y: o.y + (o.vh ?? 70) + 6, w: o.w, h: 60, size: o.cs ?? 20, color: K.fg3, fx: o.fx, lh: 1.1 })
}

const key = (slide, ico, strong, rest, o) => {
  box(slide, { x: o.x, y: o.y, w: o.w, h: o.h ?? 84, r: 26, fill: K.lilac, fx: o.fx })
  icon(slide, ico, "violet", { x: o.x + 30, y: o.y + ((o.h ?? 84) - 36) / 2, s: 36, fx: o.fx })
  text(slide, [{ text: strong, bold: true }, { text: rest }], { x: o.x + 86, y: o.y, w: o.w - 116, h: o.h ?? 84, size: 24, valign: "middle", fx: o.fx, lh: 1.1 })
}

const content = (sid) => {
  const slide = pres.addSlide({ masterName: "DATUM" })
  slide.addNotes(SPEECH[sid] ?? "")
  return slide
}

const strata = (slide, ox, oy, size, mode, base, seed) => {
  const sc = size / 1000
  let r = seed
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280
    return r / 233280
  }
  const plates = ["raw", "core", "mart"]
  plates.forEach((p, i) => {
    const pd = base + i * (mode === "pixels" ? 420 : 160)
    if (mode === "pixels") {
      img(slide, `st-${p}-base`, { x: ox, y: oy, w: size, h: size, fx: fx("fade", pd + 700, 500) })
      for (let k = 0; k < 10; k += 1) {
        const dx = ((rnd() - 0.5) * 0.5).toFixed(3)
        const dy = (-0.18 - rnd() * 0.25).toFixed(3)
        img(slide, `st-${p}-row${k}`, { x: ox, y: oy, w: size, h: size, fx: fx(`fly_${dx}_${dy}`, pd + k * 45 + rnd() * 120, 900) })
      }
    } else {
      const f = fx("drop", pd, 900)
      img(slide, `st-${p}-base`, { x: ox, y: oy, w: size, h: size, fx: f })
      for (let k = 0; k < 10; k += 1) img(slide, `st-${p}-row${k}`, { x: ox, y: oy, w: size, h: size, fx: f })
    }
  })
  const cd = base + (mode === "pixels" ? 1900 : 900)
  img(slide, "st-shadow", { x: ox, y: oy, w: size, h: size, fx: fx("fade", cd + 300, 500) })
  img(slide, "st-cube", { x: ox, y: oy, w: size, h: size, fx: fx("drop", cd, 800) })
  return sc
}

const wordmark = (slide, x, y, h, base) => {
  const w = (h * 1006) / 196
  for (let i = 0; i < 5; i += 1) img(slide, `wm-${i}-ink`, { x, y, w, h, fx: fx("rise", base + i * 90, 700) })
}

{
  const slide = pres.addSlide({ masterName: "BARE" })
  slide.addNotes(SPEECH.cover)
  strata(slide, 1060, 140, 840, "pixels", 200, 11)
  wordmark(slide, 120, 286, 176, 250)
  text(slide, [{ text: "Модель данных Capibara:", bold: true, br: true }, { text: "от корзины до выкупа", font: SERIF, italic: true, color: K.azure, size: 72 }], { x: 120, y: 600, w: 900, h: 190, size: 64, fx: fx("rise", 1100, 700), lh: 0.95 })
  text(slide, "Хакатон, кейс «Модель маркетплейса»", { x: 120, y: 980, w: 900, h: 34, size: 22, bold: true, color: K.fg3, fx: fx("fade", 1700, 600) })
}

{
  const slide = content("sources")
  title(slide, "550 759 строк ", "и все текстом")
  const h = 600
  const w = (WAF.w * h) / WAF.h
  for (let t = 0; t < 8; t += 1) img(slide, `wf-${t}`, { x: 120, y: 290, w, h, fx: fx("wiperight", 300 + t * 230, 520) })
  const names = ["order_items", "order_payments", "orders", "order_reviews", "customers", "products", "sellers", "category_translation"]
  const counts = ["112 650", "103 886", "99 441", "99 224", "99 441", "32 951", "3 095", "71"]
  names.forEach((n, i) => {
    const y = 310 + i * 64
    const f = fx("rise", 400 + i * 230, 500)
    box(slide, { x: 1200, y: y + 10, w: 28, h: 28, r: 8, fill: WAF.colors[i].slice(1), fx: f })
    text(slide, n, { x: 1250, y, w: 380, h: 48, size: 24, font: MONO, color: K.ink, valign: "middle", fx: f })
    text(slide, counts[i], { x: 1620, y, w: 180, h: 48, size: 28, bold: true, align: "right", valign: "middle", fx: f })
  })
  text(slide, "1 клетка = 1 000 строк. Даты, суммы и оценки приехали строками, каждую колонку проверили скриптами.", { x: 120, y: 925, w: 1680, h: 40, size: 22, color: K.fg3, fx: fx("fade", 2300, 600) })
}

{
  const slide = content("identity")
  title(slide, "Анкета не равна ", "человеку")
  const cx = 450
  const cy = 610
  box(slide, { shape: pres.shapes.OVAL, x: cx - 250, y: cy - 250, w: 500, h: 500, line: K.line, lw: 1.5, dash: "dash", fx: fx("fade", 200, 600) })
  for (let i = 0; i < 17; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 17
    const x = cx + Math.cos(a) * 250
    const y = cy + Math.sin(a) * 250
    line(slide, cx, cy, x, y, { color: K.cobalt, lw: 2.25, fx: fx("fade", 900 + i * 45, 400) })
    box(slide, { x: x - 28, y: y - 19, w: 56, h: 38, r: 11, fill: K.mist, line: K.strong, lw: 1.25, fx: fx("zoom", 350 + i * 45, 450) })
  }
  box(slide, { shape: pres.shapes.OVAL, x: cx - 92, y: cy - 92, w: 184, h: 184, fill: K.cobalt, fx: fx("zoom", 1750, 600) })
  icon(slide, "user", "white", { x: cx - 42, y: cy - 42, s: 84, fx: fx("zoom", 1900, 500) })
  text(slide, "до 17 анкет у одного человека", { x: cx - 300, y: 880, w: 600, h: 36, size: 22, bold: true, color: K.fg2, align: "center", fx: fx("fade", 2100, 500) })

  box(slide, { x: 860, y: 300, w: 940, h: 190, r: 30, fill: K.mist, fx: fx("rise", 400, 600) })
  text(slide, [{ text: "99 441", strike: true }], { x: 900, y: 320, w: 330, h: 100, size: 84, bold: true, color: K.fg3, valign: "middle", fx: fx("rise", 500, 600) })
  icon(slide, "arrow-right", "cobalt", { x: 1240, y: 345, s: 56, fx: fx("fade", 800, 400) })
  text(slide, "96 096", { x: 1320, y: 320, w: 460, h: 100, size: 84, bold: true, color: K.cobalt, valign: "middle", fx: fx("zoom", 950, 600) })
  text(slide, "customer_id: анкета на каждый заказ", { x: 900, y: 425, w: 420, h: 40, size: 19, font: MONO, color: K.fg3, fx: fx("fade", 700, 400) })
  text(slide, "customer_unique_id: человек", { x: 1320, y: 425, w: 460, h: 40, size: 19, font: MONO, color: K.cobalt, fx: fx("fade", 1050, 400) })

  const ry = 560
  box(slide, { x: 880, y: ry + 38, w: 120, h: 46, r: 14, fill: K.violet, fx: fx("zoom", 1200, 400) })
  text(slide, "review", { x: 880, y: ry + 38, w: 120, h: 46, size: 19, bold: true, color: K.white, align: "center", valign: "middle", fx: fx("zoom", 1200, 400) })
  line(slide, 1000, ry + 61, 1080, ry + 18, { color: K.violet, lw: 2.5, fx: fx("fade", 1400, 400) })
  line(slide, 1000, ry + 61, 1080, ry + 104, { color: K.violet, lw: 2.5, fx: fx("fade", 1450, 400) })
  box(slide, { x: 1080, y: ry, w: 110, h: 38, r: 11, fill: K.mist, line: K.strong, fx: fx("zoom", 1550, 400) })
  box(slide, { x: 1080, y: ry + 86, w: 110, h: 38, r: 11, fill: K.mist, line: K.strong, fx: fx("zoom", 1600, 400) })
  text(slide, "789", { x: 1240, y: ry + 10, w: 200, h: 70, size: 64, bold: true, color: K.violet, fx: fx("rise", 1500, 500) })
  text(slide, "отзывов висят сразу на нескольких заказах", { x: 1240, y: ry + 82, w: 560, h: 40, size: 21, color: K.fg3, fx: fx("rise", 1500, 500) })

  const sy = 760
  let px = 880
  px += pill(slide, "order_id", { x: px, y: sy, fill: K.cobalt, color: K.white, size: 21, font: MONO, fx: fx("zoom", 1800, 400) }) + 10
  for (const n of ["1", "2", "3"]) px += pill(slide, n, { x: px, y: sy, w: 50, size: 21, fx: fx("zoom", 1900 + Number(n) * 80, 400) }) + 10
  text(slide, "order_item_id", { x: 1240, y: sy - 18, w: 560, h: 60, size: 40, bold: true, font: MONO, fx: fx("rise", 2100, 500) })
  text(slide, "номер строки внутри заказа, а не ключ", { x: 1240, y: sy + 42, w: 560, h: 40, size: 21, color: K.fg3, fx: fx("rise", 2100, 500) })
}

{
  const slide = content("gaps")
  title(slide, "Пропуски ", "и потери")
  const ords = SER.orders
  const months = SER.months
  const W = 1680
  const base = 730
  const H = 400
  const bw = W / ords.length
  const mx = Math.max(...ords)
  const RU = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"]
  ords.forEach((v, i) => {
    const x = 120 + i * bw + 8
    const tail = months[i] >= "2018-09"
    if (v) {
      const h = Math.max(4, (v / mx) * H)
      box(slide, { x, y: base - h, w: bw - 16, h, r: 6, fill: tail ? K.danger : K.azure, fx: fx("wipeup", 300 + i * 40, 500) })
    }
    const [yy, mm] = months[i].split("-")
    text(slide, RU[Number(mm) - 1], { x, y: base + 10, w: bw - 16, h: 26, size: 18, color: K.fg3, align: "center", fx: fx("fade", 300, 400) })
    if (mm === "01" || i === 0) text(slide, yy, { x, y: base + 38, w: 80, h: 26, size: 18, bold: true, fx: fx("fade", 300, 400) })
  })
  line(slide, 120, base, 1800, base, { color: K.strong, lw: 1.5, fx: fx("fade", 200, 400) })
  const nx = 120 + 2 * bw + bw / 2
  box(slide, { shape: pres.shapes.OVAL, x: nx - 44, y: base - 74, w: 88, h: 88, line: K.danger, lw: 3, dash: "dash", fx: fx("zoom", 1500, 500) })
  box(slide, { x: nx + 70, y: base - 330, w: 470, h: 100, r: 22, fill: K.white, line: K.line, shadow: true, fx: fx("zoom", 1700, 500) })
  text(slide, "0 заказов", { x: nx + 96, y: base - 322, w: 320, h: 54, size: 40, bold: true, color: K.danger, fx: fx("zoom", 1700, 500) })
  text(slide, "ноябрь 2016 молча выпадет из отчёта", { x: nx + 96, y: base - 270, w: 430, h: 30, size: 19, color: K.fg2, fx: fx("zoom", 1700, 500) })
  line(slide, 120, 820, 1800, 820, { color: K.line, lw: 1.5, fx: fx("fade", 1900, 400) })
  const st = [
    ["610", "товаров без категории", K.ink],
    ["775", "заказов без позиций: unavailable и canceled", K.ink],
    ["170 726,63", "R$ выручки на товарах без категории", K.danger],
    ["73 ≠ 71", "категорий в товарах и в переводах", K.ink],
  ]
  st.forEach(([v, c, col], i) => stat(slide, v, c, { x: 120 + i * 430, y: 830, w: 400, color: col, fx: fx("rise", 2000 + i * 100, 500) }))
}

{
  const slide = content("chrono")
  title(slide, "Хронология ", "и грязь")
  const gh = SER.gap_hist
  const GW = 1100
  const base = 740
  const GH = 410
  const bw = GW / gh.length
  const zx = 120 + 10 * bw
  box(slide, { x: 120, y: base - GH, w: zx - 120, h: GH, r: 18, fill: K.dangerTint, fx: fx("fade", 150, 500) })
  gh.forEach((v, i) => {
    const h = Math.max(4, (Math.sqrt(v) / Math.sqrt(28090)) * (GH - 30))
    box(slide, { x: 120 + i * bw + 3, y: base - h, w: bw - 6, h, r: 4, fill: i < 10 ? K.danger : K.azure, fx: fx("wipeup", 300 + i * 30, 450) })
  })
  line(slide, 120, base, 120 + GW, base, { color: K.strong, lw: 1.5, fx: fx("fade", 200, 400) })
  line(slide, zx, base - GH - 10, zx, base + 10, { color: K.danger, lw: 2.5, dash: "dash", fx: fx("wipedown", 1200, 600) })
  text(slide, "раньше оплаты", { x: zx - 260, y: base + 16, w: 250, h: 30, size: 19, bold: true, color: K.danger, align: "right", fx: fx("fade", 1300, 400) })
  text(slide, "дни от оплаты до отгрузки", { x: zx + 12, y: base + 16, w: 500, h: 30, size: 19, bold: true, fx: fx("fade", 1300, 400) })
  box(slide, { x: 145, y: base - GH + 24, w: 290, h: 110, r: 20, fill: K.white, line: K.line, shadow: true, fx: fx("zoom", 1600, 500) })
  text(slide, "1 359", { x: 168, y: base - GH + 32, w: 250, h: 52, size: 42, bold: true, color: K.danger, fx: fx("zoom", 1600, 500) })
  text(slide, "отгружены раньше оплаты", { x: 168, y: base - GH + 86, w: 260, h: 30, size: 19, color: K.fg2, fx: fx("zoom", 1600, 500) })

  const sx = 1300
  stat(slide, "23", "вручены раньше отгрузки", { x: sx, y: 280, w: 500, vh: 60, size: 52, color: K.danger, fx: fx("rise", 1400, 500) })
  stat(slide, "6", "отменённых с датой вручения", { x: sx, y: 395, w: 500, vh: 60, size: 52, color: K.danger, fx: fx("rise", 1550, 500) })
  stat(slide, "1 139", "заказов: платежи не бьются с позициями", { x: sx, y: 510, w: 500, vh: 60, size: 52, color: K.danger, fx: fx("rise", 1700, 500) })
  let cy = 640
  for (const [c, bad] of [["auriflama/sp", false], ["rio de janeiro \\ rio de janeiro", false], ["04482255", true]]) {
    const w = pill(slide, c, { x: sx, y: cy, size: 19, font: MONO, bold: false, fill: bad ? K.dangerTint : K.mist, color: bad ? K.danger : K.ink, fx: fx("zoom", 1850, 400), h: 40 })
    cy += 48
    void w
  }
  stat(slide, "611", "написаний городов, индекс вместо города", { x: sx, y: 768, w: 500, vh: 60, size: 52, fx: fx("rise", 2000, 500) })
  key(slide, "shield", "Вывод: ", "источникам доверять нельзя. Проверки живут в модели, а не в голове аналитика.", { x: 120, y: 900, w: 1680, h: 80, fx: fx("rise", 2300, 500) })
}

{
  const slide = content("rules")
  title(slide, "Как решили: ", "правила переноса")
  pill(slide, "raw: всё text", { x: 120, y: 255, fill: K.lilac, size: 21, fx: fx("fade", 200, 400) })
  const tag = "core: типы, NULL, PK, FK, CHECK"
  const tw = Math.round(tag.length * 21 * 0.6 + 44)
  pill(slide, tag, { x: 1800 - tw, y: 255, w: tw, fill: K.cobalt, color: K.white, size: 21, fx: fx("fade", 1400, 400) })
  const cells = [
    ["purchase_ts", "'2017-10-02 10:56'", "::timestamp", "2017-10-02 10:56", "timestamp", false],
    ["approved_at", "''", "NULLIF(trim)", "NULL", "данных нет", false],
    ["price", "'29.99'", "::numeric ≥ 0", "29.99", "numeric", false],
    ["order_status", "'delivered'", "CHECK из списка", "delivered", "статус есть", false],
    ["seller_id", "'3504c0cb…'", "REFERENCES", "3504c0cb…", "FK найден", false],
    ["score", "'7'", "CHECK 1–5", "отказ", "сборка падает", true],
  ]
  const cw = (1680 - 5 * 22) / 6
  cells.forEach(([name, raw, rule, core, typ, bad], i) => {
    const x = 120 + i * (cw + 22)
    const d = 300 + i * 120
    text(slide, name, { x, y: 330, w: cw, h: 30, size: 19, font: MONO, color: K.fg3, fx: fx("fade", d, 400) })
    box(slide, { x, y: 366, w: cw, h: 66, r: 16, fill: K.mist, fx: fx("rise", d, 500) })
    text(slide, raw, { x: x + 14, y: 366, w: cw - 28, h: 66, size: 19, font: MONO, color: K.fg2, valign: "middle", fx: fx("rise", d, 500) })
    box(slide, { x: x + cw / 2 - 2, y: 436, w: 4, h: 200, fill: i === 5 ? K.danger : K.rail, fx: fx("wipedown", d + 500, 600) })
    const rw = Math.min(cw, rule.length * 19 * 0.62 + 36)
    box(slide, { x: x + (cw - rw) / 2, y: 512, w: rw, h: 46, r: 23, fill: K.white, line: i === 5 ? K.danger : K.cobalt, lw: 2, fx: fx("zoom", d + 800, 400) })
    text(slide, rule, { x: x + (cw - rw) / 2, y: 512, w: rw, h: 46, size: 19, bold: true, font: MONO, color: i === 5 ? K.danger : K.cobalt, align: "center", valign: "middle", fx: fx("zoom", d + 800, 400) })
    box(slide, { x, y: 640, w: cw, h: 100, r: 18, fill: bad ? K.danger : K.cobalt, fx: fx("rise", d + 1100, 500) })
    text(slide, [{ text: core, bold: true, font: MONO, br: true }, { text: typ, size: 17 }], { x: x + 16, y: 640, w: cw - 32, h: 100, size: 22, color: K.white, valign: "middle", fx: fx("rise", d + 1100, 500), lh: 1.05 })
  })
  icon(slide, "refresh", "cobalt", { x: 120, y: 812, s: 34, fx: fx("fade", 2300, 500) })
  text(slide, [{ text: "Один скрипт " }, { text: "build_core.sql", font: MONO, bold: true, color: K.cobalt }, { text: " с нуля, DROP SCHEMA и BEGIN … COMMIT: наполовину собранной модели не бывает" }], { x: 170, y: 806, w: 1630, h: 46, size: 24, color: K.fg2, valign: "middle", fx: fx("fade", 2300, 500) })
}

{
  const slide = content("layers")
  title(slide, "Три слоя, ", "как в нашем знаке")
  strata(slide, 90, 210, 780, "stack", 200, 3)
  const rows = [
    ["ответы", "считаются из core", K.cobalt, 300, 1300],
    ["mart", "витрины под задачу: исполнение заказа", K.cyan, 430, 800],
    ["core", "модель: типы, ключи, связи, дедупликация", K.rail, 560, 650],
    ["raw", "как приехало, только читаем", K.violet, 690, 500],
  ]
  for (const [n, d, col, y, delay] of rows) {
    const f = fx("rise", delay, 500)
    box(slide, { shape: pres.shapes.OVAL, x: 920, y: y + 18, w: 24, h: 24, fill: col, fx: f })
    text(slide, n, { x: 965, y, w: 220, h: 60, size: 42, bold: true, valign: "middle", fx: f })
    text(slide, d, { x: 1160, y, w: 640, h: 60, size: 27, color: K.fg2, valign: "middle", fx: f })
  }
  let x = 965
  const f = fx("fade", 1700, 500)
  for (const [i, n] of ["build_core.sql", "build_mart.sql", "build_dashboard.py"].entries()) {
    x += pill(slide, n, { x, y: 860, size: 20, font: MONO, bold: false, fx: f }) + 10
    if (i < 2) {
      icon(slide, "arrow-right", "muted", { x, y: 869, s: 28, fx: f })
      x += 38
    }
  }
}

{
  const slide = content("schema")
  title(slide, "Схема core: ", "ключ это решение")
  const OX = 120
  const OY = 270
  const boxes = [
    ["customers", "PK customer_unique_id", "человек, а не учётка заказа", 0, 0, true],
    ["orders", "PK order_id", "CHECK по статусам, гео снимком", 630, 0, false],
    ["order_reviews", "PK review_id + order_id", "один отзыв на нескольких заказах", 1260, 0, true],
    ["sellers", "PK seller_id", "город и штат как в источнике", 0, 250, false],
    ["order_items", "PK order_id + item_no", "номер позиции стал частью ключа", 630, 250, true],
    ["order_payments", "PK order_id + payment_no", "несколько платежей легально", 1260, 250, false],
    ["product_categories", "PK category_name", "из товаров, перевод опционален", 0, 500, false],
    ["products", "PK product_id", "категория: nullable FK", 630, 500, false],
  ]
  const E = [
    [420, 80, 630, 80],
    [1050, 80, 1260, 80],
    [840, 160, 840, 250],
    [630, 330, 420, 330],
    [840, 410, 840, 500],
    [630, 580, 420, 580],
  ]
  E.forEach(([a, b, c, d], i) => line(slide, OX + a, OY + b, OX + c, OY + d, { color: K.cobalt, lw: 2.25, fx: fx("fade", 900 + i * 60, 400) }))
  geom(slide, [[OX + 1050, OY + 120], [OX + 1155, OY + 120], [OX + 1155, OY + 330], [OX + 1260, OY + 330]], { line: K.cobalt, lw: 2.25, fx: fx("fade", 1260, 400) })
  boxes.forEach(([n, pk, note, x, y, hot], i) => {
    const f = fx("zoom", 300 + i * 70, 450)
    box(slide, { x: OX + x, y: OY + y, w: 420, h: 160, r: 26, fill: hot ? K.white : K.mist, line: hot ? K.cobalt : undefined, lw: 2.5, fx: f })
    text(slide, n, { x: OX + x + 30, y: OY + y + 22, w: 370, h: 40, size: 30, bold: true, fx: f })
    text(slide, pk, { x: OX + x + 30, y: OY + y + 68, w: 370, h: 32, size: 21, font: MONO, bold: hot, color: hot ? K.cobalt : K.fg2, fx: f })
    text(slide, note, { x: OX + x + 30, y: OY + y + 106, w: 370, h: 30, size: 19, color: K.fg3, fx: f })
  })
  ;[[630, 80], [1260, 80], [840, 250], [420, 330], [840, 500], [420, 580], [1260, 330]].forEach(([x, y], i) => box(slide, { shape: pres.shapes.OVAL, x: OX + x - 9, y: OY + y - 9, w: 18, h: 18, fill: K.cobalt, fx: fx("zoom", 1350 + i * 50, 300) }))
  pill(slide, "деньги numeric", { x: OX + 1260, y: OY + 505, size: 21, fx: fx("rise", 1900, 400) })
  pill(slide, "даты timestamp", { x: OX + 1260, y: OY + 563, size: 21, fx: fx("rise", 2000, 400) })
  pill(slide, "дубль или провисшая связь не запишется", { x: OX + 1060, y: OY + 621, w: 620, size: 21, fill: K.cobalt, color: K.white, fx: fx("rise", 2100, 400) })
}

{
  const slide = content("why")
  title(slide, "Почему ", "именно так")
  const rows = [
    ["Покупатель", "99 441", "96 096", "3 345 дублей", "customer_unique_id, повторных 3,12% вместо 0"],
    ["География", "адрес сейчас", "адрес в заказе", "250 переездов", "снимок в заказе, регионы не плывут"],
    ["Категории", "71", "74", "−3 категории", "справочник из товаров, перевод опционален"],
    ["Без категории", "13 050 771,48", "13 221 498,11", "−170 726,63", "отдельная строка, сумма сходится"],
    ["Заказы в отчётах", "98 666", "99 441", "−775 заказов", "LEFT JOIN, где пары может не быть"],
  ]
  const cols = [
    ["", 148, 270],
    ["наивно", 430, 280],
    ["в модели", 770, 300],
    ["потеря", 1090, 260],
    ["решение", 1380, 400],
  ]
  cols.forEach(([h, x, w]) => text(slide, h, { x, y: 258, w, h: 30, size: 20, bold: true, color: K.fg3, fx: fx("fade", 200, 400) }))
  rows.forEach(([n, wrong, right, loss, how], i) => {
    const y = 300 + i * 124
    const f = fx("rise", 300 + i * 150, 500)
    box(slide, { x: 120, y, w: 1680, h: 108, r: 22, fill: K.mist, fx: f })
    text(slide, n, { x: 148, y, w: 270, h: 108, size: 27, bold: true, valign: "middle", fx: f })
    text(slide, [{ text: wrong, strike: true }], { x: 430, y, w: 290, h: 108, size: 32, bold: true, color: K.danger, valign: "middle", fx: f })
    icon(slide, "arrow-right", "muted", { x: 718, y: y + 38, s: 32, fx: f })
    text(slide, right, { x: 770, y, w: 310, h: 108, size: 34, bold: true, color: K.cobalt, valign: "middle", fx: fx("zoom", 600 + i * 150, 450) })
    pill(slide, loss, { x: 1090, y: y + 31, w: 250, size: 20, fill: K.dangerTint, color: K.danger, fx: fx("zoom", 750 + i * 150, 400) })
    text(slide, how, { x: 1380, y, w: 400, h: 108, size: 20, color: K.fg2, valign: "middle", fx: f, lh: 1.1 })
  })
}

{
  const slide = content("reconcile")
  title(slide, "Ничего ", "не потеряли")
  const rec = [
    ["заказы", 99441, 99441],
    ["позиции", 112650, 112650],
    ["платежи", 103886, 103886],
    ["отзывы", 99224, 99224],
    ["товары", 32951, 32951],
    ["продавцы", 3095, 3095],
    ["покупатели", 99441, 96096],
  ]
  const fmt = (v) => v.toLocaleString("ru-RU").replace(/ /g, " ")
  text(slide, "raw", { x: 120, y: 262, w: 200, h: 36, size: 26, bold: true, color: K.fg3, fx: fx("fade", 200, 400) })
  text(slide, [{ text: "потерь: " }, { text: "0", size: 34 }], { x: 760, y: 256, w: 400, h: 44, size: 26, bold: true, color: K.success, align: "center", valign: "middle", fx: fx("zoom", 2000, 500) })
  text(slide, "core", { x: 1600, y: 262, w: 200, h: 36, size: 26, bold: true, color: K.cobalt, align: "right", fx: fx("fade", 200, 400) })
  const MAXW = 480
  rec.forEach(([n, a, b], i) => {
    const y = 320 + i * 74
    const d = 300 + i * 120
    const dedup = a !== b
    const wa = Math.max(14, (a / 112650) * MAXW)
    const wb = Math.max(14, (b / 112650) * MAXW)
    text(slide, fmt(a), { x: 120, y, w: 130, h: 44, size: 24, bold: true, color: K.fg3, align: "right", valign: "middle", fx: fx("fade", d, 400) })
    box(slide, { x: 830 - wa, y: y + 4, w: wa, h: 36, r: 9, fill: K.strong, fx: fx("wipeleft", d, 700) })
    text(slide, n, { x: 840, y, w: 190, h: 44, size: 25, bold: true, align: "center", valign: "middle", fx: fx("fade", d, 400) })
    box(slide, { shape: pres.shapes.OVAL, x: 1030, y: y + 5, w: 34, h: 34, fill: dedup ? K.violet : K.success, fx: fx("zoom", d + 900, 350) })
    icon(slide, "check", "white", { x: 1036, y: y + 11, s: 22, fx: fx("zoom", d + 900, 350) })
    box(slide, { x: 1090, y: y + 4, w: wb, h: 36, r: 9, fill: dedup ? K.violet : K.azure, fx: fx("wiperight", d, 700) })
    text(slide, fmt(b), { x: 1090 + wb + 16, y, w: 140, h: 44, size: 24, bold: true, color: dedup ? K.violet : K.ink, valign: "middle", fx: fx("fade", d + 500, 400) })
    if (dedup) pill(slide, "дедупликация", { x: 1090 + wb + 130, y: y + 3, w: 170, h: 38, size: 17, fill: K.violetTint, color: K.violet, fx: fx("zoom", d + 1000, 400) })
  })
  pill(slide, "RAISE EXCEPTION", { x: 120, y: 860, w: 260, size: 21, font: MONO, fill: K.dangerTint, color: K.danger, fx: fx("rise", 2200, 500) })
  text(slide, "витрины: число строк, пары заказ и продавец, сумма денег. Расхождение валит сборку, а не молчит", { x: 400, y: 860, w: 1400, h: 46, size: 23, color: K.fg2, valign: "middle", fx: fx("rise", 2200, 500) })
}

{
  const slide = content("mart")
  title(slide, "Витрины: ", "один SELECT без join")
  box(slide, { x: 120, y: 430, w: 380, h: 230, r: 32, fill: K.cobalt, fx: fx("zoom", 300, 500) })
  text(slide, "1 заказ", { x: 156, y: 456, w: 320, h: 64, size: 48, bold: true, color: K.white, fx: fx("zoom", 300, 500) })
  ;["П1", "П2", "П3"].forEach((s, i) => {
    box(slide, { x: 156 + i * 72, y: 536, w: 60, h: 60, r: 16, fill: K.white, fx: fx("zoom", 600 + i * 90, 400) })
    text(slide, s, { x: 156 + i * 72, y: 536, w: 60, h: 60, size: 21, bold: true, color: K.cobalt, align: "center", valign: "middle", fx: fx("zoom", 600 + i * 90, 400) })
  })
  text(slide, "3 продавца", { x: 156, y: 606, w: 320, h: 34, size: 21, color: K.white, fx: fx("fade", 900, 400) })
  geom(slide, [[500, 500], [640, 500], [640, 390], [800, 390]], { line: K.cobalt, lw: 3, fx: fx("fade", 900, 500) })
  geom(slide, [[500, 590], [640, 590], [640, 680], [800, 680]], { line: K.violet, lw: 3, fx: fx("fade", 1000, 500) })
  text(slide, "order_fulfillment", { x: 800, y: 268, w: 600, h: 40, size: 28, bold: true, font: MONO, color: K.cobalt, fx: fx("rise", 1100, 500) })
  text(slide, "этапы в днях, on_time, суммы, последний отзыв; сломанная хронология в NULL", { x: 800, y: 308, w: 560, h: 52, size: 19, color: K.fg2, fx: fx("rise", 1100, 500), lh: 1.05 })
  box(slide, { x: 800, y: 362, w: 560, h: 60, r: 16, fill: K.cobaltTint, line: K.cobalt, lw: 2.25, fx: fx("wiperight", 1200, 600) })
  text(slide, "seller_shipment", { x: 800, y: 560, w: 600, h: 40, size: 28, bold: true, font: MONO, color: K.violet, fx: fx("rise", 1300, 500) })
  text(slide, "срок отгрузки пары и флаг «успел ли»", { x: 800, y: 600, w: 560, h: 30, size: 19, color: K.fg2, fx: fx("rise", 1300, 500) })
  ;[0, 1, 2].forEach((k) => box(slide, { x: 800, y: 640 + k * 62, w: 560, h: 52, r: 14, fill: K.violetTint, line: K.violet, lw: 2.25, fx: fx("wiperight", 1400 + k * 120, 600) }))
  text(slide, "99 441", { x: 1420, y: 330, w: 380, h: 90, size: 76, bold: true, color: K.cobalt, fx: fx("zoom", 1700, 500) })
  text(slide, "1 строка = 1 заказ", { x: 1420, y: 420, w: 380, h: 30, size: 21, color: K.fg3, fx: fx("zoom", 1700, 500) })
  text(slide, "100 010", { x: 1420, y: 640, w: 380, h: 90, size: 76, bold: true, color: K.violet, fx: fx("zoom", 1900, 500) })
  text(slide, "1 строка = заказ × продавец", { x: 1420, y: 730, w: 380, h: 30, size: 21, color: K.fg3, fx: fx("zoom", 1900, 500) })
  key(slide, "alert", "is_single_seller: ", "дата отгрузки в источнике одна на заказ, поэтому рейтинг продавца честен только для заказов с одним продавцом", { x: 120, y: 880, w: 1680, h: 90, fx: fx("rise", 2200, 500) })
}

{
  const slide = content("block-a")
  title(slide, "Блок А: ", "все пять контролей сошлись")
  text(slide, "13 221 498,11", { x: 120, y: 240, w: 900, h: 110, size: 96, bold: true, color: K.cobalt, fx: fx("zoom", 300, 600) })
  text(slide, "выручка за 24 месяца, R$, товары без доставки по доставленным заказам", { x: 120, y: 352, w: 1200, h: 32, size: 21, color: K.fg3, fx: fx("fade", 500, 500) })
  const rev = SER.rev
  const RW = 1680
  const top = 410
  const base = 760
  const step = RW / (rev.length - 1)
  const mx = Math.max(...rev)
  const pts = rev.map((v, i) => [120 + i * step, base - (v / mx) * (base - top)])
  geom(slide, [...pts, [120 + RW, base], [120, base]], { fill: K.azure, alpha: 78, close: true, fx: fx("wiperight", 600, 1600) })
  geom(slide, pts, { line: K.cobalt, lw: 3.5, fx: fx("wiperight", 600, 1600) })
  line(slide, 120, base, 1800, base, { color: K.strong, lw: 1.5, fx: fx("fade", 300, 400) })
  const RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
  SER.months.slice(0, 24).forEach((m, i) => {
    const [y, mm] = m.split("-")
    if (mm === "01" || i === 0) text(slide, `${RU[Number(mm) - 1]} ${y}`, { x: 120 + i * step - (i ? 50 : 0), y: base + 10, w: 140, h: 28, size: 19, bold: true, align: i ? "center" : "left", fx: fx("fade", 400, 400) })
  })
  const nov = pts[2]
  box(slide, { shape: pres.shapes.OVAL, x: nov[0] - 11, y: nov[1] - 11, w: 22, h: 22, fill: K.danger, fx: fx("zoom", 1500, 400) })
  text(slide, "generate_series: ноябрь 2016 = 0, строка есть", { x: nov[0] - 10, y: nov[1] - 96, w: 620, h: 30, size: 19, bold: true, color: K.danger, fx: fx("fade", 1600, 400) })
  line(slide, 120, 830, 1800, 830, { color: K.line, lw: 1.5, fx: fx("fade", 1800, 400) })
  const kp = [
    ["226 987,93", "топ-продавец из Гуарибы: выручка от позиций"],
    ["159,88", "средний чек: заказ, потом среднее"],
    ["96 096 · 3,12%", "покупателей по customer_unique_id"],
    ["74", "категории с «(без категории)»"],
  ]
  kp.forEach(([v, c], i) => stat(slide, v, c, { x: 120 + i * 430, y: 846, w: 410, vh: 60, size: 46, fx: fx("rise", 1900 + i * 120, 500) }))
}

{
  const slide = pres.addSlide({ masterName: "BARE" })
  slide.addNotes("Готовы к вашим вопросам.")
  strata(slide, 640, 20, 640, "stack", 150, 5)
  wordmark(slide, 120, 70, 90, 300)
  text(slide, [{ text: "Готовы к вашим ", bold: true }, { text: "вопросам", font: SERIF, italic: true, color: K.azure, size: 132 }], { x: 120, y: 680, w: 1680, h: 160, size: 116, align: "center", valign: "middle", fx: fx("rise", 1200, 700) })
  text(slide, "Одна модель, одна цифра для всех", { x: 120, y: 860, w: 1680, h: 50, size: 32, color: K.fg2, align: "center", fx: fx("fade", 1600, 600) })
}

const out = path.join(HERE, "out", "deck-raw.pptx")
fs.mkdirSync(path.dirname(out), { recursive: true })
await pres.writeFile({ fileName: out })
console.log(out)
