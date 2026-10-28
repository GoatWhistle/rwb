import type { WidgetDraft, WidgetSpec } from "@/shared/api/widget-types"

export function WidgetView({
  widget,
  compact = false,
}: {
  widget: WidgetSpec | WidgetDraft
  compact?: boolean
}) {
  const rows = widget.rows.slice(0, compact ? 5 : 20)
  return (
    <div className="widget-view">
      <strong>{widget.title}</strong>
      <table>
        <thead>
          <tr>
            {widget.columns.map((column) => (
              <th key={column.name}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={JSON.stringify(row)}>
              {widget.columns.map((column) => (
                <td key={column.name}>{row[column.name] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
