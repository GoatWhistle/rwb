import type { CSSProperties, RefObject } from "react"
import { useEffect, useId, useRef, useState } from "react"
import type { Row } from "../format"
import { cell, number, numeric } from "../format"
import { ru } from "../i18n/ru"
import { EmptyState } from "./controls"
import type { TipAnchor } from "./viz-tip"
import { FloatTip } from "./viz-tip"
import "../styles/viz-palette.css"
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
  compare?: string | undefined
  compareLabel?: string | undefined
  seriesLabel?: string | undefined
  legend?: boolean | undefined
  min?: number | undefined
  max?: number | undefined
}
const SERIES = "var(--viz-1)"
const PRIOR = "#8c8c96"
function valueAt(values: (number | null)[], index: number | null) {
  return index === null ? null : (values[index] ?? null)
}
function linePath(values: (number | null)[], px: (i: number) => number, py: (n: number) => number) {
  return values
    .map((n, i) =>
      n === null ? "" : `${i === 0 || values[i - 1] === null ? "M" : "L"}${px(i)},${py(n)}`,
    )
    .join(" ")
}
function swatch(color: string) {
  return { "--swatch": color } as CSSProperties
}
function columns(type: "line" | "bar", count: number, left: number, plotWidth: number) {
  const slot = plotWidth / Math.max(count, 1)
  const step = plotWidth / Math.max(count - 1, 1)
  if (type === "bar")
    return {
      slot,
      hitWidth: slot,
      showValues: slot >= 34,
      px: (i: number) => left + slot * (i + 0.5),
    }
  return {
    slot,
    hitWidth: Math.max(step, 16),
    showValues: false,
    px: (i: number) => left + i * step,
  }
}
function domain(
  values: number[],
  target: number | undefined,
  fixedMin: number | undefined,
  fixedMax: number | undefined,
) {
  const dataMax = fixedMax ?? Math.max(...values, target ?? 0, 1e-9)
  const dataMin = fixedMin ?? Math.min(...values, 0)
  const range = Math.max(dataMax - dataMin, 1e-9)
  const magnitude = 10 ** Math.floor(Math.log10(range / 4))
  const step = Math.ceil(range / 4 / magnitude) * magnitude
  return {
    min: fixedMin ?? Math.floor(dataMin / step) * step,
    max: fixedMax ?? Math.ceil(dataMax / step) * step,
  }
}
function Legend({
  series,
  prior,
  hidden,
}: {
  series?: string | undefined
  prior?: string | undefined
  hidden: boolean
}) {
  if (hidden || !series) return null
  return (
    <ul className="chart-legend" aria-hidden="true">
      <li>
        <span className="chart-swatch" style={swatch(SERIES)} />
        {series}
      </li>
      {prior && (
        <li>
          <span className="chart-swatch" style={swatch(PRIOR)} />
          {prior}
        </li>
      )}
    </ul>
  )
}
function anchorAt(el: HTMLElement | null, fx: number, fy: number): TipAnchor | null {
  const svg = el?.querySelector("svg")
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const y = rect.top + fy * rect.height
  return { x: rect.left + fx * rect.width, top: y - 6, bottom: y + 6 }
}
function Tooltip({
  anchor,
  head,
  series,
  value,
  prior,
  priorValue,
}: {
  anchor: TipAnchor | null
  head: string
  series?: string | undefined
  value: string
  prior?: string | undefined
  priorValue: string | null
}) {
  return (
    <FloatTip anchor={anchor}>
      <span className="chart-tooltip-head">{head}</span>
      <span className="chart-tooltip-row">
        <span className="chart-swatch" style={swatch(SERIES)} />
        <span>{series ?? ru.value}</span>
        <strong>{value}</strong>
      </span>
      {priorValue !== null && (
        <span className="chart-tooltip-row">
          <span className="chart-swatch" style={swatch(PRIOR)} />
          <span>{prior}</span>
          <strong>{priorValue}</strong>
        </span>
      )}
    </FloatTip>
  )
}
function LineMarks({
  rows,
  x,
  values,
  px,
  py,
  base,
  top,
  bottom,
  span,
}: {
  rows: Row[]
  x: string
  values: (number | null)[]
  px: (i: number) => number
  py: (n: number) => number
  base: number
  top: number
  bottom: number
  span: number
}) {
  return (
    <>
      {values.map((n, i) => {
        if (n !== null || rows.length < 2) return null
        return (
          <g key={`gap-${String(rows[i]?.[x])}`}>
            <rect
              x={px(i) - span / 2}
              y={top}
              width={span}
              height={bottom - top}
              className="chart-gap"
            />
            <text x={px(i)} y={top + 14} textAnchor="middle" className="chart-gap-label">
              {ru.noDataMonth}
            </text>
          </g>
        )
      })}
      {values.map((_, i) => {
        if (values[i] === null || (i > 0 && values[i - 1] !== null)) return null
        let end = i
        while (end + 1 < values.length && values[end + 1] !== null) end += 1
        if (end === i) return null
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
      <path d={linePath(values, px, py)} className="chart-line" pathLength={1} />
    </>
  )
}
function BarMark({
  show,
  showLabel,
  x,
  y,
  base,
  width,
  active,
  label,
}: {
  show: boolean
  showLabel: boolean
  x: number
  y: number
  base: number
  width: number
  active: boolean
  label: string
}) {
  if (!show) return null
  const top = Math.min(y, base)
  return (
    <>
      <rect
        x={x - width / 2}
        y={top}
        width={width}
        height={Math.max(Math.abs(base - y), 1)}
        rx={2}
        className={`chart-bar${active ? " active" : ""}`}
      />
      {showLabel && (
        <text x={x} y={top - 6} textAnchor="middle" className="chart-value">
          {label}
        </text>
      )}
    </>
  )
}
function Crosshair({
  x,
  top,
  bottom,
  y,
  prior,
}: {
  x: number
  top: number
  bottom: number
  y: number | null
  prior: number | null
}) {
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={top} y2={bottom} className="chart-guide" />
      {prior !== null && <circle cx={x} cy={prior} r={4} className="chart-point prior" />}
      {y !== null && <circle cx={x} cy={y} r={4} className="chart-point" />}
    </g>
  )
}
function useWidth(container: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [container])
  return width
}
function XLabel({ show, x, y, text }: { show: boolean; x: number; y: number; text: string }) {
  if (!show) return null
  return (
    <text x={x} y={y} textAnchor="middle" className="chart-label">
      {text}
    </text>
  )
}
function labelEvery(i: number, count: number, width: number) {
  const step = Math.ceil(count / Math.max(2, Math.floor(width / 120)))
  return i === count - 1 || (i % step === 0 && count - 1 - i >= step * 0.6)
}
function describe(n: number | null, format: (n: number) => string) {
  return n === null ? ru.noValue : format(n)
}
function HitArea({
  x,
  y,
  width,
  height,
  label,
  onActive,
}: {
  x: number
  y: number
  width: number
  height: number
  label: string
  onActive: (on: boolean) => void
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG data points require SVG geometry.
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="transparent"
      className="chart-hit"
      role="button"
      tabIndex={0}
      aria-label={label}
      onFocus={() => onActive(true)}
      onBlur={() => onActive(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onActive(true)
        }
      }}
      onMouseEnter={() => onActive(true)}
      onMouseLeave={() => onActive(false)}
    />
  )
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
  compare = "",
  compareLabel,
  seriesLabel,
  legend = true,
  min: fixedMin,
  max: fixedMax,
}: ChartProps) {
  const tick = formatTick ?? formatValue
  const container = useRef<HTMLDivElement>(null)
  const chartWidth = useWidth(container)
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const width = chartWidth,
    height = 260,
    right = 18,
    top = 18,
    bottom = 28
  const values = rows.map((row) => numeric(row[y]))
  const measured = values.filter((n): n is number => n !== null)
  const prior = rows.map((row) => numeric(row[compare]))
  const priorMeasured = prior.filter((n): n is number => n !== null)
  if (!measured.length)
    return (
      <div className="chart-wrap" ref={container}>
        <EmptyState />
      </div>
    )
  const { min, max } = domain([...measured, ...priorMeasured], target, fixedMin, fixedMax)
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4)
  const left = Math.max(...ticks.map((n) => tick(n).length)) * 6.8 + 16
  const plotWidth = width - left - right
  const { px, slot, hitWidth, showValues } = columns(type, rows.length, left, plotWidth)
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const py = (n: number) =>
    height - bottom - ((clamp(n) - min) / (max - min)) * (height - top - bottom)
  const base = py(Math.max(min, 0))
  const barWidth = Math.max(4, Math.min(32, slot * 0.6))
  const priorPath = linePath(prior, px, py)
  const priorValue = valueAt(prior, active)
  const row = rows[active ?? -1]
  const value = valueAt(values, active)
  const hasPrior = priorMeasured.length > 1
  return (
    <div className="chart-wrap" ref={container}>
      <Legend hidden={!legend} series={seriesLabel} prior={hasPrior ? compareLabel : undefined} />
      {/* biome-ignore lint/a11y/useSemanticElements: SVG groups contain chart geometry. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={id}
        className="chart-svg"
      >
        <title id={id}>{label}</title>
        {ticks.map((n) => (
          <g key={n}>
            <line x1={left} x2={width - right} y1={py(n)} y2={py(n)} className="chart-grid" />
            <text x={left - 8} y={py(n) + 4} textAnchor="end" className="chart-label">
              {tick(n)}
            </text>
          </g>
        ))}
        <line
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
          className="chart-axis"
        />
        {type === "line" && (
          <LineMarks
            rows={rows}
            x={x}
            values={values}
            px={px}
            py={py}
            base={base}
            top={top}
            bottom={height - bottom}
            span={plotWidth / Math.max(rows.length - 1, 1)}
          />
        )}
        {hasPrior && <path d={priorPath} className="chart-prior" />}
        {rows.map((item, i) => {
          const n = values[i] ?? null
          return (
            <g key={JSON.stringify(item)}>
              {n !== null && (
                <BarMark
                  show={type === "bar"}
                  x={px(i)}
                  y={py(n)}
                  base={base}
                  width={barWidth}
                  active={active === i}
                  label={tick(n)}
                  showLabel={showValues}
                />
              )}
              <XLabel
                show={labelEvery(i, rows.length, width)}
                x={px(i)}
                y={height - 8}
                text={formatLabel(item[x])}
              />
            </g>
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
        {active !== null && value !== null && (
          <Crosshair
            x={px(active)}
            top={top}
            bottom={height - bottom}
            y={type === "line" ? py(value) : null}
            prior={priorValue === null ? null : py(priorValue)}
          />
        )}
        {rows.map((item, i) => (
          <HitArea
            key={`hit-${JSON.stringify(item)}`}
            x={px(i) - hitWidth / 2}
            y={top}
            width={hitWidth}
            height={height - top - bottom}
            label={`${formatLabel(item[x])}: ${describe(values[i] ?? null, formatValue)}`}
            onActive={(on) => setActive(on ? i : null)}
          />
        ))}
      </svg>
      {row && value !== null && (
        <Tooltip
          key={active}
          anchor={anchorAt(container.current, px(active ?? 0) / width, py(value) / height)}
          head={formatLabel(row[x])}
          series={seriesLabel}
          value={formatValue(value)}
          prior={compareLabel}
          priorValue={priorValue === null ? null : formatValue(priorValue)}
        />
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
