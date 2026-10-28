import { Download, Table2, TrendingUp } from "lucide-react"
import { useState } from "react"
import type { MetricResult } from "@/shared/api/metrics"
import type { Row } from "@/shared/format"
import {
  categoryName,
  compact,
  downloadCsv,
  money,
  month,
  number,
  numeric,
  percent,
} from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, EmptyState, IconButton, Panel, Tip } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"
import { Money } from "@/shared/ui/money"

export function SalesTrend({ result }: { result: MetricResult }) {
  const [series, setSeries] = useState("revenue")
  const [table, setTable] = useState(false)
  const rows = result.table.rows
  const last = rows.at(-1),
    prior = rows.at(-2)
  const a = numeric(last?.[series]),
    b = numeric(prior?.[series])
  const delta = a !== null && b !== null && b !== 0 ? (a - b) / b : null
  const format = series === "revenue" ? (n: number) => money(n) : number
  const tick = series === "revenue" ? (n: number) => money(n, true) : compact
  return (
    <Panel
      title={ru.trend}
      description={ru.trendNote}
      actions={
        <div className="panel-actions">
          <div className="segmented">
            <Button
              className={!table ? "selected" : ""}
              aria-pressed={!table}
              onClick={() => setTable(false)}
              aria-label={ru.chart}
            >
              <TrendingUp size={15} />
            </Button>
            <Button
              className={table ? "selected" : ""}
              aria-pressed={table}
              onClick={() => setTable(true)}
              aria-label={ru.table}
            >
              <Table2 size={15} />
            </Button>
          </div>
          <IconButton label={ru.export} onClick={() => downloadCsv(rows, "datum-monthly.csv")}>
            <Download size={16} />
          </IconButton>
        </div>
      }
    >
      <div className="chart-toolbar">
        <div className="series-switch">
          <Button
            aria-pressed={series === "revenue"}
            className={series === "revenue" ? "active" : ""}
            onClick={() => setSeries("revenue")}
          >
            <span className="legend-dot" />
            {ru.revenue}
          </Button>
          <Button
            aria-pressed={series === "orders_cnt"}
            className={series === "orders_cnt" ? "active" : ""}
            onClick={() => setSeries("orders_cnt")}
          >
            <span className="legend-dot" />
            {ru.orders}
          </Button>
        </div>
        {delta !== null && (
          <div className="chart-change">
            <strong>
              {delta > 0 ? "+" : ""}
              {percent(delta)}
            </strong>
            <span>
              {last && prior ? `${month(last.month)} / ${month(prior.month)}` : ru.lastMonth}
            </span>
          </div>
        )}
      </div>
      {table ? (
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
          rows={rows}
          x="month"
          y={series}
          label={ru.trend}
          formatValue={format}
          formatTick={tick}
          formatLabel={month}
        />
      )}
    </Panel>
  )
}
export function Categories({ rows }: { rows: Row[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 5)
  const max = Math.max(
    ...rows.map((row) => numeric(row.revenue)).filter((value): value is number => value !== null),
    1,
  )
  return (
    <Panel
      title={ru.categories}
      description={ru.categoriesNote}
      actions={<Tip text={ru.tips.categories} />}
    >
      {rows.length === 0 && <EmptyState />}
      <div className="category-list">
        {shown.map((row) => {
          const revenue = numeric(row.revenue)
          const share = numeric(row.revenue_pct)
          return (
            <div className="category-row" key={String(row.category)}>
              <div className="category-head">
                <span title={String(row.category)}>{categoryName(row.category)}</span>
                <strong>{revenue === null ? ru.noValue : <Money value={revenue} compact />}</strong>
                <span>{share === null ? ru.noValue : percent(share / 100)}</span>
              </div>
              {revenue !== null && (
                <div className="category-track">
                  <div style={{ width: `${(revenue / max) * 100}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {rows.length > 5 && (
        <Button className="text-button" onClick={() => setAll(!all)}>
          {all ? ru.showLess : ru.showAll}
        </Button>
      )}
    </Panel>
  )
}
export function Sellers({ rows }: { rows: Row[] }) {
  return (
    <Panel title={ru.sellers} description={ru.sellersNote} actions={<Tip text={ru.tips.sellers} />}>
      <DataTable
        rows={rows}
        searchable
        columns={[
          { key: "seller_id", label: ru.seller, format: (v) => `${String(v).slice(0, 8)}…` },
          { key: "city", label: ru.city },
          { key: "state", label: ru.region },
          { key: "orders_cnt", label: ru.orders, numeric: true, format: (v) => number(Number(v)) },
          {
            key: "revenue",
            label: ru.revenue,
            numeric: true,
            format: (v) => <Money value={Number(v)} />,
          },
        ]}
      />
    </Panel>
  )
}
