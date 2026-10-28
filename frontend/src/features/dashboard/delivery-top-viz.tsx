import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import type { Row } from "@/shared/format"
import { compact, month, number, numeric, percent } from "@/shared/format"
import { EmptyState } from "@/shared/ui/controls"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { Series } from "./dc-viz"
import { Legend } from "./dc-viz"
import "@/shared/styles/viz-palette.css"
import "@/shared/styles/viz-extra-dc.css"
import "@/shared/styles/fill-delivery-top.css"

const num = (value: unknown) => numeric(value) ?? 0

function useBox(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!active || !el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const w = Math.round(entry.contentRect.width)
      const h = Math.round(entry.contentRect.height)
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active])
  return [ref, size] as const
}

export function niceTicks(max: number, count = 4) {
  if (max <= 0) return { top: 1, ticks: [0, 1] }
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const top = Math.ceil(max / step) * step
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

function Plot({
  active,
  min,
  label,
  children,
}: {
  active: boolean
  min: number
  label: string
  children: (w: number, h: number) => ReactNode
}) {
  const [box, size] = useBox(active)
  return (
    <div className="dtop-plot" ref={box} style={{ minHeight: min }}>
      {size.w > 0 && size.h > 0 && (
        <VizTip className="dtop-abs">
          <svg
            className="chart-svg"
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            role="img"
            aria-label={label}
          >
            {children(size.w, size.h)}
          </svg>
        </VizTip>
      )}
    </div>
  )
}

function quantile(items: { x: number; y: number }[], total: number, q: number) {
  let acc = 0
  for (const item of items) {
    acc += item.y
    if (acc >= total * q) return item.x
  }
  return items.at(-1)?.x ?? 0
}

function YGrid({
  ticks,
  sy,
  left,
  right,
  format,
}: {
  ticks: number[]
  sy: (v: number) => number
  left: number
  right: number
  format: (n: number) => string
}) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={left} x2={right} y1={sy(t)} y2={sy(t)} />
          <text className="chart-axis dcx-ytick" x={left - 8} y={sy(t) + 4}>
            {format(t)}
          </text>
        </g>
      ))}
    </>
  )
}

export function FillHistogram({
  rows,
  x,
  y,
  tailLabel,
  unit = "дн.",
}: {
  rows: Row[]
  x: string
  y: string
  tailLabel: string
  unit?: string
}) {
  const items = rows.map((row) => ({ x: num(row[x]), y: num(row[y]) })).sort((a, b) => a.x - b.x)
  const total = items.reduce((sum, item) => sum + item.y, 0)
  if (!items.length || !total) return <EmptyState />
  const maxX = Math.max(...items.map((item) => item.x))
  const { top, ticks } = niceTicks(Math.max(...items.map((item) => item.y)))
  const median = quantile(items, total, 0.5)
  const p90 = quantile(items, total, 0.9)
  return (
    <Plot active min={240} label="Распределение срока доставки">
      {(W, H) => {
        const pad = { l: 48, r: 12, t: 24, b: 26 }
        const bw = (W - pad.l - pad.r) / (maxX + 1)
        const sx = (v: number) => pad.l + v * bw
        const sy = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b)
        const close = (p90 - median) * bw < 104
        const marks = [
          { v: median, label: `медиана ${median} ${unit}`, cls: "median", y: pad.t - 10 },
          {
            v: p90,
            label: `90 % за ${p90} ${unit}`,
            cls: "p90",
            y: close ? pad.t + 6 : pad.t - 10,
          },
        ]
        return (
          <>
            <YGrid ticks={ticks} sy={sy} left={pad.l} right={W - pad.r} format={(n) => number(n)} />
            {items.map((item) => (
              <rect
                key={item.x}
                className={`dcx-hist-bar${item.x <= median ? " in" : ""}${item.x === maxX ? " tail" : ""}`}
                x={sx(item.x) + 0.5}
                y={sy(item.y)}
                width={Math.max(bw - 1, 1)}
                height={Math.max(H - pad.b - sy(item.y), 0)}
                {...tipAttrs(item.x === maxX ? `${tailLabel} ${unit}` : `${item.x} ${unit}`, [
                  { label: "Заказов", value: number(item.y), color: "var(--viz-1)" },
                  { label: "Доля", value: percent(item.y / total) },
                ])}
              />
            ))}
            {Array.from({ length: Math.floor(maxX / 10) + 1 }, (_, i) => i * 10).map((t) => (
              <text key={t} className="chart-axis dcx-xtick" x={sx(t) + bw / 2} y={H - 8}>
                {t === maxX ? tailLabel : t}
              </text>
            ))}
            {marks.map((mark) => (
              <g key={mark.cls} className={`dcx-mark ${mark.cls}`}>
                <line
                  x1={sx(mark.v) + bw / 2}
                  x2={sx(mark.v) + bw / 2}
                  y1={mark.y - 12}
                  y2={H - pad.b}
                />
                <text x={sx(mark.v) + bw / 2 + 5} y={mark.y}>
                  {mark.label}
                </text>
              </g>
            ))}
          </>
        )
      }}
    </Plot>
  )
}

