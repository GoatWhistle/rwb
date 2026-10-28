import type { CSSProperties } from "react"
import { useState } from "react"
import type { Row } from "@/shared/format"
import { month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, EmptyState } from "@/shared/ui/controls"
import { HBars } from "./bars"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { ScoreColumns } from "./delivery-top-viz"
import { stateName } from "./states"
import "@/shared/styles/viz-extra-dc.css"

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
  return (
    <Card
      title={ru.geography}
      accent="опаздывает"
      description={`${limit} худших штатов по доле доставок вовремя, шкала 70–100 %`}
      query={query}
      index={index}
    >
      <HBars
        rows={rows}
        label={(row) => stateName(row.state)}
        sublabel={(row) => String(row.state)}
        value="otd"
        order="asc"
        limit={limit}
        min={0.7}
        max={1}
        target={TARGET}
        targetLabel="цель 90 %"
        format={(n) => percent(n)}
      />
    </Card>
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
                  <td>
                    {`Продавец #${rank}`}
                    <small>{String(row.seller ?? "")}</small>
                  </td>
                  <td>
                    {stateName(row.state)}
                    <small>{String(row.state ?? "")}</small>
                  </td>
                  <td className="num">{number(numeric(row.shipments) ?? 0)}</td>
                  <td className="num">
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
