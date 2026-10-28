import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Filters } from "./metrics"
import type { CustomDashboard, WidgetDraft, WidgetSpec } from "./widget-types"

const WIDGETS = ["widgets"] as const
const DASHBOARDS = ["dashboards"] as const

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" }
    init.body = JSON.stringify(body)
  }
  const response = await fetch(path, init)
  if (!response.ok) throw new Error(`widgets_${String(response.status)}`)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const widgetsApi = {
  list: () => request<{ items: WidgetSpec[] }>("GET", "/api/widgets").then((r) => r.items),
  create: (draft: WidgetDraft) => request<WidgetSpec>("POST", "/api/widgets", draft),
  remove: (id: string) => request<undefined>("DELETE", `/api/widgets/${id}`),
  refresh: (id: string, filters: Filters) =>
    request<WidgetSpec>("POST", `/api/widgets/${id}/refresh`, { filters }),
  dashboards: () =>
    request<{ items: CustomDashboard[] }>("GET", "/api/dashboards").then((r) => r.items),
  createDashboard: (title: string) =>
    request<CustomDashboard>("POST", "/api/dashboards", { title }),
  updateDashboard: (dashboard: CustomDashboard) =>
    request<CustomDashboard>("PUT", `/api/dashboards/${dashboard.id}`, dashboard),
  removeDashboard: (id: string) => request<undefined>("DELETE", `/api/dashboards/${id}`),
}

export const useWidgets = () => useQuery({ queryKey: WIDGETS, queryFn: widgetsApi.list })
export const useDashboards = () =>
  useQuery({ queryKey: DASHBOARDS, queryFn: widgetsApi.dashboards })

export function useCreateWidget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: widgetsApi.create,
    onSuccess: (widget) =>
      client.setQueryData<WidgetSpec[]>(WIDGETS, (old) => [widget, ...(old ?? [])]),
  })
}

export function useRemoveWidget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: widgetsApi.remove,
    onMutate: (id) => {
      client.setQueryData<WidgetSpec[]>(WIDGETS, (old) => old?.filter((w) => w.id !== id))
      client.setQueryData<CustomDashboard[]>(DASHBOARDS, (old) =>
        old?.map((d) => ({ ...d, items: d.items.filter((item) => item.widget_id !== id) })),
      )
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: WIDGETS })
      void client.invalidateQueries({ queryKey: DASHBOARDS })
    },
  })
}

export function useRefreshWidget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filters }: { id: string; filters: Filters }) =>
      widgetsApi.refresh(id, filters),
    onSuccess: (widget) =>
      client.setQueryData<WidgetSpec[]>(WIDGETS, (old) =>
        old?.map((w) => (w.id === widget.id ? widget : w)),
      ),
  })
}

export function useCreateDashboard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: widgetsApi.createDashboard,
    onSuccess: (dashboard) =>
      client.setQueryData<CustomDashboard[]>(DASHBOARDS, (old) => [...(old ?? []), dashboard]),
  })
}

export function useUpdateDashboard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: widgetsApi.updateDashboard,
    onMutate: async (dashboard) => {
      await client.cancelQueries({ queryKey: DASHBOARDS })
      const previous = client.getQueryData<CustomDashboard[]>(DASHBOARDS)
      client.setQueryData<CustomDashboard[]>(DASHBOARDS, (old) =>
        old?.map((d) => (d.id === dashboard.id ? dashboard : d)),
      )
      return { previous }
    },
    onError: (_error, _dashboard, context) => {
      if (context?.previous) client.setQueryData(DASHBOARDS, context.previous)
    },
  })
}

export function useRemoveDashboard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: widgetsApi.removeDashboard,
    onMutate: (id) =>
      client.setQueryData<CustomDashboard[]>(DASHBOARDS, (old) => old?.filter((d) => d.id !== id)),
    onSettled: () => void client.invalidateQueries({ queryKey: DASHBOARDS }),
  })
}
