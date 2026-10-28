import { ChevronDown } from "lucide-react"
import type { CSSProperties } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import type { MetricResult } from "@/shared/api/metrics"
import type { Row } from "@/shared/format"
import { categoryName, compact, money, month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, EmptyState } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"
import { Money } from "@/shared/ui/money"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"

const shareFormat = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 })
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
  const [all, setAll] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const total = rows.reduce((sum, row) => sum + (numeric(row.revenue) ?? 0), 0)
  useLayoutEffect(() => {
    const box = listRef.current
    if (!box || rows.length === 0) return
    const measure = () => {
      const items = box.querySelectorAll<HTMLElement>(".os-barlist > li")
      const cut = items[limit + 1]
      setHeight(
        all || !cut
          ? box.scrollHeight
          : cut.getBoundingClientRect().top - box.getBoundingClientRect().top,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [all, limit, rows.length])
  return (
    <Card
      title={ru.categories}
      accent="выручку"
      description={ru.categoriesNote}
      hint={ru.tips.categories}
      query={query}
      index={index}
      className="os-card"
      actions={<CardTools rows={rows} filename="datum-categories" png={false} />}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="os-collapse" ref={listRef} style={{ height }}>
          <BarList
            rows={rows}
            label={(row) => categoryName(row.category)}
            value="revenue"
            total={total}
            format={(n) => money(n, true)}
          />
        </div>
      )}
      {rows.length > limit && (
        <Button className="os-more" aria-expanded={all} onClick={() => setAll(!all)}>
          <span>{all ? ru.showLess : ru.showAll}</span>
          {!all && <span className="os-more-count">{number(rows.length)}</span>}
          <ChevronDown size={16} className="os-more-chevron" aria-hidden="true" />
        </Button>
      )}
    </Card>
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
  const labelled = rows.map((row) => ({ ...row, place: place(row) || ru.noValue }))
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
        <BarList
          rows={labelled}
          label={(row) => String(row.place)}
          value="revenue"
          total={total}
          format={(n) => money(n, true)}
        />
      ) : (
        <DataTable
          rows={labelled}
          searchable
          filename="datum-sellers.csv"
          columns={[
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
