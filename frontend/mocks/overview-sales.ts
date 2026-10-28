import type { MockFilters, Row } from "./data"
import { deliveryMonthlyFor, monthlyFor, periodShare, scale, stateShare, statesFor } from "./data"

const round2 = (value: number) => Math.round(value * 100) / 100
const STATE_REVENUE: Record<string, number> = {
  SP: 5202955,
  RJ: 1824093,
  MG: 1585308,
  RS: 750304,
  PR: 683084,
  SC: 520553,
  BA: 511350,
  DF: 302604,
  GO: 294592,
  ES: 275037,
  PE: 262788,
  CE: 227254,
  PA: 178948,
  MT: 156453,
  MA: 119648,
  MS: 116813,
  PB: 115268,
  PI: 86914,
  RN: 83035,
  AL: 80315,
  SE: 58921,
  TO: 49622,
  RO: 46141,
  AM: 22356,
  AC: 15983,
  AP: 13474,
  RR: 7829,
}
const revenueTotal = Object.values(STATE_REVENUE).reduce((a, b) => a + b, 0)

export function kpiMonthlyFor(filters: MockFilters): Row[] {
  const delivery = new Map(deliveryMonthlyFor(filters).map((r) => [String(r.month), r]))
  return monthlyFor(filters)
    .map((row): Row => {
      const month = String(row.month).slice(0, 7)
      const orders = Number(row.orders_cnt)
      const d = delivery.get(month)
      const t = Number(month.slice(2, 4)) * 12 + Number(month.slice(5, 7))
      const customers = Math.round(orders * 0.967)
      const repeat = round2(1.6 + (t % 7) * 0.22 + (t - 205) * 0.09)
      return {
        month,
        orders_cnt: orders,
        revenue: row.revenue ?? null,
        avg_check: round2(152 + ((t * 37) % 19) + (t % 3) * 1.7),
        customers,
        returned: Math.round((customers * repeat) / 100),
        repeat_pct: repeat,
        delivered: d ? (d.delivered ?? null) : Math.round(orders * 0.97),
        otd: d ? (d.otd ?? null) : 0.93,
        median_days: d ? (d.median_days ?? null) : 10.2,
        avg_score: round2(4.02 + ((t * 13) % 11) / 50),
      }
    })
    .filter((row) => String(row.month) >= "2017-01")
}

const HOUR_WEIGHT = [
  0.9, 0.45, 0.2, 0.12, 0.1, 0.15, 0.35, 0.95, 2.2, 3.4, 4.6, 4.9, 4.7, 4.95, 5.0, 4.85, 4.95, 4.7,
  4.4, 4.5, 4.8, 4.75, 4.2, 2.6,
]
const DAY_WEIGHT = [1.0, 1.0, 0.97, 0.95, 0.91, 0.68, 0.72]

export function heatmapFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  const total = 99441 * factor
  const sum = HOUR_WEIGHT.reduce((a, b) => a + b, 0) * DAY_WEIGHT.reduce((a, b) => a + b, 0)
  const rows: Row[] = []
  for (const [d, dw] of DAY_WEIGHT.entries())
    for (const [hour, hw] of HOUR_WEIGHT.entries()) {
      const orders = Math.round((total * dw * hw) / sum)
      rows.push({
        dow: d + 1,
        hour,
        orders,
        revenue: round2(orders * 133.0 * (0.94 + (hour % 5) * 0.03)),
      })
    }
  return rows
}

export function paymentsMonthlyFor(filters: MockFilters): Row[] {
  return monthlyFor(filters)
    .filter((row) => String(row.month).slice(0, 7) >= "2017-01")
    .map((row) => {
      const amount = Number(row.revenue) * 1.32
      const t = Number(String(row.month).slice(5, 7))
      return {
        month: String(row.month).slice(0, 7),
        credit_card: round2(amount * (0.775 + (t % 3) * 0.006)),
        boleto: round2(amount * (0.177 - (t % 3) * 0.004)),
        voucher: round2(amount * 0.032),
        debit_card: round2(amount * (0.014 + (t % 4) * 0.001)),
      }
    })
}

const INSTALLMENTS = [25455, 12413, 10461, 7098, 5239, 3920, 1626, 4268, 644, 5390]

export function installmentsFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  return INSTALLMENTS.map((orders, i) => ({
    installments: i + 1,
    orders: Math.round(orders * factor),
    amount: round2(orders * factor * (95 + i * 24)),
  }))
}

export function statesRevenueFor(filters: MockFilters): Row[] {
  const share = periodShare(filters)
  const base = new Map(
    statesFor(filters.states?.length ? { states: filters.states } : {}).map((r) => [
      String(r.state),
      r,
    ]),
  )
  return Object.entries(STATE_REVENUE)
    .filter(([state]) => !filters.states?.length || filters.states.includes(state))
    .map(([state, revenue]) => {
      const scaled = (revenue / revenueTotal) * 13221498.11 * share
      return {
        state,
        orders: Math.round((Number(base.get(state)?.delivered ?? scaled / 140) / 0.97) * share),
        revenue: round2(scaled),
      }
    })
}

const STATUS: [string, number][] = [
  ["delivered", 96478],
  ["shipped", 1107],
  ["canceled", 625],
  ["unavailable", 609],
  ["invoiced", 314],
  ["processing", 301],
  ["created", 5],
  ["approved", 2],
]

export function statusMixFor(filters: MockFilters): Row[] {
  const factor = periodShare(filters) * stateShare(filters)
  return STATUS.map(([status, orders]) => ({
    status,
    orders: Math.round(orders * factor),
  }))
}
