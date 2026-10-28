import type { IncomingMessage, ServerResponse } from "node:http"
import type { MockFilters, Row } from "./data"
import {
  categoriesFor,
  deliveryMonthlyFor,
  kpiFor,
  latenessFor,
  monthlyFor,
  statesFor,
} from "./data"

type Kind = "kpi" | "line" | "bar" | "hbar" | "table"
type ColumnType = "text" | "number" | "money" | "percent" | "date"
interface Column {
  name: string
  label: string
  type: ColumnType
}
interface Draft {
  title: string
  description: string
  kind: Kind
  sql: string
  columns: Column[]
  rows: Row[]
  x: string | null
  y: string[]
  source: "agent" | "chat" | "catalog"
  prompt: string | null
  filters: MockFilters | null
}
interface Widget extends Draft {
  id: string
  created_at: string
}
interface Dashboard {
  id: string
  title: string
  items: { widget_id: string; size: "s" | "m" | "l" | "xl" }[]
  updated_at: string
}
interface Template {
  keys: string[]
  title: string
  description: string
  kind: Kind
  sql: string
  columns: Column[]
  x: string | null
  y: string[]
  build: (filters: MockFilters) => Row[]
}

const top = (rows: Row[], key: string, limit: number) =>
  [...rows].sort((a, b) => Number(b[key]) - Number(a[key])).slice(0, limit)

const templates: Template[] = [
  {
    keys: ["выручк", "продаж", "месяц"],
    title: "Выручка по месяцам",
    description: "Сумма оплат по оформленным заказам, помесячно",
    kind: "line",
    sql: "SELECT date_trunc('month', purchased_at) AS month, sum(payment_value) AS revenue\nFROM mart.order_fulfillment\nGROUP BY 1 ORDER BY 1",
    columns: [
      { name: "month", label: "Месяц", type: "date" },
      { name: "revenue", label: "Выручка", type: "money" },
    ],
    x: "month",
    y: ["revenue"],
    build: (f) =>
      monthlyFor(f).map((r) => ({
        month: `${String(r.month).slice(0, 7)}-01`,
        revenue: r.revenue ?? 0,
      })),
  },
  {
    keys: ["категор"],
    title: "Топ-10 категорий по выручке",
    description: "Категории товаров с наибольшей выручкой",
    kind: "hbar",
    sql: "SELECT category, sum(price) AS revenue\nFROM mart.seller_shipment\nGROUP BY 1 ORDER BY 2 DESC LIMIT 10",
    columns: [
      { name: "category", label: "Категория", type: "text" },
      { name: "revenue", label: "Выручка", type: "money" },
    ],
    x: "category",
    y: ["revenue"],
    build: (f) =>
      top(categoriesFor(f), "revenue", 10).map((r) => ({
        category: r.category ?? "",
        revenue: r.revenue ?? 0,
      })),
  },
  {
    keys: ["доставк", "вовремя", "срок"],
    title: "Доля доставок вовремя",
    description: "Доставленные заказы, пришедшие не позже обещанной даты",
    kind: "kpi",
    sql: "SELECT avg((delivered_at <= promised_at)::int) AS otd\nFROM mart.order_fulfillment\nWHERE delivered_at IS NOT NULL",
    columns: [{ name: "otd", label: "Доставлено вовремя", type: "percent" }],
    x: null,
    y: ["otd"],
    build: (f) => kpiFor(f).map((r) => ({ otd: r.otd ?? null })),
  },
  {
    keys: ["штат", "регион", "гео"],
    title: "Доставки вовремя по штатам",
    description: "Штаты с наибольшим числом доставленных заказов",
    kind: "table",
    sql: "SELECT state, count(*) AS delivered, avg(on_time) AS otd, median(days) AS median_days\nFROM mart.order_fulfillment GROUP BY 1 ORDER BY 2 DESC",
    columns: [
      { name: "state", label: "Штат", type: "text" },
      { name: "delivered", label: "Доставлено", type: "number" },
      { name: "otd", label: "Вовремя", type: "percent" },
      { name: "median_days", label: "Медиана, дн.", type: "number" },
    ],
    x: "state",
    y: ["delivered", "otd"],
    build: (f) =>
      top(statesFor(f), "delivered", 12).map((r) => ({
        state: r.state ?? "",
        delivered: r.delivered ?? 0,
        otd: r.otd ?? null,
        median_days: r.median_days ?? null,
      })),
  },
  {
    keys: ["оценк", "отзыв", "рейтинг"],
    title: "Средняя оценка по просрочке",
    description: "Как оценка заказа зависит от опоздания доставки",
    kind: "bar",
    sql: "SELECT lateness_bucket, avg(review_score) AS avg_score\nFROM mart.order_fulfillment GROUP BY 1 ORDER BY min(lateness_days)",
    columns: [
      { name: "bucket", label: "Просрочка", type: "text" },
      { name: "avg_score", label: "Средняя оценка", type: "number" },
    ],
    x: "bucket",
    y: ["avg_score"],
    build: (f) =>
      latenessFor(f).map((r) => ({
        bucket: r.bucket ?? "",
        avg_score: r.avg_score ?? null,
      })),
  },
  {
    keys: [],
    title: "Доставка по месяцам",
    description: "Доля доставок вовремя, помесячно",
    kind: "line",
    sql: "SELECT date_trunc('month', delivered_at) AS month, avg(on_time) AS otd\nFROM mart.order_fulfillment GROUP BY 1 ORDER BY 1",
    columns: [
      { name: "month", label: "Месяц", type: "date" },
      { name: "otd", label: "Вовремя", type: "percent" },
    ],
    x: "month",
    y: ["otd"],
    build: (f) =>
      deliveryMonthlyFor(f).map((r) => ({
        month: `${String(r.month)}-01`,
        otd: r.otd ?? null,
      })),
  },
]

