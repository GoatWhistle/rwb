import type { CSSProperties } from "react"
import type { Row } from "@/shared/format"
import { numeric } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"
import "@/shared/styles/viz-palette.css"
import "@/shared/styles/delivery-customers.css"

export function HBars({
  rows,
  label,
  sublabel,
  value,
  format,
  order = "desc",
  limit = 10,
  target,
  targetLabel,
  min = 0,
  max: fixedMax,
}: {
  rows: Row[]
  label: (row: Row) => string
  sublabel?: ((row: Row) => string) | undefined
  value: string
  format: (n: number) => string
  order?: "asc" | "desc" | "none"
  limit?: number
  target?: number | undefined
  targetLabel?: string | undefined
  min?: number
  max?: number | undefined
}) {
  const items = rows
    .map((row) => ({ row, n: numeric(row[value]) }))
    .filter((item): item is { row: Row; n: number } => item.n !== null)
  if (order !== "none") items.sort((a, b) => (order === "desc" ? b.n - a.n : a.n - b.n))
  const shown = items.slice(0, limit)
  if (!shown.length) return <EmptyState />
  const max = fixedMax ?? Math.max(...shown.map((item) => item.n), target ?? 0, 1e-9)
  const span = Math.max(max - min, 1e-9)
  const at = (n: number) => Math.min(100, Math.max(0, ((n - min) / span) * 100))
  const targetAt = target === undefined ? undefined : `${at(target)}%`
  return (
    <div
      className={`barlist${targetAt ? " has-target" : ""}`}
      style={targetAt ? ({ "--target": targetAt } as CSSProperties) : undefined}
    >
      {shown.map((item, i) => {
        const below = target !== undefined && item.n < target
        return (
          <div
            className={`barlist-row${below ? " below" : ""}`}
            key={`${label(item.row)}-${String(i)}`}
            style={{ "--i": i, "--w": `${Math.max(at(item.n), 1)}%` } as CSSProperties}
          >
            <span className="barlist-name" title={label(item.row)}>
              <span className="barlist-text">{label(item.row)}</span>
              {sublabel && <small>{sublabel(item.row)}</small>}
            </span>
            <span className="barlist-track">
              <span className="barlist-fill" />
              <strong className="barlist-value">{format(item.n)}</strong>
            </span>
          </div>
        )
      })}
      {targetAt && (
        <div className="barlist-axis" aria-hidden="true">
          <span />
          <span className="barlist-axis-track">
            <span className="barlist-target-label">{targetLabel}</span>
          </span>
        </div>
      )}
    </div>
  )
}
