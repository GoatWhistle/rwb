import type { CSSProperties } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import type { Row } from "@/shared/format"
import { categoryName, money, number, numeric } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { stateName } from "./states"
import "@/shared/styles/block-b.css"

interface Day {
  day: string
  t: number
  price: number
  low: number
  high: number
  units: number
}

const DAY_MS = 86_400_000
const pct = (value: unknown) => `${number(numeric(value) ?? 0, 1)} %`
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(`${day}T00:00:00`),
  )
const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "short" })
const price = (n: number) => `${number(n, 2)} R$`

function byDay(rows: Row[]): Day[] {
  const days = new Map<string, Day>()
  for (const row of rows) {
    const day = String(row.day)
    const value = numeric(row.price) ?? 0
    const units = numeric(row.units_sold) ?? 0
    const prev = days.get(day)
    if (!prev) {
      const t = new Date(`${day}T00:00:00`).getTime()
      days.set(day, { day, t, price: value, low: value, high: value, units })
      continue
    }
    prev.price =
      units > 0 ? (prev.price * prev.units + value * units) / (prev.units + units) : prev.price
    prev.low = Math.min(prev.low, value)
    prev.high = Math.max(prev.high, value)
    prev.units += units
  }
  return [...days.values()].sort((a, b) => a.t - b.t)
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 320 })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const w = Math.max(280, Math.round(entry.contentRect.width))
      const h = Math.max(220, Math.round(entry.contentRect.height))
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, ...size }
}

function priceTicks(min: number, max: number) {
  const step = max - min > 20 ? 10 : max - min > 8 ? 5 : 2
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
  return ticks
}

function monthStarts(t0: number, t1: number) {
  const out: number[] = []
  const d = new Date(t0)
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  while (d.getTime() < t1) {
    out.push(d.getTime())
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

function dayTip(d: Day) {
  return tipAttrs(dayLabel(d.day), [
    { label: "Цена", value: price(d.price), color: "#2348ff" },
    {
      label: "Цены за день",
      value: d.low === d.high ? "одна цена" : `${price(d.low)} – ${price(d.high)}`,
    },
    { label: "Продано, шт.", value: number(d.units) },
  ])
}

interface Frame {
  w: number
  pad: { l: number; r: number; t: number }
  priceH: number
  volTop: number
  volH: number
  x: (t: number) => number
  y: (v: number) => number
  dayW: number
}

function makeFrame(days: Day[], w: number, h: number, ticks: number[]): Frame {
  const pad = { l: 44, r: 16, t: 26 }
  const axisH = 22
  const volH = Math.max(36, Math.round(h * 0.18))
  const gap = 14
  const priceH = h - pad.t - axisH - volH - gap
  const t0 = days[0]?.t ?? 0
  const t1 = (days.at(-1)?.t ?? t0) + DAY_MS
  const lo = ticks[0] ?? 0
  const hi = ticks.at(-1) ?? 1
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * priceH
  return { w, pad, priceH, volTop: pad.t + priceH + gap, volH, x, y, dayW: x(t0 + DAY_MS) - x(t0) }
}

function stepLine(days: Day[], f: Frame) {
  const end = (days.at(-1)?.t ?? 0) + DAY_MS
  return days
    .map((d, i) => (i === 0 ? `M${f.x(d.t)},${f.y(d.price)}` : `H${f.x(d.t)}V${f.y(d.price)}`))
    .concat(`H${f.x(end)}`)
    .join("")
}

function PriceGrid({ f, ticks }: { f: Frame; ticks: number[] }) {
  return (
    <g className="bb-grid">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={f.pad.l} x2={f.w - f.pad.r} y1={f.y(v)} y2={f.y(v)} />
          <text x={f.pad.l - 8} y={f.y(v) + 4}>
            {number(v)}
          </text>
        </g>
      ))}
    </g>
  )
}

