import { ChevronDown } from "lucide-react"
import type { CSSProperties } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { MetricResult } from "@/shared/api/metrics"
import type { Row } from "@/shared/format"
import { categoryName, compact, money, month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, EmptyState } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"
import { Money } from "@/shared/ui/money"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import "@/shared/styles/fill-pay-cat.css"
import "@/shared/styles/fill-sales.css"
import "@/shared/styles/mobile-charts-a.css"

const shareFormat = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 })
const roundCompact = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 0,
})
const priorLabel = "Год назад"

function withPriorYear(rows: Row[], key: string): Row[] {
  const byMonth = new Map(rows.map((row) => [String(row.month).slice(0, 7), numeric(row[key])]))
  return rows.map((row) => {
    const at = String(row.month).slice(0, 7)
    const prev = `${Number(at.slice(0, 4)) - 1}${at.slice(4)}`
    return { ...row, prior_year: byMonth.get(prev) ?? null }
  })
}

const titleCase = (text: string) =>
  text.toLocaleLowerCase("ru").replace(/(^|[\s-])\S/g, (c) => c.toLocaleUpperCase("ru"))

const place = (row: Row) =>
  [row.city ? titleCase(String(row.city)) : "", row.state ? String(row.state).toUpperCase() : ""]
    .filter(Boolean)
    .join(", ")

