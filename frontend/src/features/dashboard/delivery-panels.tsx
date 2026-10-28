import { useState } from "react"
import type { Row } from "@/shared/format"
import { month, number, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, Tip } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"
import { HBars } from "./bars"
import type { CardQuery } from "./card"
import { Card } from "./card"

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
        formatValue={field === "otd" ? (n) => percent(n) : (n) => `${number(n, 1)} дн.`}
        formatTick={field === "otd" ? (n) => percent(n, 0) : (n) => number(n, 0)}
        formatLabel={month}
        target={field === "otd" ? TARGET : undefined}
        targetLabel="цель 90 %"
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
      description={`Доля доставок вовремя по штатам, ${limit} худших · пунктир — цель 90 %`}
      query={query}
      index={index}
    >
      <HBars
        rows={rows}
        label={(row) => String(row.state)}
        value="otd"
        order="asc"
        limit={limit}
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
      description="Средняя оценка отзыва по сроку доставки, из 5"
      query={query}
      index={index}
      actions={<Tip text={ru.tips.lateness} />}
    >
      <HBars
        rows={rows}
        label={(row) => String(row.bucket)}
        value="avg_score"
        order="none"
        max={5}
        format={(n) => number(n, 2)}
      />
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
  return (
    <Card
      title={ru.sellerDelivery}
      accent="вовремя"
      description={ru.sellerDeliveryNote}
      query={query}
      index={index}
    >
      <DataTable
        rows={rows.map((row, i) => ({ ...row, rank: `Продавец #${i + 1}` }))}
        columns={[
          { key: "rank", label: ru.seller },
          { key: "state", label: ru.region },
          {
            key: "shipments",
            label: ru.shipments,
            numeric: true,
            format: (v) => number(Number(v)),
          },
          {
            key: "on_time",
            label: ru.onTime,
            numeric: true,
            format: (v) => (
              <span className="status">
                <i className={Number(v) >= TARGET ? "ok" : "bad"} />
                {percent(Number(v))}
              </span>
            ),
          },
        ]}
      />
    </Card>
  )
}
