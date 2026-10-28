import { useLayoutEffect, useRef, useState } from "react"
import type { Row } from "@/shared/format"
import { number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { DeliveryTileMap, Histogram, ScoreBars, StackedBars } from "./dc-viz"
import { stateName } from "./states"
import "@/shared/styles/fill-customers.css"

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
  return (
    <Card
      title={t.scoresTitle}
      accent="оценки"
      description={t.scoresNote}
      hint={t.scoresHint}
      query={query}
      index={index}
      actions={tools(rows, "review-scores", false)}
    >
      <ScoreBars
        rows={rows}
        series={[
          { key: "on_time", label: t.onTime, color: "var(--viz-1)" },
          { key: "late", label: t.late, color: "var(--viz-negative)" },
        ]}
      />
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
      className="fc-opc-card"
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
      className="fc-map-card"
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

const ROW_MIN = 40
const HEAD = 36

function useFitRows(total: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(10)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setFit(Math.max(2, Math.floor((el.clientHeight - HEAD) / ROW_MIN)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, Math.min(fit, total)] as const
}

interface StateLine {
  key: string
  name: string
  code?: string
  customers: number
  orders: number
  repeat: number
}

function stateLines(rows: Row[], fit: number): StateLine[] {
  const lines = rows.map((row) => ({
    key: String(row.state),
    name: stateName(row.state),
    code: String(row.state),
    customers: numeric(row.customers) ?? 0,
    orders: numeric(row.orders) ?? 0,
    repeat: numeric(row.repeat_share) ?? 0,
  }))
  if (fit >= lines.length) return lines
  const head = lines.slice(0, fit - 1)
  const rest = lines.slice(fit - 1)
  const orders = rest.reduce((sum, line) => sum + line.orders, 0)
  return [
    ...head,
    {
      key: "rest",
      name: `Остальные ${rest.length}`,
      customers: rest.reduce((sum, line) => sum + line.customers, 0),
      orders,
      repeat: orders ? rest.reduce((sum, line) => sum + line.repeat * line.orders, 0) / orders : 0,
    },
  ]
}

export function CustomerStates({ rows, query, index }: Props) {
  const total = rows.reduce((sum, row) => sum + (numeric(row.customers) ?? 0), 0)
  const [ref, fit] = useFitRows(rows.length)
  const lines = stateLines(rows, fit)
  const max = Math.max(...lines.filter((line) => line.code).map((line) => line.customers), 1)
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
      <div ref={ref} className="fc-states">
        {rows.length > 0 && (
          <VizTip>
            <table>
              <caption className="sr-only">{t.statesTitle}</caption>
              <colgroup>
                <col className="fc-name" />
                <col />
                <col className="fc-share" />
                <col className="fc-repeat" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{ru.region}</th>
                  <th scope="col">{t.customers}</th>
                  <th scope="col">{t.share}</th>
                  <th scope="col">{t.repeatShare}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.key}
                    className={line.code ? "" : "fc-rest"}
                    {...tipAttrs(line.code ? `${line.name}, ${line.code}` : `${line.name} штатов`, [
                      { label: t.customers, value: number(line.customers) },
                      { label: t.orders, value: number(line.orders) },
                      { label: "Доля повторных", value: percent(line.repeat) },
                    ])}
                  >
                    <td>{line.code ? line.name : `${line.name} штатов`}</td>
                    <td>
                      <span className="fc-count">
                        <span className="fc-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.min((line.customers / max) * 100, 100)}%`,
                            }}
                          />
                        </span>
                        {number(line.customers)}
                      </span>
                    </td>
                    <td>{percent(total ? line.customers / total : 0)}</td>
                    <td>{percent(line.repeat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </VizTip>
        )}
      </div>
    </Card>
  )
}
