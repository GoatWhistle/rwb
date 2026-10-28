import type { CSSProperties } from "react"
import { useState } from "react"
import type { Row } from "@/shared/format"
import { month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, EmptyState } from "@/shared/ui/controls"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { ScoreColumns } from "./delivery-top-viz"
import { stateName } from "./states"
import "@/shared/styles/viz-extra-dc.css"
import "@/shared/styles/viz-palette.css"
import "@/shared/styles/fill-heat-geo.css"
import "@/shared/styles/mobile-charts-b.css"

const TARGET = 0.9

export function DeliveryTrend({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const [field, setField] = useState("otd")
  return (
    <Card
      title={ru.deliveryTrend}
      accent="точность"
      description={ru.deliveryTrendNote}
      query={query}
      index={index}
      className="mcb-trend"
      actions={
        <div className="segmented">
          <Button className={field === "otd" ? "selected" : ""} onClick={() => setField("otd")}>
            {ru.onTime}
          </Button>
          <Button
            className={field === "median_days" ? "selected" : ""}
            onClick={() => setField("median_days")}
          >
            {ru.deliveryTime}
          </Button>
        </div>
      }
    >
      <Chart
        key={field}
        rows={rows}
        x="month"
        y={field}
        label={ru.deliveryTrend}
        seriesLabel={field === "otd" ? "Вовремя" : "Срок доставки"}
        legend={false}
        formatValue={field === "otd" ? (n) => percent(n) : (n) => `${number(n, 1)} дн.`}
        formatTick={field === "otd" ? (n) => percent(n, 0) : (n) => number(n, 0)}
        formatLabel={month}
        target={field === "otd" ? TARGET : undefined}
        targetLabel="цель 90 %"
        min={field === "otd" ? 0.8 : undefined}
        max={field === "otd" ? 1 : undefined}
      />
    </Card>
  )
}
export function Geography({
  rows,
  query,
  index,
  limit = 10,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
  limit?: number
}) {
  const items = rows
    .map((row) => ({ row, n: numeric(row.otd) }))
    .filter((item): item is { row: Row; n: number } => item.n !== null)
    .sort((a, b) => a.n - b.n)
    .slice(0, limit)
  return (
    <Card
      title={ru.geography}
      accent="опаздывает"
      description={`${items.length || limit} штатов с наименьшей долей доставок вовремя`}
      query={query}
      index={index}
    >
      {items.length ? <GeoBars items={items} /> : <EmptyState />}
    </Card>
  )
}

const GEO_MIN = 0.7
const GEO_TICKS = [0.7, 0.8, 0.9, 1]
const geoAt = (n: number) => Math.min(100, Math.max(0, ((n - GEO_MIN) / (1 - GEO_MIN)) * 100))

function geoTip(row: Row, n: number) {
  const days = numeric(row.median_days)
  const promised = numeric(row.median_promised)
  return tipAttrs(`${stateName(row.state)}, ${String(row.state)}`, [
    {
      label: "Вовремя",
      value: percent(n),
      color: n < TARGET ? "var(--viz-negative)" : "var(--viz-1)",
    },
    { label: "Доставлено", value: number(numeric(row.delivered) ?? 0) },
    ...(days === null ? [] : [{ label: "Медианный срок", value: `${number(days, 1)} дн.` }]),
    ...(promised === null ? [] : [{ label: "Обещано", value: `${number(promised, 0)} дн.` }]),
  ])
}

function GeoBars({ items }: { items: { row: Row; n: number }[] }) {
  return (
    <VizTip className="hg-geo-host">
      <div
        className="hg-geo"
        style={
          {
            "--rows": items.length,
            "--target": `${geoAt(TARGET)}%`,
          } as CSSProperties
        }
      >
        <div className="hg-geo-grid" aria-hidden="true">
          {GEO_TICKS.map((t) => (
            <i
              key={t}
              className={t === TARGET ? "is-target" : ""}
              style={{ left: `${geoAt(t)}%` }}
            />
          ))}
        </div>
        {items.map(({ row, n }, i) => (
          <div
            key={String(row.state)}
            className={`hg-geo-row${n < TARGET ? " below" : ""}`}
            style={
              { "--i": i, "--w": `${Math.max(geoAt(n), 1)}%`, gridRow: i + 1 } as CSSProperties
            }
            {...geoTip(row, n)}
          >
            <span className="hg-geo-name">
              <span>{stateName(row.state)}</span>
              <small>{String(row.state)}</small>
            </span>
            <span className="hg-geo-track">
              <span className="hg-geo-fill" />
            </span>
            <strong className="hg-geo-value">{percent(n)}</strong>
          </div>
        ))}
        <div className="hg-geo-axis" aria-hidden="true">
          {GEO_TICKS.map((t) => (
            <span
              key={t}
              className={t === TARGET ? "is-target" : ""}
              style={{ left: `${geoAt(t)}%` }}
            >
              {t === TARGET ? `цель ${percent(t, 0)}` : percent(t, 0)}
            </span>
          ))}
        </div>
      </div>
    </VizTip>
  )
}
export function Lateness({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  return (
    <Card
      title={ru.lateness}
      accent="оценку"
      description="Средняя оценка отзыва по сроку вручения относительно обещанного"
      hint={ru.tips.lateness}
      query={query}
      index={index}
    >
      <ScoreColumns rows={rows} />
    </Card>
  )
}
export function SellerDelivery({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const [all, setAll] = useState(false)
  const sorted = rows
    .map((row, i) => ({ row, rank: i + 1, value: numeric(row.on_time) ?? 0 }))
    .sort((a, b) => a.value - b.value)
  const shown = all ? sorted : sorted.slice(0, 10)
  return (
    <Card
      title={ru.sellerDelivery}
      accent="вовремя"
      description={ru.sellerDeliveryNote}
      query={query}
      index={index}
      className="fdb-sellers"
      actions={<CardTools rows={rows} filename="seller-on-time" png={false} />}
    >
      {rows.length ? (
        <div className="dcx-sellers">
          <table>
            <thead>
              <tr>
                <th>{ru.seller}</th>
                <th>{ru.region}</th>
                <th className="num">{ru.shipments}</th>
                <th className="num">{ru.onTime}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ row, rank, value }) => (
                <tr key={`${String(row.seller)}-${rank}`}>
                  <td className="mcb-seller">
                    {`Продавец #${rank}`}
                    <small>{String(row.seller ?? "")}</small>
                  </td>
                  <td className="mcb-region">
                    {stateName(row.state)}
                    <small>{String(row.state ?? "")}</small>
                  </td>
                  <td className="num mcb-ship" data-label={ru.shipments}>
                    {number(numeric(row.shipments) ?? 0)}
                  </td>
                  <td className="num mcb-ot">
                    <span
                      className={`dcx-bullet${value >= TARGET ? " ok" : ""}`}
                      style={
                        {
                          "--v": `${value * 100}%`,
                          "--target": `${TARGET * 100}%`,
                        } as CSSProperties
                      }
                    >
                      <i />
                    </span>
                    <strong>{percent(value)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length > 10 && (
            <Button className="dcx-more" onClick={() => setAll(!all)}>
              {all ? "Свернуть" : `Показать все (${sorted.length})`}
            </Button>
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </Card>
  )
}
