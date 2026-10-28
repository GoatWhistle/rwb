import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getMetricGroups } from "../src/features/dashboard/metric-groups"
import { Categories } from "../src/features/dashboard/sales-panels"
import type { MetricResult } from "../src/shared/api/metrics"
import type { Row } from "../src/shared/format"
import { numeric } from "../src/shared/format"
import { ru } from "../src/shared/i18n/ru"
import { Chart } from "../src/shared/ui/chart"
import { DataTable } from "../src/shared/ui/data-table"

const monthlyResult = (rows: Row[]): MetricResult => ({
  metric_id: "block_a.1",
  table: { columns: [], rows, truncated: false },
  definition: {},
  units: "",
  limitations: [],
  filters: {},
  data_version: "test",
  metrics_version: "test",
})

describe("missing data", () => {
  it.each(
    [null, undefined, "", "  ", false, true, [], {}, Number.NaN, Infinity].map((value) => ({
      value,
    })),
  )("does not coerce %j into a measurement", ({ value }) => {
    expect(numeric(value)).toBeNull()
  })

  it.each([0, "0", " 0 "])("keeps a reported zero: %j", (value) => {
    expect(numeric(value)).toBe(0)
  })

  it("does not invent sales totals without monthly data", () => {
    for (const monthly of [undefined, monthlyResult([])]) {
      const { salesMetrics } = getMetricGroups(monthly, undefined, undefined, undefined)
      expect(salesMetrics.every((metric) => metric.value === null)).toBe(true)
    }
  })

  it("does not treat incomplete monthly revenue as zero or a complete total", () => {
    const { salesMetrics } = getMetricGroups(
      monthlyResult([
        { revenue: 123.45, orders_cnt: 2 },
        { revenue: null, orders_cnt: 3 },
      ]),
      undefined,
      undefined,
      undefined,
    )
    expect(salesMetrics[0]?.value).toBeNull()
    expect(salesMetrics[0]?.spark).toEqual([123.45, null])
    expect(salesMetrics[1]?.value).toBe(5)
  })

  it("preserves real zero totals and sums reported monetary amounts precisely", () => {
    const totals = (rows: Row[]) =>
      getMetricGroups(monthlyResult(rows), undefined, undefined, undefined).salesMetrics
    expect(totals([{ revenue: 0, orders_cnt: 0 }])[0]?.value).toBe(0)
    expect(totals([{ revenue: 0, orders_cnt: 0 }])[1]?.value).toBe(0)
    expect(totals([{ revenue: "0.10" }, { revenue: "0.20" }])[0]?.value).toBe(0.3)
  })

  it("does not pass missing numeric table values to formatters as zero", () => {
    const formatted: unknown[] = []
    const html = renderToStaticMarkup(
      createElement(DataTable, {
        rows: [{ value: null }, {}, { value: "" }, { value: " " }, { value: false }, { value: 0 }],
        columns: [
          {
            key: "value",
            label: "Value",
            numeric: true,
            format: (value) => {
              formatted.push(value)
              return `reported: ${value}`
            },
          },
        ],
      }),
    )
    expect(formatted).toEqual([0])
    expect(html.match(/>Нет данных<\/td>/g)).toHaveLength(5)
    expect(html).toContain("reported: 0")
  })

  it.each([
    { rows: [] },
    { rows: [{ month: "2018-01", value: null }] },
    { rows: [{ month: "2018-01", value: " " }] },
  ])("does not draw a chart scale without measurements: %j", ({ rows }) => {
    const html = renderToStaticMarkup(
      createElement(Chart, { rows, x: "month", y: "value", label: "Chart" }),
    )
    expect(html).toContain(ru.empty)
    expect(html).not.toContain("<svg")
  })

  it("can still chart a reported zero", () => {
    const html = renderToStaticMarkup(
      createElement(Chart, {
        rows: [{ month: "2018-01", value: 0 }],
        x: "month",
        y: "value",
        label: "Chart",
      }),
    )
    expect(html).toContain("<svg")
    expect(html).not.toContain(ru.empty)
  })

  it("does not render missing category revenue and share as zero", () => {
    const html = renderToStaticMarkup(
      createElement(Categories, { rows: [{ category: "category", revenue: null }] }),
    )
    expect(html.match(/Нет данных/g)).toHaveLength(2)
    expect(html).not.toContain("category-track")
  })

  it("shows an empty category list explicitly", () => {
    const html = renderToStaticMarkup(createElement(Categories, { rows: [] }))
    expect(html).toContain(ru.empty)
    expect(html).not.toContain(ru.showAll)
  })
})
