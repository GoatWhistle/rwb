import type { WidgetColumn, WidgetDraft, WidgetSpec } from "@/shared/api/widget-types"
import type { Row } from "@/shared/format"
import { categoryName, cell, money, month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { EmptyState } from "@/shared/ui/controls"
import { HBars } from "../dashboard/bars"

const formatterFor = (type: WidgetColumn["type"] | undefined, compact = false) => {
  if (type === "money") return (n: number) => money(n, compact)
  if (type === "percent") return (n: number) => percent(n)
  return (n: number) => number(n, 1)
}

export function formatCell(value: unknown, column: WidgetColumn | undefined) {
  if (value === null || value === undefined) return ru.noValue
  if (column?.type === "date") return month(value, true)
  if (column?.type === "text") return categoryName(value)
  const n = numeric(value)
  if (n === null) return cell(value)
  return formatterFor(column?.type)(n)
}

export function WidgetView({
  widget,
  compact = false,
}: {
  widget: WidgetSpec | WidgetDraft
  compact?: boolean
}) {
  const rows = widget.rows as Row[]
  const columnOf = (name: string | null | undefined) =>
    widget.columns.find((column) => column.name === name)
  const yName = widget.y[0] ?? widget.columns.find((c) => c.type !== "text")?.name ?? ""
  const yColumn = columnOf(yName)
  const xColumn = columnOf(widget.x)
  if (!rows.length) return <EmptyState />
  if (widget.kind === "kpi")
    return (
      <Kpi
        value={numeric(rows[0]?.[yName])}
        column={yColumn}
        title={widget.title}
        compact={compact}
      />
    )
  if ((widget.kind === "line" || widget.kind === "bar") && widget.x) {
    const format = formatterFor(yColumn?.type)
    const tick = formatterFor(yColumn?.type, true)
    if (compact) return <Spark rows={rows} y={yName} bar={widget.kind === "bar"} />
    return (
      <div className="w-chart">
        <Chart
          rows={rows}
          x={widget.x}
          y={yName}
          type={widget.kind}
          label={yColumn?.label ?? widget.title}
          formatValue={format}
          formatTick={tick}
          formatLabel={(value) => formatCell(value, xColumn)}
          legend={false}
        />
      </div>
    )
  }
  if (widget.kind === "hbar" && widget.x) {
    const x = widget.x
    return (
      <div className="w-hbar">
        <HBars
          rows={rows}
          value={yName}
          label={(row) => formatCell(row[x], xColumn)}
          format={formatterFor(yColumn?.type, compact)}
          limit={compact ? 4 : 10}
        />
      </div>
    )
  }
  const shown = compact ? rows.slice(0, 4) : rows
  const columns = compact ? widget.columns.slice(0, 3) : widget.columns
  return (
    <div className="w-table-wrap">
      <table className="w-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.name} className={column.type === "text" ? "" : "num"}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={columns.map((column) => String(row[column.name])).join("|")}>
              {columns.map((column) => (
                <td key={column.name} className={column.type === "text" ? "" : "num"}>
                  {formatCell(row[column.name], column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Spark({ rows, y, bar }: { rows: Row[]; y: string; bar: boolean }) {
  const values = rows.map((row) => numeric(row[y]) ?? 0)
  const max = Math.max(...values, 1e-9)
  const min = bar ? 0 : Math.min(...values)
  const span = Math.max(max - min, 1e-9)
  const at = (i: number) => (i / Math.max(values.length - 1, 1)) * 100
  const level = (n: number) => 38 - ((n - min) / span) * 34
  const path = values.map((n, i) => `${i ? "L" : "M"}${at(i)},${level(n)}`).join(" ")
  return (
    <svg className="w-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      {bar ? (
        values
          .map((n, i) => ({ n, id: `b${String(i)}`, i }))
          .map(({ n, id, i }) => {
            const w = 100 / values.length
            return (
              <rect
                key={id}
                x={i * w + w * 0.15}
                width={w * 0.7}
                y={level(n)}
                height={40 - level(n)}
                rx="1"
              />
            )
          })
      ) : (
        <>
          <path className="w-spark-area" d={`${path} L100,40 L0,40 Z`} />
          <path className="w-spark-line" d={path} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

function Kpi({
  value,
  column,
  title,
  compact,
}: {
  value: number | null
  column: WidgetColumn | undefined
  title: string
  compact: boolean
}) {
  return (
    <div className={`w-kpi${compact ? " compact" : ""}`}>
      <strong>{value === null ? ru.noValue : formatterFor(column?.type)(value)}</strong>
      <span>{column?.label ?? title}</span>
    </div>
  )
}