const templateFor = (prompt: string) => {
  const text = prompt.toLowerCase()
  return (templates.find((t) => t.keys.some((key) => text.includes(key))) ??
    templates[templates.length - 1]) as Template
}

const draftFrom = (
  template: Template,
  filters: MockFilters,
  source: Draft["source"],
  prompt: string | null,
): Draft => ({
  title: template.title,
  description: template.description,
  kind: template.kind,
  sql: template.sql,
  columns: template.columns,
  rows: template.build(filters),
  x: template.x,
  y: template.y,
  source,
  prompt,
  filters,
})

let counter = 0
const nextId = (prefix: string) => `${prefix}_${(++counter).toString(36).padStart(4, "0")}`
const now = () => new Date().toISOString()

const widgets: Widget[] = [
  ["выручка по месяцам", "2026-10-26T10:00:00Z"],
  ["топ-10 категорий", "2026-10-27T10:00:00Z"],
  ["доля доставок вовремя", "2026-10-28T08:00:00Z"],
]
  .map(([prompt, created]) => ({
    ...draftFrom(templateFor(prompt ?? ""), {}, "agent" as const, prompt ?? null),
    id: nextId("w"),
    created_at: created ?? now(),
  }))
  .reverse()

const seedIds = widgets.map((w) => w.id).reverse()
const dashboards: Dashboard[] = [
  {
    id: nextId("d"),
    title: "Мой обзор",
    items: [
      { widget_id: seedIds[2] ?? "", size: "s" },
      { widget_id: seedIds[0] ?? "", size: "l" },
      { widget_id: seedIds[1] ?? "", size: "xl" },
    ],
    updated_at: now(),
  },
]

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

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status
  if (body === undefined) return res.end()
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  return res.end(JSON.stringify(body))
}

const notFound = (res: ServerResponse) =>
  send(res, 404, { code: "not_found", message: "Не найдено" })

async function constructorRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = req.url?.split("?")[0] ?? ""
  const method = req.method ?? "GET"
  const parts = path.split("/").filter(Boolean)
  if (parts[1] === "widgets") return widgetsRoute(req, res, method, parts)
  if (parts[1] === "dashboards") return dashboardsRoute(req, res, method, parts)
  return false
}

async function generateWidget(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req)
  const prompt = typeof body.prompt === "string" ? body.prompt : ""
  const filters = (body.filters ?? {}) as MockFilters
  await wait(1500)
  const template = templateFor(prompt)
  send(res, 200, {
    widget: draftFrom(template, filters, "agent", prompt),
    answer: `Собрал виджет «${template.title}»: ${template.description.toLowerCase()}.`,
  })
}

async function widgetCollection(req: IncomingMessage, res: ServerResponse, method: string) {
  if (method === "GET") {
    send(res, 200, { items: widgets })
    return true
  }
  if (method !== "POST") return false
  const body = (await readJson(req)) as unknown as Draft
  const widget: Widget = { ...body, id: nextId("w"), created_at: now() }
  widgets.unshift(widget)
  send(res, 201, widget)
  return true
}

async function refreshWidget(req: IncomingMessage, res: ServerResponse, index: number) {
  const body = await readJson(req)
  const filters = (body.filters ?? {}) as MockFilters
  const current = widgets[index] as Widget
  const template = templates.find((t) => t.title === current.title)
  const refreshed: Widget = {
    ...current,
    filters,
    rows: template ? template.build(filters) : current.rows,
  }
  widgets[index] = refreshed
  send(res, 200, refreshed)
}

async function widgetsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  parts: string[],
): Promise<boolean> {
  const id = parts[2]
  if (method === "POST" && id === "generate") {
    await generateWidget(req, res)
    return true
  }
  if (!id) return widgetCollection(req, res, method)
  const index = widgets.findIndex((w) => w.id === id)
  if (index < 0) {
    notFound(res)
    return true
  }
  if (method === "DELETE" && parts.length === 3) {
    widgets.splice(index, 1)
    for (const d of dashboards) d.items = d.items.filter((item) => item.widget_id !== id)
    send(res, 204)
    return true
  }
  if (method === "POST" && parts[3] === "refresh") {
    await refreshWidget(req, res, index)
    return true
  }
  return false
}

async function dashboardsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  parts: string[],
): Promise<boolean> {
  {
    const id = parts[2]
    if (!id && method === "GET") {
      send(res, 200, { items: dashboards })
      return true
    }
    if (!id && method === "POST") {
      const body = await readJson(req)
      const dashboard: Dashboard = {
        id: nextId("d"),
        title:
          typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Новый дашборд",
        items: [],
        updated_at: now(),
      }
      dashboards.push(dashboard)
      send(res, 201, dashboard)
      return true
    }
    const index = dashboards.findIndex((d) => d.id === id)
    if (index < 0) {
      notFound(res)
      return true
    }
    if (method === "PUT") {
      const body = (await readJson(req)) as unknown as Dashboard
      const updated: Dashboard = {
        id: id ?? "",
        title: String(body.title ?? ""),
        items: Array.isArray(body.items)
          ? body.items.filter((item) => widgets.some((w) => w.id === item.widget_id))
          : [],
        updated_at: now(),
      }
      dashboards[index] = updated
      send(res, 200, updated)
      return true
    }
    if (method === "DELETE") {
      dashboards.splice(index, 1)
      send(res, 204)
      return true
    }
  }
  return false
}

export async function constructorHandler(req: IncomingMessage, res: ServerResponse) {
  if (!(await constructorRoute(req, res))) send(res, 404, { detail: "mock: endpoint not found" })
}