function Volume({ days, f, top }: { days: Day[]; f: Frame; top: number }) {
  const bw = Math.max(1.5, f.dayW * 0.72)
  return (
    <g className="bb-vol">
      <line x1={f.pad.l} x2={f.w - f.pad.r} y1={f.volTop + f.volH} y2={f.volTop + f.volH} />
      <text className="bb-vol-label" x={f.pad.l - 8} y={f.volTop + 10}>
        шт.
      </text>
      {days.map((d) => {
        const h = Math.max(2, (d.units / top) * f.volH)
        return (
          <rect
            key={d.day}
            x={f.x(d.t) + (f.dayW - bw) / 2}
            y={f.volTop + f.volH - h}
            width={bw}
            height={h}
            rx={Math.min(2, bw / 3)}
          />
        )
      })}
    </g>
  )
}

function Marker({ d, f, kind }: { d: Day; f: Frame; kind: "min" | "max" | "last" }) {
  const cx = kind === "last" ? f.x(d.t + DAY_MS) : f.x(d.t) + f.dayW / 2
  const cy = f.y(d.price)
  const below = kind === "min"
  const anchor = cx > f.w - 90 ? "end" : cx < f.pad.l + 60 ? "start" : "middle"
  const label = kind === "last" ? "" : price(d.price)
  return (
    <g className={`bb-mark bb-mark-${kind}`}>
      <circle cx={cx} cy={cy} r={4} />
      <text x={cx} y={below ? cy + 18 : cy - 10} textAnchor={anchor}>
        {label}
      </text>
    </g>
  )
}

function PriceChart({ days }: { days: Day[] }) {
  const { ref, w, h } = useSize()
  const prices = days.flatMap((d) => [d.low, d.high])
  const ticks = priceTicks(Math.min(...prices), Math.max(...prices))
  const f = makeFrame(days, w, h, ticks)
  const top = Math.max(1, ...days.map((d) => d.units))
  const line = stepLine(days, f)
  const first = days[0]
  const last = days.at(-1)
  const hi = days.reduce((a, b) => (b.price > a.price ? b : a), days[0] as Day)
  const lo = days.reduce((a, b) => (b.price < a.price ? b : a), days[0] as Day)
  return (
    <div className="bb-price" ref={ref}>
      <VizTip className="bb-price-host">
        <svg width={w} height={h} role="img" aria-label="Цена товара и продажи по дням">
          <PriceGrid f={f} ticks={ticks} />
          <path className="bb-line" d={line} />
          <Volume days={days} f={f} top={top} />
          {monthStarts(first?.t ?? 0, (last?.t ?? 0) + DAY_MS).map((t) => (
            <text key={t} className="bb-month" x={f.x(t)} y={h - 4}>
              {monthLabel.format(t)}
            </text>
          ))}
          <Marker d={hi} f={f} kind="max" />
          {lo !== first && <Marker d={lo} f={f} kind="min" />}
          {last && <Marker d={last} f={f} kind="last" />}
          {days.map((d) => (
            <rect
              key={d.day}
              className="bb-hit"
              x={f.x(d.t)}
              y={f.pad.t}
              width={Math.max(f.dayW, 2)}
              height={h - f.pad.t - 22}
              {...dayTip(d)}
            />
          ))}
        </svg>
      </VizTip>
    </div>
  )
}

