import type { MockFilters, Row } from "./data"
import { customersFor, rng, statesFor } from "./data"

const factorOf = (filters: MockFilters) =>
  Number(customersFor(filters)[0]?.customers_total ?? 0) / 96096

const MONTHS = Array.from({ length: 20 }, (_, i) => {
  const date = new Date(Date.UTC(2017, i, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
})

const inPeriod = (month: string, filters: MockFilters) =>
  (!filters.start_date || `${month}-01` >= filters.start_date.slice(0, 7) + "-01") &&
  (!filters.end_date || `${month}-01` < filters.end_date)

const ORDERS_2017 = [
  800, 1780, 2682, 2404, 3700, 3245, 4026, 4331, 4285, 4631, 7544, 5673, 7269, 6728, 7211, 6939,
  6873, 6167, 6292, 6512,
]

export function deliveryDaysFor(filters: MockFilters): Row[] {
  const total = 96478 * factorOf(filters)
  const weights = Array.from({ length: 61 }, (_, d) => {
    if (d === 60) return 0.0045
    const x = Math.log(Math.max(d, 0.4))
    return Math.exp(-((x - 2.3) ** 2) / (2 * 0.52 ** 2)) / Math.max(d, 0.4)
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w, days) => ({
    days,
    orders: Math.round((w / sum) * total),
  }))
}

export function stagesFor(filters: MockFilters): Row[] {
  const random = rng(4242)
  return MONTHS.map((month, i) => {
    const approve = 0.35 + random() * 0.35
    const seller = 2.6 + random() * 1.2 + (i === 10 ? 1.4 : 0)
    const carrier = 8.4 + random() * 3 + (i === 13 || i === 14 ? 3.5 : 0) + (i === 10 ? 2.6 : 0)
    return {
      month,
      approve: Math.round(approve * 100) / 100,
      seller: Math.round(seller * 100) / 100,
      carrier: Math.round(carrier * 100) / 100,
      delivered: Math.round((ORDERS_2017[i] ?? 0) * 0.97 * factorOf(filters)),
    }
  }).filter((row) => inPeriod(row.month, filters))
}

export function reviewScoresFor(filters: MockFilters): Row[] {
  const f = factorOf(filters)
  return [
    [1, 6125, 3299],
    [2, 2353, 551],
    [3, 7172, 856],
    [4, 18248, 798],
    [5, 54688, 1155],
  ].map(([score = 0, onTime = 0, late = 0]) => ({
    score,
    on_time: Math.round(onTime * f),
    late: Math.round(late * f),
  }))
}

export function customersMonthlyFor(filters: MockFilters): Row[] {
  const f = factorOf(filters)
  return MONTHS.map((month, i) => {
    const orders = ORDERS_2017[i] ?? 0
    const returning = Math.round(orders * Math.min(0.018, 0.002 + i * 0.0009))
    return {
      month,
      new_customers: Math.round((orders - returning) * 0.985 * f),
      returning: Math.round(returning * f),
    }
  }).filter((row) => inPeriod(row.month, filters))
}

export function ordersPerCustomerFor(filters: MockFilters): Row[] {
  const total = Number(customersFor(filters)[0]?.customers_total ?? 0)
  const returned = Number(customersFor(filters)[0]?.returned ?? 0)
  const two = Math.round(returned * 0.877)
  const three = Math.round(returned * 0.09)
  return [
    { bucket: "1", customers: total - returned },
    { bucket: "2", customers: two },
    { bucket: "3", customers: three },
    { bucket: "4+", customers: returned - two - three },
  ]
}

export function customerStatesFor(filters: MockFilters): Row[] {
  const random = rng(777)
  return statesFor(filters)
    .map((row) => {
      const orders = Math.round(Number(row.delivered ?? 0) * 1.03)
      return {
        state: row.state ?? "",
        customers: Math.round(orders * 0.968),
        orders,
        repeat_share: Math.round((0.045 + (random() - 0.5) * 0.02) * 10000) / 10000,
      }
    })
    .sort((a, b) => b.customers - a.customers)
}

export const deliveryCustomerBuilders: Record<string, (filters: MockFilters) => Row[]> = {
  "dc.delivery_days": deliveryDaysFor,
  "dc.stages": stagesFor,
  "dc.review_scores": reviewScoresFor,
  "dc.customers_monthly": customersMonthlyFor,
  "dc.orders_per_customer": ordersPerCustomerFor,
  "dc.customer_states": customerStatesFor,
}
