import type { Filters } from "@/shared/api/metrics"
import type { WidgetSpec } from "@/shared/api/widget-types"

export function WidgetGenerator(_props: {
  filters: Filters
  onCreated: (widget: WidgetSpec) => void
}) {
  return null
}