function BarList({
  rows,
  label,
  value,
  total,
  format,
}: {
  rows: Row[]
  label: (row: Row) => string
  value: string
  total: number
  format: (n: number) => string
}) {
  const values = rows.map((row) => numeric(row[value]))
  const max = Math.max(...values.map((n) => n ?? 0), 1)
  return (
    <ol className="os-barlist">
      <li className="os-barlist-head" aria-hidden="true">
        <span />
        <span>{ru.revenue}</span>
        <span>Доля</span>
      </li>
      {rows.map((row, i) => {
        const n = values[i] ?? null
        const name = label(row)
        return (
          <li
            key={`${name}-${String(i)}`}
            style={{ "--w": (n ?? 0) / max, "--i": i } as CSSProperties}
          >
            <span className="os-bar">
              <span className="os-bar-fill" />
              <span className="os-bar-label" title={name}>
                {name}
              </span>
            </span>
            <strong>{n === null ? ru.noValue : format(n)}</strong>
            <span>{n === null || total <= 0 ? ru.noValue : shareFormat.format(n / total)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function TrendHead({
  rows,
  series,
  onSeries,
  prior,
}: {
  rows: Row[]
  series: string
  onSeries: (series: string) => void
  prior: boolean
}) {
  const last = rows.at(-1),
    previous = rows.at(-2)
  const a = numeric(last?.[series]),
    b = numeric(previous?.[series])
  const delta = a !== null && b !== null && b !== 0 ? (a - b) / b : null
  return (
    <div className="os-chart-head">
      <div className="os-legend">
        <fieldset className="os-seg" aria-label={ru.trend}>
          <Button
            aria-pressed={series === "revenue"}
            className={series === "revenue" ? "on" : ""}
            onClick={() => onSeries("revenue")}
          >
            {ru.revenue}
          </Button>
          <Button
            aria-pressed={series === "orders_cnt"}
            className={series === "orders_cnt" ? "on" : ""}
            onClick={() => onSeries("orders_cnt")}
          >
            {ru.orders}
          </Button>
        </fieldset>
        <span className="os-key">
          <i className="os-key-line" />
          {series === "revenue" ? ru.revenue : ru.orders}
        </span>
        {prior && (
          <span className="os-key">
            <i className="os-key-dash" />
            {priorLabel}
          </span>
        )}
      </div>
      {delta !== null && (
        <div className={`os-delta ${delta >= 0 ? "up" : "down"}`}>
          <strong>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {percent(Math.abs(delta))}
          </strong>
          <span>
            {last && previous ? `${month(last.month)} к ${month(previous.month)}` : ru.lastMonth}
          </span>
        </div>
      )}
    </div>
  )
}

export function SalesTrend({
  result,
  query,
  index,
}: {
  result: MetricResult | undefined
  query?: CardQuery
  index?: number
}) {
  const [series, setSeries] = useState("revenue")
  const [view, setView] = useState<"chart" | "table">("chart")
  const rows = result?.table.rows ?? []
  const format = series === "revenue" ? (n: number) => money(n) : number
  const tick = series === "revenue" ? (n: number) => money(n, true) : compact
  const plotted = withPriorYear(rows, series)
  const hasPrior = plotted.filter((row) => row.prior_year !== null).length > 1
  return (
    <Card
      title={ru.trend}
      accent="продажи"
      description={ru.trendNote}
      query={query}
      index={index}
      className="os-card"
      actions={<CardTools rows={rows} filename="datum-monthly" view={view} onView={setView} />}
    >
      <TrendHead
        rows={rows}
        series={series}
        onSeries={setSeries}
        prior={hasPrior && view === "chart"}
      />
      {view === "table" ? (
        <DataTable
          rows={rows}
          columns={[
            { key: "month", label: ru.month, format: (v) => month(v, true) },
            {
              key: "orders_cnt",
              label: ru.orders,
              numeric: true,
              format: (v) => number(Number(v)),
            },
            {
              key: "revenue",
              label: ru.revenue,
              numeric: true,
              format: (v) => <Money value={Number(v)} />,
            },
          ]}
        />
      ) : (
        <Chart
          rows={plotted}
          x="month"
          y={series}
          label={ru.trend}
          formatValue={format}
          formatTick={tick}
          formatLabel={month}
          compare={hasPrior ? "prior_year" : undefined}
          compareLabel={priorLabel}
          legend={false}
        />
      )}
    </Card>
  )
}
const BASE_GAP = 4
const MAX_GAP = 16

type Fit = { height: number; rows: number; gap: number }

function measureFit(box: HTMLElement, list: HTMLElement, count: number): Fit {
  const height = box.clientHeight
  const items = list.querySelectorAll<HTMLElement>(".os-barlist > li")
  const head = items[0]?.offsetHeight ?? 20
  const row = items[1]?.offsetHeight ?? 32
  const rows = Math.max(1, Math.min(count, Math.floor((height - head) / (row + BASE_GAP))))
  const gap = Math.min(MAX_GAP, Math.max(BASE_GAP, (height - head - rows * row) / rows))
  return { height, rows, gap }
}

function useFitRows(count: number, limit: number) {
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<Fit>({ height: 0, rows: limit, gap: BASE_GAP })
  const [all, setAll] = useState(false)
  const [grown, setGrown] = useState(false)
  const [full, setFull] = useState(0)
  useLayoutEffect(() => {
    const box = boxRef.current
    const list = listRef.current
    if (!box || !list || count === 0 || grown) return
    const measure = () => setFit(measureFit(box, list, count))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [count, grown])
  useEffect(() => {
    if (all) return
    const timer = window.setTimeout(() => setGrown(false), 340)
    return () => window.clearTimeout(timer)
  }, [all])
  const toggle = () => {
    if (!all) {
      setFull(listRef.current?.scrollHeight ?? 0)
      setGrown(true)
    }
    setAll(!all)
  }
  return { boxRef, listRef, fit, all, grown, toggle, height: all ? full : fit.height }
}

export function Categories({
  rows,
  query,
  index,
  limit = 5,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
  limit?: number
}) {
  const total = rows.reduce((sum, row) => sum + (numeric(row.revenue) ?? 0), 0)
  const { boxRef, listRef, fit, all, grown, toggle, height } = useFitRows(rows.length, limit)
  return (
    <Card
      title={ru.categories}
      accent="выручку"
      description={ru.categoriesNote}
      hint={ru.tips.categories}
      query={query}
      index={index}
      className="os-card pc-cat"
      actions={<CardTools rows={rows} filename="datum-categories" png={false} />}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className={`pc-cat-fill${grown ? " is-grown" : ""}`}
          ref={boxRef}
          style={{ minHeight: 20 + limit * 44, "--pc-gap": `${fit.gap}px` } as CSSProperties}
        >
          <div className="os-collapse" ref={listRef} style={{ height }}>
            <BarList
              rows={rows}
              label={(row) => categoryName(row.category)}
              value="revenue"
              total={total}
              format={(n) => money(n, true)}
            />
          </div>
        </div>
      )}
      {rows.length > fit.rows && (
        <Button className="os-more" aria-expanded={all} onClick={toggle}>
          <span>{all ? ru.showLess : ru.showAll}</span>
          {!all && <span className="os-more-count">{number(rows.length)}</span>}
          <ChevronDown size={16} className="os-more-chevron" aria-hidden="true" />
        </Button>
      )}
    </Card>
  )
}
function sellerTip(row: Row, total: number) {
  const revenue = numeric(row.revenue) ?? 0
  const orders = numeric(row.orders_cnt)
  return tipAttrs(String(row.seller), [
    { label: ru.revenue, value: money(revenue), color: "var(--viz-1)" },
    { label: "Доля в топ-10", value: total > 0 ? shareFormat.format(revenue / total) : ru.noValue },
    { label: ru.orders, value: orders === null ? ru.noValue : number(orders) },
    {
      label: "Средний чек",
      value: orders ? money(revenue / orders) : ru.noValue,
    },
    { label: "Город", value: String(row.place) },
  ])
}

function SellerList({ rows, total }: { rows: Row[]; total: number }) {
  const max = Math.max(1, ...rows.map((row) => numeric(row.revenue) ?? 0))
  return (
    <VizTip className="fs-grow">
      <ol className="fs-sellers">
        <li className="fs-sellers-head" aria-hidden="true">
          <span>Продавец</span>
          <span>{ru.revenue}, R$</span>
          <span>{ru.orders}</span>
          <span>Доля</span>
        </li>
        {rows.map((row, i) => {
          const revenue = numeric(row.revenue) ?? 0
          const orders = numeric(row.orders_cnt)
          return (
            <li
              key={String(row.seller_id ?? i)}
              style={{ "--w": revenue / max, "--i": i } as CSSProperties}
              {...sellerTip(row, total)}
            >
              <span className="fs-seller">
                <b>{String(row.seller)}</b>
                <small className="fs-seller-place">{String(row.place)}</small>
              </span>
              <span className="fs-seller-rev">
                <span className="fs-seller-bar">
                  <i />
                </span>
                <strong>{roundCompact.format(revenue)}</strong>
              </span>
              <span>{orders === null ? ru.noValue : number(orders)}</span>
              <span>{total > 0 ? shareFormat.format(revenue / total) : ru.noValue}</span>
            </li>
          )
        })}
      </ol>
    </VizTip>
  )
}

export function Sellers({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const labelled = rows.map((row, i) => ({
    ...row,
    seller: `Продавец #${i + 1}`,
    place: place(row) || ru.noValue,
  }))
  const total = rows.reduce((sum, row) => sum + (numeric(row.revenue) ?? 0), 0)
  return (
    <Card
      title={ru.sellers}
      accent="больше"
      description={ru.sellersNote}
      hint={ru.tips.sellers}
      query={query}
      index={index}
      className="os-card"
      actions={
        <CardTools rows={rows} filename="datum-sellers" view={view} onView={setView} png={false} />
      }
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : view === "chart" ? (
        <SellerList rows={labelled} total={total} />
      ) : (
        <DataTable
          rows={labelled}
          filename="datum-sellers.csv"
          columns={[
            { key: "seller", label: "Продавец" },
            { key: "place", label: "Город, штат" },
            {
              key: "orders_cnt",
              label: ru.orders,
              numeric: true,
              format: (v) => number(Number(v)),
            },
            {
              key: "revenue",
              label: ru.revenue,
              numeric: true,
              format: (v) => <Money value={Number(v)} />,
            },
          ]}
        />
      )}
    </Card>
  )
}
