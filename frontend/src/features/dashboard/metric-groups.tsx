import type { MetricResult } from "@/shared/api/metrics"
import type { Row } from "@/shared/format"
import { number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Money } from "@/shared/ui/money"
import type { MetricSpec } from "./metric-card"
import { rowNumber } from "./metric-card"

function total(rows: Row[], key: string, precision = 1): number | null {
  if (!rows.length) return null
  let sum = 0
  for (const row of rows) {
    const value = numeric(row[key])
    if (value === null) return null
    sum += precision === 1 ? value : Math.round(value * precision)
  }
  return sum / precision
}

export function getMetricGroups(
  monthly: MetricResult | undefined,
  avg: MetricResult | undefined,
  customers: MetricResult | undefined,
  kpi: MetricResult | undefined,
  series?: MetricResult | undefined,
) {
  const trend = series?.table.rows ?? []
  const line = (key: string) => trend.map((r) => numeric(r[key]))
  const rows = monthly?.table.rows ?? []
  const revenue = total(rows, "revenue", 100)
  const orderCount = total(rows, "orders_cnt")
  const returnedPct = rowNumber(customers, "returned_pct")
  const salesMetrics: MetricSpec[] = [
    {
      key: "revenue",
      label: ru.revenue,
      value: revenue,
      note: ru.deliveredOnly,
      format: (n) => <Money value={n} compact />,
      metricId: "block_a.1",
      spark: rows.map((r) => numeric(r.revenue)),
    },
    {
      key: "orders",
      label: ru.orders,
      value: orderCount,
      note: ru.allStatuses,
      metricId: "block_a.1",
      spark: rows.map((r) => numeric(r.orders_cnt)),
    },
    {
      key: "avgCheck",
      label: ru.avgCheck,
      value: rowNumber(avg, "avg_check"),
      note: ru.includesFreight,
      format: (n) => <Money value={n} compact />,
      metricId: "block_a.3",
      spark: line("avg_check"),
    },
    {
      key: "repeat",
      label: ru.repeat,
      value: returnedPct === null ? null : returnedPct / 100,
      note: ru.repeatNote,
      format: (n) => percent(n, 2),
      metricId: "block_a.4",
      spark: line("repeat_pct"),
    },
  ]
  const deliveryMetrics: MetricSpec[] = [
    {
      key: "delivered",
      label: ru.delivered,
      value: rowNumber(kpi, "delivered"),
      note: ru.deliveredOnly,
      metricId: "dashboard.kpi.delivered",
      spark: line("delivered"),
    },
    {
      key: "otd",
      label: ru.otd,
      value: rowNumber(kpi, "otd"),
      note: ru.forPeriod,
      format: percent,
      metricId: "dashboard.kpi.otd",
      spark: line("otd"),
    },
    {
      key: "median",
      label: ru.median,
      value: rowNumber(kpi, "median_days"),
      note: ru.medianLabel,
      format: (n) => `${number(n, 1)} ${ru.days}`,
      metricId: "dashboard.kpi.median_days",
      spark: line("median_days"),
    },
    {
      key: "score",
      label: ru.score,
      value: rowNumber(kpi, "avg_score"),
      note: ru.ofFive,
      format: (n) => number(n, 2),
      metricId: "dashboard.kpi.avg_score",
      spark: line("avg_score"),
    },
  ]
  const customerMetrics: MetricSpec[] = [
    {
      key: "customerTotal",
      label: ru.customerTotal,
      value: rowNumber(customers, "customers_total"),
      note: ru.uniqueCustomers,
      metricId: "block_a.4",
      spark: line("customers"),
    },
    {
      key: "returned",
      label: ru.returned,
      value: rowNumber(customers, "returned"),
      note: ru.repeatNote,
      metricId: "block_a.4",
      spark: line("returned"),
    },
    salesMetrics[3] as MetricSpec,
    {
      key: "avgCheck",
      label: ru.avgCheck,
      value: rowNumber(avg, "avg_check"),
      note: ru.includesFreight,
      format: (n) => <Money value={n} compact />,
      metricId: "block_a.3",
      spark: line("avg_check"),
    },
  ]
  return { salesMetrics, deliveryMetrics, customerMetrics, returnedPct }
}
