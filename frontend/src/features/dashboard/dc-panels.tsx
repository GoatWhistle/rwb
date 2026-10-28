import type { Row } from "@/shared/format"
import { number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { DataTable } from "@/shared/ui/data-table"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { DeliveryTileMap, Histogram, ScoreBars, StackedBars } from "./dc-viz"
import { stateName } from "./states"
import "@/shared/styles/fill-delivery-bottom.css"

const t = ru.dc
const days = (n: number) => `${number(n, 1)} дн.`
const tools = (rows: Row[], filename: string, png = true) => (
  <CardTools rows={rows} filename={filename} png={png} />
)

interface Props {
  rows: Row[]
  query?: CardQuery
  index?: number
}

export function DeliveryDays({ rows, query, index }: Props) {
  return (
    <Card
      title={t.daysTitle}
      accent="срок"
      description={t.daysNote}
      hint={t.daysHint}
      query={query}
      index={index}
      actions={tools(rows, "delivery-days")}
    >
      <Histogram rows={rows} x="days" y="orders" tailLabel="60+" />
    </Card>
  )
}

export function DeliveryStages({ rows, query, index }: Props) {
  return (
    <Card
      title={t.stagesTitle}
      accent="этапы"
      description={t.stagesNote}
      hint={t.stagesHint}
      query={query}
      index={index}
      actions={tools(rows, "delivery-stages")}
    >
      <StackedBars
        rows={rows}
        x="month"
        format={days}
        formatTick={(n) => number(n, 0)}
        series={[
          { key: "approve", label: t.approve, color: "var(--viz-9)" },
          { key: "seller", label: t.seller, color: "var(--viz-3)" },
          { key: "carrier", label: t.carrier, color: "var(--viz-1)" },
        ]}
      />
    </Card>
  )
}

export function OnTimeMap({ rows, query, index }: Props) {
  return (
    <Card
      title={t.mapTitle}
      accent="карта"
      description={t.mapNote}
      hint={t.mapHint}
      query={query}
      index={index}
      actions={tools(rows, "on-time-map", false)}
    >
      <DeliveryTileMap
        rows={rows}
        value="otd"
        min={0.75}
        max={1}
        diverging
        format={(n) => percent(n, 0)}
        extra={(row) =>
          `${number(numeric(row.delivered) ?? 0)} доставок, медиана ${days(numeric(row.median_days) ?? 0)}`
        }
      />
    </Card>
  )
}

export function ReviewScores({ rows, query, index }: Props) {
  const total = (key: string) => rows.reduce((sum, row) => sum + (numeric(row[key]) ?? 0), 0)
  const onTime = total("on_time")
  const late = total("late")
  return (
    <Card
      title={t.scoresTitle}
      accent="оценки"
      description={t.scoresNote}
      hint={t.scoresHint}
      query={query}
      index={index}
      className="fdb-scores"
      actions={tools(rows, "review-scores", false)}
    >
      <ScoreBars
        rows={rows}
        series={[
          { key: "on_time", label: t.onTime, color: "var(--viz-1)" },
          { key: "late", label: t.late, color: "var(--viz-negative)" },
        ]}
      />
      {onTime + late > 0 && (
        <p className="footnote">
          {`Доли от ${number(onTime)} отзывов о заказах вовремя и ${number(late)} — с опозданием`}
        </p>
      )}
    </Card>
  )
}

export function CustomersMonthly({ rows, query, index }: Props) {
  return (
    <Card
      title={t.monthlyTitle}
      accent="новые"
      description={t.monthlyNote}
      hint={t.monthlyHint}
      query={query}
      index={index}
      actions={tools(rows, "customers-monthly")}
    >
      <StackedBars
        rows={rows}
        x="month"
        format={(n) => number(n)}
        series={[
          {
            key: "new_customers",
            label: t.newCustomers,
            color: "var(--viz-4)",
          },
          { key: "returning", label: t.returning, color: "var(--viz-12)" },
        ]}
      />
    </Card>
  )
}

export function OrdersPerCustomer({ rows, query, index }: Props) {
  const total = rows.reduce((sum, row) => sum + (numeric(row.customers) ?? 0), 0)
  const repeat = rows.filter((row) => row.bucket !== "1")
  const repeatTotal = repeat.reduce((sum, row) => sum + (numeric(row.customers) ?? 0), 0)
  const one = total - repeatTotal
  return (
    <Card
      title={t.perCustomerTitle}
      accent="заказов"
      description={t.perCustomerNote}
      hint={t.perCustomerHint}
      query={query}
      index={index}
      actions={tools(rows, "orders-per-customer", false)}
    >
      <div className="dcx-opc">
        <div className="dcx-opc-split" aria-hidden="true">
          <span style={{ flexGrow: one || 1 }} />
          <span style={{ flexGrow: repeatTotal }} />
        </div>
        <dl className="dcx-opc-list">
          {rows.map((row) => {
            const n = numeric(row.customers) ?? 0
            const max = Math.max(...repeat.map((r) => numeric(r.customers) ?? 0), 1)
            const single = row.bucket === "1"
            return (
              <div key={String(row.bucket)} className={single ? "single" : ""}>
                <dt>{`${String(row.bucket)} ${row.bucket === "1" ? "заказ" : "заказа"}`}</dt>
                <dd>
                  <span className="dcx-opc-track">
                    <span
                      style={{
                        width: single ? "100%" : `${Math.max((n / max) * 100, 2)}%`,
                      }}
                    />
                  </span>
                  <strong>{number(n)}</strong>
                  <small>{percent(total ? n / total : 0, 2)}</small>
                </dd>
              </div>
            )
          })}
        </dl>
        <p className="footnote">{t.perCustomerFoot}</p>
      </div>
    </Card>
  )
}

export function CustomerMap({ rows, query, index }: Props) {
  return (
    <Card
      title={t.customerMapTitle}
      accent="живут"
      description={t.customerMapNote}
      hint={t.customerMapHint}
      query={query}
      index={index}
      actions={tools(rows, "customers-map", false)}
    >
      <DeliveryTileMap
        rows={rows}
        value="customers"
        log
        format={(n) => (n >= 1000 ? `${number(n / 1000, n >= 10000 ? 0 : 1)} тыс.` : number(n))}
        extra={(row) => `${number(numeric(row.orders) ?? 0)} заказов`}
      />
    </Card>
  )
}

export function CustomerStates({ rows, query, index }: Props) {
  const total = rows.reduce((sum, row) => sum + (numeric(row.customers) ?? 0), 0)
  return (
    <Card
      title={t.statesTitle}
      accent="штатам"
      description={t.statesNote}
      hint={t.statesHint}
      query={query}
      index={index}
      actions={tools(rows, "customer-states", false)}
    >
      <DataTable
        rows={rows.slice(0, 8).map((row) => ({
          ...row,
          name: stateName(row.state),
          share: total ? (numeric(row.customers) ?? 0) / total : 0,
        }))}
        columns={[
          { key: "name", label: ru.region },
          {
            key: "customers",
            label: t.customers,
            numeric: true,
            format: (v) => number(Number(v)),
          },
          {
            key: "share",
            label: t.share,
            numeric: true,
            format: (v) => percent(Number(v)),
          },
          {
            key: "orders",
            label: t.orders,
            numeric: true,
            format: (v) => number(Number(v)),
          },
          {
            key: "repeat_share",
            label: t.repeatShare,
            numeric: true,
            format: (v) => percent(Number(v)),
          },
        ]}
      />
    </Card>
  )
}
