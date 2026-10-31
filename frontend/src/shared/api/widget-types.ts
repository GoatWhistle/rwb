import type { Filters } from "./metrics"

export type WidgetKind = "kpi" | "line" | "bar" | "hbar" | "table"

export type WidgetCell = string | number | null

export interface WidgetColumn {
  name: string
  label: string
  type: "text" | "number" | "money" | "percent" | "date"
}

export interface WidgetSpec {
  id: string
  title: string
  description: string
  kind: WidgetKind
  sql: string
  columns: WidgetColumn[]
  rows: Record<string, WidgetCell>[]
  x: string | null
  y: string[]
  source: "agent" | "chat" | "catalog"
  prompt: string | null
  filters: Filters | null
  created_at: string
}

export type WidgetDraft = Omit<WidgetSpec, "id" | "created_at">

export interface WidgetGenerateRequest {
  prompt: string
  filters: Filters
}

export interface WidgetGenerateResponse {
  widget: WidgetDraft
  answer: string
}

export type WidgetSize = "s" | "m" | "l" | "xl"

export interface DashboardItem {
  widget_id: string
  size: WidgetSize
}

export interface CustomDashboard {
  id: string
  title: string
  items: DashboardItem[]
  updated_at: string
}
