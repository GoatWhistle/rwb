import type { CSSProperties } from "react"
import type { Row } from "@/shared/format"
import { numeric } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"

export function HBars({
  rows,
  label,
  value,
  format,
  order = "desc",
  limit = 10,
  target,
  targetLabel,
  max: fixedMax,
}: {
  rows: Row[]
  label: (row: Row) => string
  value: string
  format: (n: number) => string
  order?: "asc" | "desc" | "none"
  limit?: number
  target?: number | undefined
  targetLabel?: string | undefined
  max?: number | undefined
}) {
  const items = rows
    .map((row) => ({ row, n: numeric(row[value]) }))
    .filter((item): item is { row: Row; n: number } => item.n !== null)
  if (order !== "none") items.sort((a, b) => (order === "desc" ? b.n - a.n : a.n - b.n))
  const shown = items.slice(0, limit)
  if (!shown.length) return <EmptyState />
  const max = fixedMax ?? Math.max(...shown.map((item) => item.n), target ?? 0, 1e-9)
  const targetAt = target === undefined ? undefined : `${(target / max) * 100}%`
  return (
    <div
      className={`hbars${targetAt ? " has-target" : ""}`}
      style={targetAt ? ({ "--target": targetAt } as CSSProperties) : undefined}
    >
      {targetAt && (
        <div className="hbar-row hbar-legend" aria-hidden="true">
          <span />
          <span className="hbar-track">
            <span className="hbar-target-label">{targetLabel}</span>
          </span>
          <span />
        </div>
      )}
      {shown.map((item, i) => (
        <div
          className="hbar-row"
          key={`${label(item.row)}-${String(i)}`}
          style={{ "--i": i } as CSSProperties}
        >
          <span className="hbar-name" title={label(item.row)}>
            {label(item.row)}
          </span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: `${Math.min(100, Math.max(0, (item.n / max) * 100))}%` }}
            />
          </span>
          <strong className="hbar-value">{format(item.n)}</strong>
        </div>
      ))}
    </div>
  )
}
