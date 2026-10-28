import data from "./block-b-data.json" with { type: "json" }
import type { MockFilters, Row } from "./data"

const byStates = (rows: Row[], filters: MockFilters) =>
  filters.states?.length ? rows.filter((row) => filters.states?.includes(String(row.state))) : rows

export const blockBBuilders: Record<string, (filters: MockFilters) => Row[]> = {
  "bb.price_history": () => data.priceHistory as Row[],
  "bb.delivery_states": (filters) => byStates(data.deliveryStates as Row[], filters),
  "bb.status_funnel": () => data.statusFunnel as Row[],
  "bb.payments_states": (filters) => byStates(data.paymentsStates as Row[], filters),
  "bb.payment_types": () => data.paymentTypes as Row[],
  "bb.score_delivery": () => data.scoreDelivery as Row[],
}
