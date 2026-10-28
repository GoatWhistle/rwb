import { ArrowDownRight, ArrowUpRight, MessageSquare, Minus } from "lucide-react"
import type { ReactNode } from "react"
import type { DashboardContext, Filters, MetricResult } from "@/shared/api/metrics"
import { number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { IconButton, Tip } from "@/shared/ui/controls"

export interface MetricSpec {
  key: keyof typeof ru.tips
  label: string
  value: number | null
  note: string
  format?: (value: number) => ReactNode
  metricId: string
  spark?: (number | null)[]
}
function lastDelta(spark: (number | null)[]): number | null {
  const measured = spark.filter((n): n is number => n !== null)
  const last = measured.at(-1)
  const prior = measured.at(-2)
  if (last === undefined || prior === undefined || prior === 0) return null
  return (last - prior) / Math.abs(prior)
}
function Delta({ value }: { value: number }) {
  const direction = Math.abs(value) < 0.0005 ? "flat" : value > 0 ? "up" : "down"
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus
  return (
    <span className={`metric-delta ${direction}`}>
      <Icon size={14} aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {percent(value)}
      <small>{ru.vsPrevMonth}</small>
    </span>
  )
}
export function MetricCard({
  metric,
  filters,
  result,
  onAsk,
}: {
  metric: MetricSpec
  filters: Filters
  result?: MetricResult | undefined
  onAsk: (context: DashboardContext, name: string) => void
}) {
  const ask = () =>
    onAsk(
      {
        metric_id: metric.metricId,
        widget_id: metric.key,
        displayed_value: metric.value,
        filters,
        data_version: result?.data_version ?? null,
        metrics_version: result?.metrics_version ?? null,
      },
      metric.label,
    )
  const spark = metric.spark ?? []
  const measured = spark.filter((n): n is number => n !== null)
  const max = Math.max(...measured, 1)
  const min = Math.min(...measured, 0)
  const delta = lastDelta(spark)
  return (
    <article className="metric-card">
      <div className="metric-label">
        <span>{metric.label}</span>
        <Tip text={ru.tips[metric.key]} onAsk={ask} />
      </div>
      <strong className="metric-value">
        {metric.value === null ? (
          <span className="no-value">{ru.noValue}</span>
        ) : (
          (metric.format ?? number)(metric.value)
        )}
      </strong>
      <div className="metric-bottom">
        <span className="metric-meta">
          {delta !== null && <Delta value={delta} />}
          <span className="metric-note">{metric.note}</span>
        </span>
        {measured.length > 1 && (
          <svg className="sparkline" viewBox="0 0 100 28" aria-hidden="true">
            <path
              d={spark
                .map((n, i) =>
                  n === null
                    ? ""
                    : `${i === 0 || spark[i - 1] === null ? "M" : "L"}${(i / (spark.length - 1)) * 100},${26 - ((n - min) / Math.max(max - min, 1)) * 24}`,
                )
                .join(" ")}
            />
          </svg>
        )}
      </div>
      <IconButton label={ru.ask} className="metric-ask" onClick={ask}>
        <MessageSquare size={14} />
      </IconButton>
    </article>
  )
}
export const rowNumber = (result: MetricResult | undefined, key: string) =>
  numeric(result?.table.rows[0]?.[key])
