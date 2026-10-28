import { useState } from "react"
import type { Row } from "@/shared/format"
import { number, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { Button, Panel, Tip } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"

export function DeliveryTrend({ rows }: { rows: Row[] }) {
  const [field, setField] = useState("otd")
  return (
    <Panel
      title={ru.deliveryTrend}
      description={ru.deliveryTrendNote}
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
        rows={rows}
        x="month"
        y={field}
        label={ru.deliveryTrend}
        formatValue={field === "otd" ? percent : number}
        formatLabel={(value) => String(value).split("-").reverse().join(".")}
      />
    </Panel>
  )
}
export function Geography({ rows }: { rows: Row[] }) {
  return (
    <Panel title={ru.geography} description={ru.geographyNote}>
      <DataTable
        rows={rows}
        columns={[
          { key: "state", label: ru.region },
          {
            key: "delivered",
            label: ru.delivered,
            numeric: true,
            format: (v) => number(Number(v)),
          },
          {
            key: "otd",
            label: ru.onTime,
            numeric: true,
            format: (v) => (v === null ? ru.noValue : percent(Number(v))),
          },
          { key: "median_days", label: ru.deliveryTime, numeric: true },
        ]}
      />
    </Panel>
  )
}
export function Lateness({ rows }: { rows: Row[] }) {
  return (
    <Panel
      title={ru.lateness}
      description={ru.latenessNote}
      actions={<Tip text={ru.tips.lateness} />}
    >
      <DataTable
        rows={rows}
        columns={[
          { key: "bucket", label: ru.delivery },
          { key: "reviews", label: ru.reviews, numeric: true, format: (v) => number(Number(v)) },
          { key: "avg_score", label: ru.avgScore, numeric: true },
          {
            key: "neg_share",
            label: ru.negative,
            numeric: true,
            format: (v) => percent(Number(v)),
          },
        ]}
      />
    </Panel>
  )
}
export function SellerDelivery({ rows }: { rows: Row[] }) {
  return (
    <Panel title={ru.sellerDelivery} description={ru.sellerDeliveryNote}>
      <DataTable
        rows={rows}
        columns={[
          { key: "seller", label: ru.seller },
          { key: "state", label: ru.region },
          {
            key: "shipments",
            label: ru.shipments,
            numeric: true,
            format: (v) => number(Number(v)),
          },
          { key: "on_time", label: ru.onTime, numeric: true, format: (v) => percent(Number(v)) },
        ]}
      />
    </Panel>
  )
}
