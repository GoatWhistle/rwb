import type { CSSProperties } from "react"
import type { Row } from "@/shared/format"
import { money, number, numeric } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { stateName } from "./states"
import "@/shared/styles/block-b.css"

interface Day {
  day: string
  price: number
  low: number
  high: number
  units: number
}

const pct = (value: unknown) => `${number(numeric(value) ?? 0, 1)}%`
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(`${day}T00:00:00`),
  )

function byDay(rows: Row[]): Day[] {
  const days = new Map<string, Day>()
  for (const row of rows) {
    const day = String(row.day)
    const price = numeric(row.price) ?? 0
    const units = numeric(row.units_sold) ?? 0
    const prev = days.get(day)
    if (!prev) {
      days.set(day, { day, price, low: price, high: price, units })
      continue
    }
    prev.price =
      units > 0 ? (prev.price * prev.units + price * units) / (prev.units + units) : prev.price
    prev.low = Math.min(prev.low, price)
    prev.high = Math.max(prev.high, price)
    prev.units += units
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}

function stepPath(days: Day[], x: (i: number) => number, y: (v: number) => number) {
  return days
    .map((d, i) => {
      const head = i === 0 ? `M${x(i)},${y(d.price)}` : `H${x(i)}V${y(d.price)}`
      return i === days.length - 1 ? `${head}H${x(i + 1)}` : head
    })
    .join("")
}

function dayTip(d: Day) {
  return tipAttrs(dayLabel(d.day), [
    { label: "Цена", value: money(d.price), color: "var(--bb-cobalt)" },
    {
      label: "Диапазон за день",
      value: d.low === d.high ? "одна цена" : `${money(d.low)} – ${money(d.high)}`,
    },
    { label: "Продано, шт.", value: number(d.units) },
  ])
}

function PriceChart({ days }: { days: Day[] }) {
  const prices = days.flatMap((d) => [d.low, d.high])
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const top = Math.max(1, ...days.map((d) => d.units))
  const w = 100 / days.length
  const x = (i: number) => i * w
  const y = (v: number) => 4 + (1 - (v - min) / Math.max(1, max - min)) * 92
  return (
    <VizTip className="bb-price">
      <div className="bb-price-axis" aria-hidden="true">
        <span>{money(max)}</span>
        <span>{money(min)}</span>
      </div>
      <svg
        className="bb-price-line"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Цена по дням"
      >
        <path d={stepPath(days, x, y)} />
      </svg>
      <div className="bb-price-bars">
        {days.map((d) => (
          <span key={d.day} style={{ "--h": d.units / top } as CSSProperties} {...dayTip(d)}>
            <i />
          </span>
        ))}
      </div>
      <div className="bb-price-dates" aria-hidden="true">
        <span>{dayLabel(days[0]?.day ?? "")}</span>
        <span>{dayLabel(days.at(-1)?.day ?? "")}</span>
      </div>
    </VizTip>
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
  const product = String(rows[0]?.product_id ?? "").slice(0, 8)
  const prices = new Set(rows.map((r) => String(r.price))).size
  return (
    <Card
      title="Как менялась цена товара"
      accent="цена"
      description={
        rows.length
          ? `Товар ${product}… (${String(rows[0]?.category ?? "")}): ${number(prices)} разных цен. Линия — цена, столбцы — продано за день`
          : undefined
      }
      hint="Товар с наибольшим числом разных цен в срезе. Если в день было несколько цен, линия показывает среднюю по проданным штукам"
      query={query}
      index={index}
      className="bb-card"
      actions={<CardTools rows={rows} filename="datum-price-history" png={false} />}
    >
      {days.length === 0 ? <EmptyState /> : <PriceChart days={days} />}
    </Card>
  )
}

const PAY_COLS = [
  { key: "card_pct", label: "Карта" },
  { key: "boleto_pct", label: "Boleto" },
  { key: "voucher_pct", label: "Ваучер" },
  { key: "installment_pct", label: "Рассрочка" },
] as const

function stateTip(row: Row) {
  return tipAttrs(stateName(String(row.state)), [
    { label: "Платежей", value: number(numeric(row.payments_cnt) ?? 0) },
    { label: "Сумма", value: money(numeric(row.amount) ?? 0) },
    ...PAY_COLS.map((c) => ({ label: c.label, value: pct(row[c.key]) })),
    { label: "Частей в среднем", value: number(numeric(row.avg_installments) ?? 0, 2) },
  ])
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
  return (
    <Card
      title="Оплаты по штатам, 2018"
      accent="штатам"
      description="Доля платежей каждым способом и доля в рассрочку, топ-10 штатов по сумме"
      hint="Единица — платёж, а не заказ. Рассрочка — платёж больше чем в одну часть"
      query={query}
      index={index}
      className="bb-card"
      actions={<CardTools rows={rows} filename="datum-payments-states-2018" png={false} />}
    >
      {top.length === 0 ? (
        <EmptyState />
      ) : (
        <VizTip className="bb-pay">
          <div className="bb-pay-row bb-pay-head" aria-hidden="true">
            <span>Штат</span>
            {PAY_COLS.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
          </div>
          {top.map((row) => (
            <div className="bb-pay-row" key={String(row.state)} {...stateTip(row)}>
              <span className="bb-pay-state">{String(row.state)}</span>
              {PAY_COLS.map((c) => (
                <span
                  key={c.key}
                  className="bb-pay-cell"
                  style={{ "--v": (numeric(row[c.key]) ?? 0) / 100 } as CSSProperties}
                >
                  {pct(row[c.key])}
                </span>
              ))}
            </div>
          ))}
        </VizTip>
      )}
    </Card>
  )
}
