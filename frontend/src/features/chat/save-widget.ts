import type { DataTable } from "@/shared/api/metrics"
import type { WidgetCell, WidgetColumn, WidgetDraft, WidgetKind } from "@/shared/api/widget-types"
import { numeric } from "@/shared/format"

function columnType(name: string, numericColumn: boolean): WidgetColumn["type"] {
  if (/(_at|_date|month|day)$/.test(name)) return "date"
  if (!numericColumn) return "text"
  if (/(pct|share|otd|rate)/.test(name)) return "percent"
  if (/(revenue|price|value|amount|check|paid|total|freight)/.test(name)) return "money"
  return "number"
}

function toCell(value: unknown): WidgetCell {
  if (value === null || value === undefined) return null
  if (typeof value === "number" || typeof value === "string") return value
  return String(value)
}

export function buildDraft({
  table,
  title,
  question,
  kind,
  x,
  y,
  sql,
  labels,
}: {
  table: DataTable
  title: string
  question: string
  kind: WidgetKind
  x: string | null
  y: string[]
  sql: string
  labels: Record<string, string>
}): WidgetDraft {
  return {
    title,
    description: question,
    kind,
    sql,
    columns: table.columns.map((col) => ({
      name: col.name,
      label: labels[col.name] ?? col.name,
      type: columnType(
        col.name,
        table.rows.some((row) => numeric(row[col.name]) !== null),
      ),
    })),
    rows: table.rows.map((row) =>
      Object.fromEntries(table.columns.map((col) => [col.name, toCell(row[col.name])])),
    ),
    x,
    y,
    source: "chat",
    prompt: question,
    filters: null,
  }
}

export async function saveWidget(draft: WidgetDraft) {
  const response = await fetch("/api/widgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  })
  if (!response.ok) throw new Error(`widget_http_${response.status}`)
}
