import { useEffect, useId, useRef, useState } from "react"
import type { Row } from "../format"
import { cell, number, numeric } from "../format"
import { ru } from "../i18n/ru"
import { EmptyState } from "./controls"
import "../styles/chart.css"

export interface ChartProps {
  rows: Row[]
  x: string
  y: string
  label: string
  type?: "line" | "bar"
  formatValue?: ((n: number) => string) | undefined
  formatLabel?: ((value: unknown) => string) | undefined
  formatTick?: ((n: number) => string) | undefined
  target?: number | undefined
  targetLabel?: string | undefined
}
export function Chart({
  rows,
  x,
  y,
  label,
  type = "line",
  formatValue = number,
  formatLabel = cell,
  formatTick,
  target,
  targetLabel,
}: ChartProps) {
  const tick = formatTick ?? formatValue
  const container = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(800)
  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setChartWidth(Math.max(280, entry.contentRect.width - 28))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const width = chartWidth,
    height = 260,
    right = 18,
    top = 14,
    bottom = 32
  const values = rows.map((row) => numeric(row[y]))
  const measured = values.filter((n): n is number => n !== null)
  if (!measured.length)
    return (
      <div className="chart-wrap" ref={container}>
        <EmptyState />
      </div>
    )
  const dataMax = Math.max(...measured, target ?? 0, 1e-9)
  const dataMin = Math.min(...measured, 0)
  const magnitude = 10 ** Math.floor(Math.log10((dataMax - dataMin) / 4))
  const step = Math.ceil((dataMax - dataMin) / 4 / magnitude) * magnitude
  const min = Math.floor(dataMin / step) * step
  const max = Math.ceil(dataMax / step) * step
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4)
  const left = Math.max(...ticks.map((n) => tick(n).length)) * 7.4 + 18
  const px = (i: number) => left + (i / Math.max(rows.length - 1, 1)) * (width - left - right)
  const py = (n: number) => height - bottom - ((n - min) / (max - min)) * (height - top - bottom)
  const segments: string[] = []
  values.forEach((n, i) => {
    if (n !== null)
      segments.push(`${i === 0 || values[i - 1] === null ? "M" : "L"}${px(i)},${py(n)}`)
  })
  const row = active === null ? null : rows[active]
  const value = active === null ? null : values[active]
  return (
    <div className="chart-wrap" ref={container}>
      {/* biome-ignore lint/a11y/useSemanticElements: SVG groups contain chart geometry. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={id}
        className="chart-svg"
      >
        <title id={id}>{label}</title>
        {ticks.map((n) => {
          return (
            <g key={n}>
              <line x1={left} x2={width - right} y1={py(n)} y2={py(n)} className="chart-grid" />
              <text x={left - 12} y={py(n) + 4} textAnchor="end" className="chart-label">
                {tick(n)}
              </text>
            </g>
          )
        })}
        {type === "line" &&
          values.map((n, i) => {
            if (n !== null || rows.length < 2) return null
            const span = (width - left - right) / Math.max(rows.length - 1, 1)
            return (
              <g key={`gap-${String(rows[i]?.[x])}`}>
                <rect
                  x={px(i) - span / 2}
                  y={top}
                  width={span}
                  height={height - top - bottom}
                  className="chart-gap"
                />
                <text x={px(i)} y={top + 14} textAnchor="middle" className="chart-gap-label">
                  {ru.noDataMonth}
                </text>
              </g>
            )
          })}
        {type === "line" &&
          values.map((_, i) => {
            if (values[i] === null || (i > 0 && values[i - 1] !== null)) return null
            let end = i
            while (end + 1 < values.length && values[end + 1] !== null) end += 1
            if (end === i) return null
            const base = py(Math.max(min, 0))
            const points = values
              .slice(i, end + 1)
              .map((n, k) => `${px(i + k)},${py(n ?? 0)}`)
              .join(" L")
            return (
              <path
                key={`area-${String(rows[i]?.[x])}`}
                d={`M${px(i)},${base} L${points} L${px(end)},${base} Z`}
                className="chart-area"
              />
            )
          })}
        {target !== undefined && (
          <g className="chart-target" pointerEvents="none">
            <line x1={left} x2={width - right} y1={py(target)} y2={py(target)} />
            <text x={width - right} y={py(target) - 6} textAnchor="end">
              {targetLabel ?? tick(target)}
            </text>
          </g>
        )}
        {type === "line" && <path d={segments.join(" ")} className="chart-line" pathLength={1} />}
        {rows.map((item, i) => {
          const n = values[i]
          const showLabel =
            i % Math.ceil(rows.length / Math.max(2, Math.floor(width / 140))) === 0 ||
            i === rows.length - 1
          return (
            <g key={JSON.stringify(item)}>
              {type === "bar" && n !== null && n !== undefined && (
                <rect
                  x={px(i) - 9}
                  y={py(n)}
                  width={18}
                  height={height - bottom - py(n)}
                  rx={2}
                  className={`chart-bar${active === i ? " active" : ""}`}
                />
              )}
              {showLabel && (
                <text x={px(i)} y={height - 6} textAnchor="middle" className="chart-label">
                  {formatLabel(item[x])}
                </text>
              )}
              {/* biome-ignore lint/a11y/useSemanticElements: SVG data points require SVG geometry. */}
              <rect
                x={px(i) - Math.max((width - left - right) / Math.max(rows.length - 1, 1) / 2, 8)}
                y={top}
                width={Math.max((width - left - right) / Math.max(rows.length - 1, 1), 16)}
                height={height - top - bottom}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${formatLabel(item[x])}: ${n === null || n === undefined ? ru.noValue : formatValue(n)}`}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setActive(i)
                  }
                }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          )
        })}
        {active !== null && value !== null && value !== undefined && (
          <g pointerEvents="none">
            <line
              x1={px(active)}
              x2={px(active)}
              y1={top}
              y2={height - bottom}
              className="chart-guide"
            />
            <circle cx={px(active)} cy={py(value)} r={5} className="chart-point" />
          </g>
        )}
      </svg>
      {row && value !== null && value !== undefined && (
        <div
          key={active}
          className="chart-tooltip"
          style={{
            left: `clamp(8px, calc(${(px(active ?? 0) / width) * 100}% - 70px), calc(100% - 200px))`,
          }}
        >
          <span>{formatLabel(row[x])}</span>
          <strong>{formatValue(value)}</strong>
        </div>
      )}
      <p className="sr-only">
        {ru.table}:{" "}
        {rows
          .map(
            (item) =>
              `${formatLabel(item[x])}: ${numeric(item[y]) === null ? ru.noValue : formatValue(Number(item[y]))}`,
          )
          .join("; ")}
      </p>
    </div>
  )
}