function StackColumn({
  row,
  x,
  cx,
  bw,
  base,
  sy,
  series,
  format,
  total,
  label,
}: {
  row: Row
  x: string
  cx: number
  bw: number
  base: number
  sy: (v: number) => number
  series: Series[]
  format: (n: number) => string
  total: number
  label: boolean
}) {
  let y = base
  return (
    <g
      className="dcx-stack-col"
      {...tipAttrs(month(row[x], true), [
        ...series.map((s) => ({ label: s.label, value: format(num(row[s.key])), color: s.color })),
        { label: "Итого", value: format(total) },
      ])}
    >
      <rect className="dtop-hit" x={cx - bw / 2 - 3} y={0} width={bw + 6} height={base} />
      {series.map((s) => {
        const h = sy(num(row[s.key]))
        y -= h
        return (
          <rect
            key={s.key}
            x={cx - bw / 2}
            y={y}
            width={bw}
            height={Math.max(h, 0)}
            style={{ fill: s.color }}
          />
        )
      })}
      {label && (
        <text className="chart-axis dcx-xtick" x={cx} y={base + 18}>
          {month(row[x])}
        </text>
      )}
    </g>
  )
}

export function FillStackedBars({
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
  const totals = rows.map((row) => series.reduce((sum, s) => sum + num(row[s.key]), 0))
  const { top, ticks } = niceTicks(Math.max(...totals, 1e-9))
  return (
    <>
      <Legend series={series} />
      <Plot active min={220} label="Этапы доставки по месяцам">
        {(W, H) => {
          const pad = { l: 40, r: 8, t: 10, b: 26 }
          const step = (W - pad.l - pad.r) / rows.length
          const bw = Math.min(step * 0.66, 36)
          const base = H - pad.b
          const sy = (v: number) => (v / top) * (H - pad.t - pad.b)
          const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 80))))
          return (
            <>
              <YGrid
                ticks={ticks}
                sy={(v) => base - sy(v)}
                left={pad.l}
                right={W - pad.r}
                format={formatTick}
              />
              {rows.map((row, i) => (
                <StackColumn
                  key={String(row[x])}
                  row={row}
                  x={x}
                  cx={pad.l + step * i + step / 2}
                  bw={bw}
                  base={base}
                  sy={sy}
                  series={series}
                  format={format}
                  total={totals[i] ?? 0}
                  label={i % every === 0}
                />
              ))}
            </>
          )
        }}
      </Plot>
    </>
  )
}

interface ScoreItem {
  bucket: string
  score: number
  reviews: number
  neg: number | null
}

const scoreTip = (item: ScoreItem, ok: boolean) =>
  tipAttrs(item.bucket, [
    {
      label: "Средняя оценка",
      value: number(item.score, 2),
      color: ok ? "var(--viz-1)" : "var(--viz-negative)",
    },
    { label: "Отзывов", value: number(item.reviews) },
    ...(item.neg === null ? [] : [{ label: "Оценки 1–2", value: percent(item.neg) }]),
  ])

