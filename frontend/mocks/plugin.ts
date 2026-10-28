import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import blockB from "../../backend/catalog/block_b.json" with { type: "json" }
import dcReports from "../../backend/catalog/delivery_customers.json" with { type: "json" }
import overviewSales from "../../backend/catalog/overview_sales.json" with { type: "json" }
import reports from "../../backend/catalog/reports.json" with { type: "json" }
import { blockBBuilders } from "./block-b"
import { scenarioFor } from "./chat"
import { constructorHandler } from "./constructor"
import type { MockFilters, Row } from "./data"
import {
  avgCheckFor,
  categoriesFor,
  checks,
  customersFor,
  deliveryMonthlyFor,
  hexId,
  kpiFor,
  latenessFor,
  monthlyFor,
  rng,
  sellerDeliveryFor,
  sellersFor,
  statesFor,
} from "./data"
import { deliveryCustomerBuilders } from "./delivery-customers"
import {
  heatmapFor,
  installmentsFor,
  kpiMonthlyFor,
  paymentsMonthlyFor,
  statesRevenueFor,
  statusMixFor,
} from "./overview-sales"

const METRICS_VERSION = "mock0c4f1e7a9b2d"
const DATA_VERSION = "olist-2018-10-17-mock"

interface Report {
  id: string
  definitions: Record<string, string>
  units: string
  limitations: string[]
}
const catalog = [...reports, ...overviewSales, ...dcReports, ...blockB] as unknown as Report[]
const builders: Record<string, (filters: MockFilters) => Row[]> = {
  "block_a.1": monthlyFor,
  "block_a.2": sellersFor,
  "block_a.3": avgCheckFor,
  "block_a.4": customersFor,
  "block_a.5": categoriesFor,
  "dashboard.kpi": kpiFor,
  "dashboard.checks": () => [checks],
  "dashboard.monthly": deliveryMonthlyFor,
  "dashboard.states": statesFor,
  "dashboard.lateness": latenessFor,
  "dashboard.sellers": sellerDeliveryFor,
  "os.kpi_monthly": kpiMonthlyFor,
  "os.heatmap": heatmapFor,
  "os.payments_monthly": paymentsMonthlyFor,
  "os.installments": installmentsFor,
  "os.states_revenue": statesRevenueFor,
  "os.status_mix": statusMixFor,
  ...deliveryCustomerBuilders,
  ...blockBBuilders,
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

function table(rows: Row[]) {
  return {
    columns: Object.entries(rows[0] ?? {}).map(([name, value]) => ({
      name,
      type: typeof value === "number" ? (Number.isInteger(value) ? "int" : "float") : "str",
    })),
    rows,
    truncated: false,
  }
}

export function queryMetric(metricId: string, filters: MockFilters) {
  const report = catalog.find((item) => item.id === metricId)
  const build = builders[metricId]
  if (!report || !build) return null
  return {
    metric_id: metricId,
    table: table(build(filters)),
    definition: report.definitions,
    units: report.units,
    limitations: report.limitations,
    filters: {
      start_date: filters.start_date ?? null,
      end_date: filters.end_date ?? null,
      states: filters.states ?? [],
      seller_ids: filters.seller_ids ?? [],
      categories: filters.categories ?? [],
    },
    sql: `-- mock: ${metricId}`,
    parameters: {},
    metrics_version: METRICS_VERSION,
    data_version: DATA_VERSION,
  }
}

let chatCounter = 0

async function streamChat(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req)
  const random = rng(++chatCounter * 7919)
  const runId = hexId(random)
  const sessionId = typeof body.session_id === "string" ? body.session_id : hexId(random)
  const message = typeof body.message === "string" ? body.message : ""
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  })
  let closed = false
  res.on("close", () => {
    closed = true
  })
  const emit = (event: string, payload: Record<string, unknown>) => {
    if (closed) return
    const data = { run_id: runId, session_id: sessionId, ...payload }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const scenario = scenarioFor(message)
  emit("run_started", { metrics_version: METRICS_VERSION })
  await wait(300)
  const sources: Record<string, unknown>[] = []
  for (const tool of scenario.tools) {
    const callId = hexId(random)
    emit("tool_started", {
      call_id: callId,
      name: tool.name,
      arguments: tool.arguments,
    })
    await wait(500 + Math.floor(random() * 500))
    const tableId = `table_${callId}`
    const result = table(tool.rows)
    if (tool.result) {
      emit("tool_finished", {
        call_id: callId,
        name: tool.name,
        ok: true,
        elapsed_ms: 140,
        result: tool.result,
      })
      continue
    }
    emit("table", { table_id: tableId, ...result })
    const source = {
      type: "sql",
      id: callId,
      sql: tool.sql,
      parameters: {},
      metric_id: tool.metricId ?? null,
      definition: null,
      filters: null,
    }
    sources.push(source)
    emit("tool_finished", {
      call_id: callId,
      name: tool.name,
      ok: true,
      elapsed_ms: 180 + Math.floor(random() * 600),
      result: {
        table: result,
        table_id: tableId,
        sql: tool.sql,
        sources: [source],
      },
    })
    if (tool.chart) emit("chart", { ...tool.chart, table_id: tableId })
  }
  for (const token of scenario.text.match(/\S+\s*/g) ?? []) {
    if (closed) return
    emit("text_delta", { delta: token })
    await wait(18 + Math.floor(random() * 30))
  }
  emit("sources", { items: sources, details: scenario.details })
  emit("done", { text: scenario.text })
  res.end()
}

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown

const routes: Record<string, Handler> = {
  "GET /api/health": (_req, res) =>
    send(res, 200, {
      status: "ok",
      database: "ok",
      data_version: DATA_VERSION,
      metrics_version: METRICS_VERSION,
      review_index: [
        {
          model: "mock",
          indexed_at: "2026-10-28T09:00:00Z",
          review_count: 99224,
        },
      ],
    }),
  "GET /api/metrics": (_req, res) =>
    send(res, 200, {
      metrics_version: METRICS_VERSION,
      reports: catalog.map(({ id, definitions, units, limitations }) => ({
        id,
        definitions,
        units,
        limitations,
        supported_filters: ["start_date", "end_date", "states", "seller_ids", "categories"],
      })),
    }),
  "POST /api/metrics/query": async (req, res) => {
    const body = await readJson(req)
    const result = queryMetric(String(body.metric_id ?? ""), (body.filters ?? {}) as MockFilters)
    return result
      ? send(res, 200, result)
      : send(res, 422, {
          detail: `Неизвестный metric_id: ${String(body.metric_id)}`,
        })
  },
  "POST /api/chat/stream": streamChat,
}

export function mockApi(): Plugin {
  let enabled = false
  return {
    name: "datum-mock-api",
    apply: "serve",
    configResolved(config) {
      enabled = config.mode === "mock" || process.env.MOCK === "1" || process.env.VITE_MOCK === "1"
      if (enabled) config.logger.info("  datum: API-моки включены (frontend/mocks)")
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!enabled || !req.url?.startsWith("/api/")) return next()
        await wait(120 + Math.floor(Math.random() * 250))
        const route = routes[`${req.method} ${req.url.split("?")[0]}`]
        try {
          return await (route ?? constructorHandler)(req, res)
        } catch {
          if (!res.destroyed && !res.writableEnded) res.destroy()
          return undefined
        }
      })
    },
  }
}
