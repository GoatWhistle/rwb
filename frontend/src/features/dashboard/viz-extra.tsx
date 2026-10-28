import type { Row } from "@/shared/format"
import { compact, money, month, number, numeric, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { tipAttrs, VizTip } from "@/shared/ui/viz-tip"
import type { CardQuery } from "./card"
import { Card, CardTools } from "./card"
import { stateName } from "./states"
import "@/shared/styles/viz-extra-os.css"

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const ordersWord = (n: number) => {
  const a = Math.abs(Math.round(n)) % 100
  const b = a % 10
  if (a > 10 && a < 20) return "заказов"
  if (b === 1) return "заказ"
  if (b >= 2 && b <= 4) return "заказа"
  return "заказов"
}
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const shade = (t: number) =>
  `color-mix(in srgb, var(--viz-gradient-100) ${Math.round(8 + t * 92)}%, var(--viz-gradient-0))`

export function Heatmap({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const cell = new Map(rows.map((r) => [`${String(r.dow)}-${String(r.hour)}`, r]))
  const max = Math.max(1, ...rows.map((r) => numeric(r.orders) ?? 0))
  const peak = rows.reduce<Row | null>(
    (best, r) => ((numeric(r.orders) ?? 0) > (numeric(best?.orders) ?? -1) ? r : best),
    null,
  )
  const info = peak
  return (
    <Card
      title="Когда покупают"
      accent="покупают"
      description="Заказы по дню недели и часу оформления"
      hint={ru.osHints.heatmap}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="heatmap.csv" png={false} />}
    >
      <VizTip>
        <div className="vx-heat">
          <span />
          {HOURS.map((h) => (
            <span key={h} className="vx-heat-hour">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
          {DAYS.map((day, d) => (
            <div key={day} className="vx-heat-row">
              <span className="vx-heat-day">{day}</span>
              {HOURS.map((h) => {
                const r = cell.get(`${d + 1}-${h}`)
                const n = numeric(r?.orders) ?? 0
                return (
                  <span
                    key={h}
                    className="vx-heat-cell"
                    style={{ background: shade(n / max) }}
                    {...tipAttrs(`${day}, ${h}:00`, [
                      { label: "Заказов", value: number(n), color: shade(n / max) },
                      { label: "Выручка", value: money(numeric(r?.revenue) ?? 0) },
                    ])}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </VizTip>
      {info && (
        <p className="vx-caption vx-peak">
          <span>Пик</span>
          <b>
            {DAYS[(numeric(info.dow) ?? 1) - 1]}, {String(info.hour)}:00
          </b>
          <em>
            {number(numeric(info.orders) ?? 0)} {ordersWord(numeric(info.orders) ?? 0)}
          </em>
          <em>{money(numeric(info.revenue) ?? 0)}</em>
        </p>
      )}
    </Card>
  )
}

const TILES: [string, number, number][] = [
  ["RR", 0, 2],
  ["AP", 0, 4],
  ["AM", 1, 1],
  ["PA", 1, 3],
  ["MA", 1, 4],
  ["CE", 1, 5],
  ["RN", 1, 6],
  ["AC", 2, 0],
  ["RO", 2, 1],
  ["TO", 2, 3],
  ["PI", 2, 4],
  ["PE", 2, 5],
  ["PB", 2, 6],
  ["MT", 3, 2],
  ["GO", 3, 3],
  ["BA", 3, 4],
  ["SE", 3, 5],
  ["AL", 3, 6],
  ["MS", 4, 2],
  ["DF", 4, 3],
  ["MG", 4, 4],
  ["ES", 4, 5],
  ["PR", 5, 2],
  ["SP", 5, 3],
  ["RJ", 5, 4],
  ["SC", 6, 2],
  ["RS", 7, 2],
]

export function TileMap({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const byState = new Map(rows.map((r) => [String(r.state), numeric(r.revenue) ?? 0]))
  const max = Math.max(1, ...byState.values())
  const total = [...byState.values()].reduce((a, b) => a + b, 0)
  return (
    <Card
      title="Выручка по штатам"
      accent="штатам"
      description="Карта Бразилии: интенсивность — доля выручки"
      hint={ru.osHints.tileMap}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="states-revenue.csv" png={false} />}
    >
      <VizTip>
        <div className="vx-tiles" role="img" aria-label="Выручка по штатам Бразилии">
          {TILES.map(([code, row, col]) => {
            const v = byState.get(code)
            const t = v === undefined ? 0 : Math.sqrt(v / max)
            return (
              <span
                key={code}
                className={`vx-tile${t > 0.55 ? " dark" : ""}${v === undefined ? " empty" : ""}`}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  background: shade(t),
                }}
                {...tipAttrs(`${stateName(code)}, ${code}`, [
                  { label: "Выручка", value: money(v ?? 0), color: shade(t) },
                  { label: "Доля", value: percent(total ? (v ?? 0) / total : 0) },
                ])}
              >
                <b>{code}</b>
                <small>{v === undefined ? "—" : compact(v)}</small>
              </span>
            )
          })}
        </div>
      </VizTip>
      <div className="vx-scale">
        <span>0</span>
        <i />
        <span>{compact(max)} R$</span>
      </div>
    </Card>
  )
}

const PAY_KEYS = ["credit_card", "boleto", "voucher", "debit_card"] as const
const PAY_LABEL: Record<string, string> = {
  credit_card: "Карта",
  boleto: "Boleto",
  voucher: "Ваучер",
  debit_card: "Дебет",
}

export function PaymentsMix({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const totals = rows.map((r) => PAY_KEYS.reduce((s, k) => s + (numeric(r[k]) ?? 0), 0))
  const max = Math.max(1, ...totals)
  const sums = PAY_KEYS.map((k) => rows.reduce((s, r) => s + (numeric(r[k]) ?? 0), 0))
  const all = sums.reduce((a, b) => a + b, 0)
  return (
    <Card
      title="Как платят"
      accent="платят"
      description="Платежи по типу оплаты и месяцу, R$"
      hint={ru.osHints.payments}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="payments-monthly.csv" png={false} />}
    >
      <ul className="vx-legend">
        {PAY_KEYS.map((k, i) => (
          <li key={k}>
            <i className={`vx-c${i}`} />
            {PAY_LABEL[k]} <b>{percent(all ? (sums[i] ?? 0) / all : 0)}</b>
          </li>
        ))}
      </ul>
      <VizTip>
        <div className="vx-stack">
          {rows.map((r, i) => (
            <div
              key={String(r.month)}
              className="vx-stack-col"
              {...tipAttrs(month(r.month, true), [
                ...PAY_KEYS.map((k, j) => ({
                  label: PAY_LABEL[k] ?? k,
                  value: money(numeric(r[k]) ?? 0),
                  swatch: `vx-c${j}`,
                })),
                { label: "Итого", value: money(totals[i] ?? 0) },
              ])}
            >
              <div
                className="vx-stack-bar"
                style={{ height: `${((totals[i] ?? 0) / max) * 100}%` }}
              >
                {PAY_KEYS.map((k, j) => (
                  <span key={k} className={`vx-c${j}`} style={{ flexGrow: numeric(r[k]) ?? 0 }} />
                ))}
              </div>
              <small>
                {String(r.month).slice(5, 7) === "01" || i === 0 ? String(r.month).slice(2, 7) : ""}
              </small>
            </div>
          ))}
        </div>
      </VizTip>
    </Card>
  )
}

const STATUS_LABEL: Record<string, string> = {
  delivered: "Доставлен",
  shipped: "В пути",
  canceled: "Отменён",
  unavailable: "Недоступен",
  invoiced: "Счёт выставлен",
  processing: "В обработке",
  created: "Создан",
  approved: "Одобрен",
}

export function StatusBar({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const total = rows.reduce((s, r) => s + (numeric(r.orders) ?? 0), 0)
  return (
    <Card
      title="Статусы заказов"
      accent="заказов"
      description={`${number(total)} заказов за период`}
      hint={ru.osHints.status}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="status-mix.csv" png={false} />}
    >
      <VizTip>
        <div className="vx-status">
          {rows.map((r, i) => (
            <span
              key={String(r.status)}
              className={`vx-s${Math.min(i, 5)}`}
              style={{ flexGrow: numeric(r.orders) ?? 0 }}
              {...tipAttrs(STATUS_LABEL[String(r.status)] ?? String(r.status), [
                {
                  label: "Заказов",
                  value: number(numeric(r.orders) ?? 0),
                  swatch: `vx-s${Math.min(i, 5)}`,
                },
                { label: "Доля", value: percent(total ? (numeric(r.orders) ?? 0) / total : 0, 1) },
              ])}
            />
          ))}
        </div>
      </VizTip>
      <ul className="vx-legend vx-legend-grid">
        {rows.slice(0, 6).map((r, i) => (
          <li key={String(r.status)}>
            <i className={`vx-s${Math.min(i, 5)}`} />
            {STATUS_LABEL[String(r.status)] ?? String(r.status)}
            <b>{percent(total ? (numeric(r.orders) ?? 0) / total : 0, 1)}</b>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function Installments({
  rows,
  query,
  index,
}: {
  rows: Row[]
  query?: CardQuery
  index?: number
}) {
  const max = Math.max(1, ...rows.map((r) => numeric(r.orders) ?? 0))
  const total = rows.reduce((s, r) => s + (numeric(r.orders) ?? 0), 0)
  return (
    <Card
      title="Рассрочка по картам"
      accent="Рассрочка"
      description="Заказы по числу платежей"
      hint={ru.osHints.installments}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="installments.csv" png={false} />}
    >
      <VizTip>
        <div className="vx-columns">
          {rows.map((r) => {
            const n = numeric(r.orders) ?? 0
            return (
              <div
                key={String(r.installments)}
                {...tipAttrs(`Платежей: ${String(r.installments)}`, [
                  { label: "Заказов", value: number(n), color: "var(--viz-1)" },
                  { label: "Доля", value: percent(total ? n / total : 0, 1) },
                ])}
              >
                <em>{percent(total ? n / total : 0, 0)}</em>
                <span style={{ height: `${(n / max) * 100}%` }} />
                <small>{Number(r.installments) >= 10 ? "10+" : String(r.installments)}</small>
              </div>
            )
          })}
        </div>
      </VizTip>
    </Card>
  )
}

export function AvgCheckTrend({
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
      title="Средний чек по месяцам"
      accent="чек"
      description="Товары плюс доставка, доставленные заказы"
      hint={ru.osHints.avgTrend}
      query={query}
      index={index}
      actions={<CardTools rows={rows} filename="avg-check-monthly.csv" />}
    >
      <Chart
        rows={rows}
        x="month"
        y="avg_check"
        label={ru.avgCheck}
        formatValue={(n) => money(n)}
        formatTick={(n) => compact(n)}
        formatLabel={month}
        legend={false}
      />
    </Card>
  )
}
