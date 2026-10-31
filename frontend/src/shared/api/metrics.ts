import { useQuery } from "@tanstack/react-query"
import createClient from "openapi-fetch"
import type { Row } from "../format"
import type { components, paths } from "./schema.gen"

export type Filters = components["schemas"]["Filters"]
export type DashboardContext = components["schemas"]["DashboardContext"]
export type ChatRequest = components["schemas"]["ChatRequest"]
export interface DataTable {
  columns: { name: string }[]
  rows: Row[]
  truncated: boolean
}
export interface MetricResult {
  metric_id: string
  table: DataTable
  definition: Record<string, string>
  units: string
  limitations: string[]
  filters: Filters
  data_version: string
  metrics_version: string
}
export const api = createClient<paths>()
export function useMetric(id: string, filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ["metric", id, filters],
    enabled,
    queryFn: async ({ signal }): Promise<MetricResult> => {
      const { data, error, response } = await api.POST("/api/metrics/query", {
        body: { metric_id: id, filters },
        signal,
      })
      if (!response.ok || error) throw new Error("metric_unavailable")
      return data as MetricResult
    },
  })
}