function PriceStats({ rows, days }: { rows: Row[]; days: Day[] }) {
  const values = rows.map((r) => numeric(r.price) ?? 0)
  const units = days.reduce((s, d) => s + d.units, 0)
  const stats = [
    { label: "Сейчас", value: price(days.at(-1)?.price ?? 0) },
    { label: "Мин.", value: price(Math.min(...values)) },
    { label: "Макс.", value: price(Math.max(...values)) },
    { label: "Продано", value: `${number(units)} шт.` },
  ]
  return (
    <dl className="bb-stats">
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PriceHistory({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const days = byDay(rows)
  const category = rows[0]?.category ? categoryName(rows[0].category) : ""
  const prices = new Set(rows.map((r) => String(r.price))).size
  return (
    <Card
      title="Как менялась цена товара"
      accent="цена"
      description={
        category
          ? `Товар с наибольшим числом разных цен (${number(prices)}), категория «${category}»`
          : `Товар с наибольшим числом разных цен (${number(prices)})`
      }
      hint="Если за день товар продавали по нескольким ценам, линия показывает среднюю по проданным штукам. Столбцы внизу — продано за день"
      query={query}
      index={index}
      className="bb-card"
      actions={<CardTools rows={rows} filename="datum-price-history" png={false} />}
    >
      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <PriceStats rows={rows} days={days} />
          <PriceChart days={days} />
        </>
      )}
    </Card>
  )
}

const PAY_PARTS = [
  { key: "card_pct", label: "Карта", color: "#2348ff" },
  { key: "boleto_pct", label: "Boleto", color: "#53c2f0" },
  { key: "voucher_pct", label: "Ваучер", color: "#aa8cf5" },
] as const

function stateTip(row: Row) {
  return tipAttrs(`${stateName(String(row.state))}, ${String(row.state)}`, [
    ...PAY_PARTS.map((p) => ({ label: p.label, value: pct(row[p.key]), color: p.color })),
    { label: "В рассрочку", value: pct(row.installment_pct) },
    { label: "Частей в среднем", value: number(numeric(row.avg_installments) ?? 0, 1) },
    { label: "Платежей", value: number(numeric(row.payments_cnt) ?? 0) },
    { label: "Сумма", value: money(numeric(row.amount) ?? 0, true) },
  ])
}

function PayRow({ row, maxInst }: { row: Row; maxInst: number }) {
  const inst = numeric(row.installment_pct) ?? 0
  return (
    <li className="bb-pay-row" {...stateTip(row)}>
      <span className="bb-pay-state">
        {stateName(String(row.state))}
        <small>{String(row.state)}</small>
      </span>
      <span className="bb-pay-stack">
        {PAY_PARTS.map((p) => {
          const v = numeric(row[p.key]) ?? 0
          return (
            <i key={p.key} style={{ flexGrow: v, background: p.color } as CSSProperties}>
              {p.key === "card_pct" && v >= 20 ? `${number(v, 0)} %` : ""}
            </i>
          )
        })}
      </span>
      <span className="bb-pay-inst">
        <b>{pct(inst)}</b>
        <span className="bb-pay-track">
          <i style={{ width: `${(inst / Math.max(1, maxInst)) * 100}%` }} />
        </span>
      </span>
    </li>
  )
}

export function StatePayments({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const top = rows.slice(0, 10)
  const maxInst = Math.max(1, ...top.map((r) => numeric(r.installment_pct) ?? 0))
  return (
    <Card
      title="Как платят по штатам, 2018"
      accent="штатам"
      description="Топ-10 штатов по сумме платежей: способ оплаты и доля в рассрочку"
      hint="Единица — платёж, а не заказ. Рассрочка — платёж картой больше чем в одну часть. Остаток до 100 % — дебетовые карты"
      query={query}
      index={index}
      className="bb-card"
      actions={<CardTools rows={rows} filename="datum-payments-states-2018" png={false} />}
    >
      {top.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="bb-pay-legend" aria-hidden="true">
            {PAY_PARTS.map((p) => (
              <li key={p.key}>
                <i style={{ background: p.color }} />
                {p.label}
              </li>
            ))}
          </ul>
          <VizTip className="bb-pay">
            <div className="bb-pay-head" aria-hidden="true">
              <span>Штат</span>
              <span>Способ оплаты</span>
              <span>Рассрочка</span>
            </div>
            <ol className="bb-pay-list">
              {top.map((row) => (
                <PayRow key={String(row.state)} row={row} maxInst={maxInst} />
              ))}
            </ol>
          </VizTip>
        </>
      )}
    </Card>
  )
}