function ScoreVertical({ items, W, H }: { items: ScoreItem[]; W: number; H: number }) {
  const pad = { l: 28, r: 4, t: 22, b: 40 }
  const step = (W - pad.l - pad.r) / items.length
  const bw = Math.min(step * 0.62, 56)
  const base = H - pad.b
  const sy = (v: number) => base - (v / 5) * (base - pad.t)
  return (
    <>
      <YGrid
        ticks={[0, 1, 2, 3, 4, 5]}
        sy={sy}
        left={pad.l}
        right={W - pad.r}
        format={(n) => String(n)}
      />
      {items.map((item, i) => {
        const cx = pad.l + step * i + step / 2
        return (
          <g
            key={item.bucket}
            className={`dtop-score${i === 0 ? " ok" : ""}`}
            {...scoreTip(item, i === 0)}
          >
            <rect className="dtop-hit" x={cx - step / 2} y={0} width={step} height={H} />
            <rect
              className="dtop-score-bar"
              x={cx - bw / 2}
              y={sy(item.score)}
              width={bw}
              height={Math.max(base - sy(item.score), 0)}
              rx={4}
            />
            <text className="dtop-score-value" x={cx} y={sy(item.score) - 6}>
              {number(item.score, 2)}
            </text>
            <text className="chart-axis dcx-xtick" x={cx} y={base + 17}>
              {item.bucket}
            </text>
            <text className="chart-axis dcx-xtick dtop-sub" x={cx} y={base + 32}>
              {`${compact(item.reviews)} отз.`}
            </text>
          </g>
        )
      })}
    </>
  )
}

function ScoreHorizontal({ items, W, H }: { items: ScoreItem[]; W: number; H: number }) {
  const pad = { l: 76, r: 40, t: 4, b: 4 }
  const step = (H - pad.t - pad.b) / items.length
  const bh = Math.min(step * 0.5, 26)
  const sx = (v: number) => (v / 5) * (W - pad.l - pad.r)
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((t) => (
        <line
          key={t}
          className="chart-grid"
          x1={pad.l + sx(t)}
          x2={pad.l + sx(t)}
          y1={pad.t}
          y2={H - pad.b}
        />
      ))}
      {items.map((item, i) => {
        const cy = pad.t + step * i + step / 2
        return (
          <g
            key={item.bucket}
            className={`dtop-score${i === 0 ? " ok" : ""}`}
            {...scoreTip(item, i === 0)}
          >
            <rect className="dtop-hit" x={0} y={cy - step / 2} width={W} height={step} />
            <text className="chart-axis dtop-hlabel" x={pad.l - 10} y={cy - 2}>
              {item.bucket}
            </text>
            <text className="chart-axis dtop-hlabel dtop-sub" x={pad.l - 10} y={cy + 12}>
              {`${compact(item.reviews)} отз.`}
            </text>
            <rect
              className="dtop-score-bar"
              x={pad.l}
              y={cy - bh / 2}
              width={Math.max(sx(item.score), 0)}
              height={bh}
              rx={4}
            />
            <text
              className="dtop-score-value dtop-hvalue"
              x={pad.l + sx(item.score) + 6}
              y={cy + 4}
            >
              {number(item.score, 2)}
            </text>
          </g>
        )
      })}
    </>
  )
}

export function ScoreColumns({ rows }: { rows: Row[] }) {
  const items: ScoreItem[] = [...rows]
    .sort((a, b) => num(a.ord) - num(b.ord))
    .map((row) => ({
      bucket: String(row.bucket),
      score: num(row.avg_score),
      reviews: num(row.reviews),
      neg: numeric(row.neg_share),
    }))
  if (!items.length) return <EmptyState />
  return (
    <Plot active min={220} label="Средняя оценка по сроку доставки">
      {(W, H) =>
        (W - 32) / items.length < 76 ? (
          <ScoreHorizontal items={items} W={W} H={H} />
        ) : (
          <ScoreVertical items={items} W={W} H={H} />
        )
      }
    </Plot>
  )
}
