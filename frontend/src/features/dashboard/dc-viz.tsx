import type { CSSProperties } from "react"
import type { Row } from "@/shared/format"
import { month, number, numeric, percent } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"
import { stateName } from "./states"
import "@/shared/styles/viz-palette.css"
import "@/shared/styles/viz-extra-dc.css"

const num = (value: unknown) => numeric(value) ?? 0

export function Histogram({
  rows,
  x,
  y,
  tailLabel,
  unit = "дн.",
}: {
  rows: Row[]
  x: string
  y: string
  tailLabel?: string
  unit?: string
}) {
  const items = rows.map((row) => ({ x: num(row[x]), y: num(row[y]) })).sort((a, b) => a.x - b.x)
  const total = items.reduce((sum, item) => sum + item.y, 0)
  if (!items.length || !total) return <EmptyState />
  const W = 640
  const H = 220
  const pad = { l: 44, r: 12, t: 18, b: 26 }
  const maxX = Math.max(...items.map((item) => item.x))
  const maxY = Math.max(...items.map((item) => item.y))
  const bw = (W - pad.l - pad.r) / (maxX + 1)
  const sx = (v: number) => pad.l + v * bw
  const sy = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)
  const quantile = (q: number) => {
    let acc = 0
    for (const item of items) {
      acc += item.y
      if (acc >= total * q) return item.x
    }
    return maxX
  }
  const median = quantile(0.5)
  const p90 = quantile(0.9)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY)
  return (
    <div className="dcx-hist">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Гистограмма">
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} />
            <text className="chart-axis dcx-ytick" x={pad.l - 6} y={sy(t) + 4}>
              {number(t)}
            </text>
          </g>
        ))}
        {items.map((item) => (
          <rect
            key={item.x}
            className={`dcx-hist-bar${item.x <= median ? " in" : ""}${tailLabel && item.x === maxX ? " tail" : ""}`}
            x={sx(item.x) + 0.5}
            y={sy(item.y)}
            width={Math.max(bw - 1, 1)}
            height={Math.max(H - pad.b - sy(item.y), 0)}
          >
            <title>{`${item.x === maxX && tailLabel ? tailLabel : `${item.x} ${unit}`}: ${number(item.y)} (${percent(item.y / total)})`}</title>
          </rect>
        ))}
        {Array.from({ length: Math.floor(maxX / 10) + 1 }, (_, i) => i * 10).map((t) => (
          <text key={t} className="chart-axis dcx-xtick" x={sx(t) + bw / 2} y={H - 8}>
            {t === maxX && tailLabel ? tailLabel : t}
          </text>
        ))}
        {[
          { v: median, label: `медиана ${median} ${unit}`, cls: "median" },
          { v: p90, label: `90 % за ${p90} ${unit}`, cls: "p90" },
        ].map((mark) => (
          <g key={mark.cls} className={`dcx-mark ${mark.cls}`}>
            <line x1={sx(mark.v) + bw / 2} x2={sx(mark.v) + bw / 2} y1={pad.t - 6} y2={H - pad.b} />
            <text x={sx(mark.v) + bw / 2 + 4} y={pad.t}>
              {mark.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export interface Series {
  key: string
  label: string
  color: string
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="dcx-legend">
      {series.map((s) => (
        <li key={s.key}>
          <i style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

export function StackedBars({
  rows,
  x,
  series,
  format,
  formatTick = (n) => number(n),
}: {
  rows: Row[]
  x: string
  series: Series[]
  format: (n: number) => string
  formatTick?: (n: number) => string
}) {
  if (!rows.length) return <EmptyState />
  const W = 640
  const H = 220
  const pad = { l: 44, r: 8, t: 10, b: 26 }
  const totals = rows.map((row) => series.reduce((sum, s) => sum + num(row[s.key]), 0))
  const maxY = Math.max(...totals, 1e-9) * 1.08
  const step = (W - pad.l - pad.r) / rows.length
  const bw = Math.min(step * 0.72, 34)
  const sy = (v: number) => (v / maxY) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY)
  const every = Math.ceil(rows.length / 10)
  return (
    <div className="dcx-stack">
      <Legend series={series} />
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Столбцы с накоплением"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="chart-grid"
              x1={pad.l}
              x2={W - pad.r}
              y1={H - pad.b - sy(t)}
              y2={H - pad.b - sy(t)}
            />
            <text className="chart-axis dcx-ytick" x={pad.l - 6} y={H - pad.b - sy(t) + 4}>
              {formatTick(t)}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          let base = H - pad.b
          const cx = pad.l + step * i + step / 2
          return (
            <g key={String(row[x])} className="dcx-stack-col">
              {series.map((s) => {
                const h = sy(num(row[s.key]))
                base -= h
                return (
                  <rect
                    key={s.key}
                    x={cx - bw / 2}
                    y={base}
                    width={bw}
                    height={Math.max(h, 0)}
                    style={{ fill: s.color }}
                  >
                    <title>{`${month(row[x], true)} · ${s.label}: ${format(num(row[s.key]))}`}</title>
                  </rect>
                )
              })}
              <title>{`${month(row[x], true)}: ${format(totals[i] ?? 0)}`}</title>
              {i % every === 0 && (
                <text className="chart-axis dcx-xtick" x={cx} y={H - 8}>
                  {month(row[x])}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const TILES: [string, number, number][] = [
  ["RR", 2, 0],
  ["AP", 4, 0],
  ["AM", 1, 1],
  ["PA", 3, 1],
  ["MA", 4, 1],
  ["CE", 5, 1],
  ["RN", 6, 1],
  ["AC", 0, 2],
  ["RO", 1, 2],
  ["MT", 2, 2],
  ["TO", 3, 2],
  ["PI", 4, 2],
  ["PE", 5, 2],
  ["PB", 6, 2],
  ["MS", 2, 3],
  ["GO", 3, 3],
  ["DF", 4, 3],
  ["BA", 5, 3],
  ["AL", 6, 3],
  ["PR", 2, 4],
  ["SP", 3, 4],
  ["MG", 4, 4],
  ["ES", 5, 4],
  ["SE", 6, 4],
  ["SC", 2, 5],
  ["RJ", 4, 5],
  ["RS", 2, 6],
]

function Tile({
  code,
  col,
  row,
  data,
  value,
  scale,
  diverging,
  format,
  extra,
}: {
  code: string
  col: number
  row: number
  data: Row | undefined
  value: string
  scale: (n: number) => number
  diverging: boolean
  format: (n: number) => string
  extra?: ((row: Row) => string) | undefined
}) {
  const n = data ? numeric(data[value]) : null
  const at = n === null ? 0 : scale(n)
  const dark = n !== null && (diverging ? at < 0.22 || at > 0.78 : at > 0.55)
  const detail = data && extra ? ` · ${extra(data)}` : ""
  return (
    <div
      className={`dcx-tile${n === null ? " empty" : ""}${dark ? " dark" : ""}`}
      style={{ gridColumn: col + 1, gridRow: row + 1, "--t": at } as CSSProperties}
      title={`${stateName(code)} (${code}): ${n === null ? "нет данных" : format(n)}${detail}`}
    >
      <b>{code}</b>
      <span>{n === null ? "—" : format(n)}</span>
    </div>
  )
}

export function DeliveryTileMap({
  rows,
  value,
  format,
  min,
  max,
  diverging = false,
  log = false,
  extra,
}: {
  rows: Row[]
  value: string
  format: (n: number) => string
  min?: number
  max?: number
  diverging?: boolean
  log?: boolean
  extra?: (row: Row) => string
}) {
  const byState = new Map(rows.map((row) => [String(row.state), row]))
  const values = rows.map((row) => numeric(row[value])).filter((n): n is number => n !== null)
  if (!values.length) return <EmptyState />
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const t = (n: number) => {
    const a = log ? Math.log10(Math.max(n, 1)) : n
    const b = log ? Math.log10(Math.max(lo, 1)) : lo
    const c = log ? Math.log10(Math.max(hi, 1)) : hi
    return Math.min(1, Math.max(0, (a - b) / Math.max(c - b, 1e-9)))
  }
  return (
    <div className={`dcx-tiles${diverging ? " diverging" : ""}`}>
      <div className="dcx-tile-grid">
        {TILES.map(([code, col, row]) => (
          <Tile
            key={code}
            code={code}
            col={col}
            row={row}
            data={byState.get(code)}
            value={value}
            scale={t}
            diverging={diverging}
            format={format}
            extra={extra}
          />
        ))}
      </div>
      <div className="dcx-scale">
        <span>{format(lo)}</span>
        <i />
        <span>{format(hi)}</span>
      </div>
    </div>
  )
}

export function ScoreBars({ rows, series }: { rows: Row[]; series: Series[] }) {
  const totals = series.map((s) => rows.reduce((sum, row) => sum + num(row[s.key]), 0))
  if (!rows.length || !totals.some(Boolean)) return <EmptyState />
  const shares = [...rows]
    .sort((a, b) => num(b.score) - num(a.score))
    .map((row) => ({
      score: num(row.score),
      values: series.map((s, i) => num(row[s.key]) / (totals[i] || 1)),
    }))
  const max = Math.max(...shares.flatMap((item) => item.values), 1e-9)
  return (
    <div className="dcx-score">
      <Legend series={series} />
      {shares.map((item) => (
        <div className="dcx-score-row" key={item.score}>
          <span className="dcx-stars" role="img" aria-label={`Оценка ${item.score}`}>
            {"★".repeat(item.score)}
            <em>{"★".repeat(5 - item.score)}</em>
          </span>
          <div className="dcx-score-bars">
            {series.map((s, i) => (
              <div key={s.key} className="dcx-score-bar">
                <span
                  style={{
                    width: `${((item.values[i] ?? 0) / max) * 100}%`,
                    background: s.color,
                  }}
                />
                <strong>{percent(item.values[i] ?? 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
