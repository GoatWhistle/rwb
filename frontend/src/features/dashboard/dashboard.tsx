import type { CSSProperties } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import type { DashboardContext, Filters, MetricResult } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, ErrorState } from "@/shared/ui/controls"
import { ConstructorPage } from "../constructor/constructor-page"
import { CustomerProfile } from "./customer-profile"
import {
  CustomerMap,
  CustomerStates,
  CustomersMonthly,
  DeliveryDays,
  DeliveryStages,
  OnTimeMap,
  OrdersPerCustomer,
  ReviewScores,
} from "./dc-panels"
import { DeliveryTrend, Geography, Lateness, SellerDelivery } from "./delivery-panels"
import { FiltersBar } from "./filters"
import { MetricCard } from "./metric-card"
import { getMetricGroups } from "./metric-groups"
import { Categories, SalesTrend, Sellers } from "./sales-panels"
import { AvgCheckTrend, Heatmap, Installments, PaymentsMix, StatusBar, TileMap } from "./viz-extra"

const rowsOf = (result: MetricResult | undefined) => result?.table.rows ?? []

const TABS = ["overview", "sales", "delivery", "customers", "constructor"] as const
export type DashboardTab = (typeof TABS)[number]
export function Dashboard({
  filters,
  onFilters,
  onAsk,
}: {
  filters: Filters
  onFilters: (value: Filters) => void
  onAsk: (context: DashboardContext, name: string) => void
}) {
  const [tab, setTab] = useState<DashboardTab>("overview")
  const tabsRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const nav = tabsRef.current
    if (!nav) return
    const place = () => {
      const active = nav.querySelectorAll<HTMLElement>("button")[TABS.indexOf(tab)]
      if (active) setIndicator({ x: active.offsetLeft, w: active.offsetWidth })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [tab])
  const overview = tab === "overview"
  const salesTab = tab === "sales"
  const delivery = tab === "delivery"
  const monthly = useMetric("block_a.1", filters, overview || salesTab)
  const avg = useMetric("block_a.3", filters, !delivery)
  const customers = useMetric("block_a.4", filters, !delivery)
  const categories = useMetric("block_a.5", filters, overview || salesTab)
  const sellers = useMetric("block_a.2", filters, salesTab)
  const kpi = useMetric("dashboard.kpi", filters, overview || delivery)
  const deliveryMonthly = useMetric("dashboard.monthly", filters, delivery)
  const states = useMetric("dashboard.states", filters, !salesTab)
  const lateness = useMetric("dashboard.lateness", filters, delivery)
  const sellerDelivery = useMetric("dashboard.sellers", filters, delivery)
  const kpiMonthly = useMetric("os.kpi_monthly", filters)
  const heatmap = useMetric("os.heatmap", filters, overview || salesTab)
  const payments = useMetric("os.payments_monthly", filters, overview || salesTab)
  const installments = useMetric("os.installments", filters, salesTab)
  const statesRevenue = useMetric("os.states_revenue", filters, overview)
  const statusMix = useMetric("os.status_mix", filters, overview)
  const customersTab = tab === "customers"
  const deliveryDays = useMetric("dc.delivery_days", filters, delivery)
  const stages = useMetric("dc.stages", filters, delivery)
  const scores = useMetric("dc.review_scores", filters, delivery)
  const customersMonthly = useMetric("dc.customers_monthly", filters, customersTab)
  const perCustomer = useMetric("dc.orders_per_customer", filters, customersTab)
  const customerStates = useMetric("dc.customer_states", filters, customersTab)
  const kpiQueries = {
    overview: [monthly, avg, kpi],
    sales: [monthly, avg, customers],
    delivery: [kpi],
    customers: [customers, avg],
    constructor: [],
  }[tab]
  const kpiError = kpiQueries.some((q) => q.isError)
  const kpiLoading = kpiQueries.some((q) => q.isPending)
  const { salesMetrics, deliveryMetrics, customerMetrics, returnedPct } = getMetricGroups(
    monthly.data,
    avg.data,
    customers.data,
    kpi.data,
    kpiMonthly.data,
  )
  const result = delivery ? kpi.data : (monthly.data ?? customers.data)
  const overviewMetrics = [
    ...salesMetrics.filter((m) => m.key !== "repeat"),
    ...deliveryMetrics.filter((m) => m.key === "otd"),
  ]
  const activeMetrics = {
    overview: overviewMetrics,
    sales: salesMetrics,
    delivery: deliveryMetrics,
    customers: customerMetrics,
    constructor: [],
  }[tab]
  return (
    <div className="dashboard">
      <div className="dash-toolbar">
        <nav ref={tabsRef} className="dashboard-tabs" aria-label={ru.analytics}>
          {indicator && (
            <span
              className="tabs-indicator"
              aria-hidden="true"
              style={{
                transform: `translateX(${indicator.x}px) scaleX(${indicator.w})`,
              }}
            />
          )}
          {TABS.map((name) => (
            <Button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {ru[name]}
            </Button>
          ))}
        </nav>
        <FiltersBar value={filters} onChange={onFilters} />
      </div>
      <div key={tab} className="tab-panel">
        {kpiError ? (
          <ErrorState
            retry={() => {
              for (const q of kpiQueries) if (q.isError) void q.refetch()
            }}
          />
        ) : kpiLoading ? (
          <div className="metric-grid" role="status" aria-label={ru.loading}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="metric-card metric-skeleton" />
            ))}
          </div>
        ) : (
          <div className="metric-grid">
            {activeMetrics.map((metric, i) => (
              <div key={metric.key} className="dash-enter" style={{ "--i": i } as CSSProperties}>
                <MetricCard metric={metric} filters={filters} result={result} onAsk={onAsk} />
              </div>
            ))}
          </div>
        )}
        <TabCards
          tab={tab}
          filters={filters}
          q={{
            monthly,
            categories,
            sellers,
            states,
            deliveryMonthly,
            lateness,
            sellerDelivery,
            kpiMonthly,
            heatmap,
            payments,
            installments,
            statesRevenue,
            statusMix,
            deliveryDays,
            stages,
            scores,
            customersMonthly,
            perCustomer,
            customerStates,
          }}
        />
        {tab === "customers" && (
          <CustomerProfile returnedPct={returnedPct} states={rowsOf(states.data)} />
        )}
      </div>
    </div>
  )
}

type Query = ReturnType<typeof useMetric>
function TabCards({
  tab,
  filters,
  q,
}: {
  tab: DashboardTab
  filters: Filters
  q: Record<
    | "monthly"
    | "categories"
    | "sellers"
    | "states"
    | "deliveryMonthly"
    | "lateness"
    | "sellerDelivery"
    | "kpiMonthly"
    | "heatmap"
    | "payments"
    | "installments"
    | "statesRevenue"
    | "statusMix"
    | "deliveryDays"
    | "stages"
    | "scores"
    | "customersMonthly"
    | "perCustomer"
    | "customerStates",
    Query
  >
}) {
  return (
    <>
      {tab === "constructor" && <ConstructorPage filters={filters} />}
      {(tab === "overview" || tab === "sales") && (
        <SalesTrend result={q.monthly.data} query={q.monthly} index={4} />
      )}
      {tab === "overview" && (
        <div className="dg">
          <div className="dg-6 dg-x4">
            <TileMap rows={rowsOf(q.statesRevenue.data)} query={q.statesRevenue} index={5} />
          </div>
          <div className="dg-6 dg-x4">
            <Heatmap rows={rowsOf(q.heatmap.data)} query={q.heatmap} index={6} />
          </div>
          <div className="dg-12 dg-x4 dg-stack">
            <StatusBar rows={rowsOf(q.statusMix.data)} query={q.statusMix} index={7} />
            <PaymentsMix rows={rowsOf(q.payments.data)} query={q.payments} index={8} />
          </div>
          <div className="dg-6">
            <Geography rows={rowsOf(q.states.data)} query={q.states} index={9} limit={5} />
          </div>
          <div className="dg-6">
            <Categories
              rows={rowsOf(q.categories.data)}
              query={q.categories}
              index={10}
              limit={5}
            />
          </div>
        </div>
      )}
      {tab === "sales" && (
        <div className="dg">
          <div className="dg-6">
            <Heatmap rows={rowsOf(q.heatmap.data)} query={q.heatmap} index={5} />
          </div>
          <div className="dg-6">
            <PaymentsMix rows={rowsOf(q.payments.data)} query={q.payments} index={6} />
          </div>
          <div className="dg-6">
            <AvgCheckTrend rows={rowsOf(q.kpiMonthly.data)} query={q.kpiMonthly} index={7} />
          </div>
          <div className="dg-6">
            <Installments rows={rowsOf(q.installments.data)} query={q.installments} index={8} />
          </div>
          <div className="dg-6">
            <Categories rows={rowsOf(q.categories.data)} query={q.categories} index={5} />
          </div>
          <div className="dg-6">
            <Sellers rows={rowsOf(q.sellers.data)} query={q.sellers} index={6} />
          </div>
        </div>
      )}
      {tab === "delivery" && (
        <div className="dg">
          <div className="dg-8">
            <DeliveryDays rows={rowsOf(q.deliveryDays.data)} query={q.deliveryDays} index={4} />
          </div>
          <div className="dg-4">
            <OnTimeMap rows={rowsOf(q.states.data)} query={q.states} index={5} />
          </div>
          <div className="dg-8">
            <DeliveryStages rows={rowsOf(q.stages.data)} query={q.stages} index={6} />
          </div>
          <div className="dg-4">
            <ReviewScores rows={rowsOf(q.scores.data)} query={q.scores} index={7} />
          </div>
          <div className="dg-12">
            <DeliveryTrend
              rows={rowsOf(q.deliveryMonthly.data)}
              query={q.deliveryMonthly}
              index={8}
            />
          </div>
          <div className="dg-6">
            <Lateness rows={rowsOf(q.lateness.data)} query={q.lateness} index={9} />
          </div>
          <div className="dg-6">
            <Geography rows={rowsOf(q.states.data)} query={q.states} index={10} />
          </div>
          <div className="dg-12">
            <SellerDelivery
              rows={rowsOf(q.sellerDelivery.data)}
              query={q.sellerDelivery}
              index={11}
            />
          </div>
        </div>
      )}
      {tab === "customers" && (
        <div className="dg">
          <div className="dg-8">
            <CustomersMonthly
              rows={rowsOf(q.customersMonthly.data)}
              query={q.customersMonthly}
              index={6}
            />
          </div>
          <div className="dg-4">
            <OrdersPerCustomer rows={rowsOf(q.perCustomer.data)} query={q.perCustomer} index={7} />
          </div>
          <div className="dg-6">
            <CustomerMap rows={rowsOf(q.customerStates.data)} query={q.customerStates} index={8} />
          </div>
          <div className="dg-6">
            <CustomerStates
              rows={rowsOf(q.customerStates.data)}
              query={q.customerStates}
              index={9}
            />
          </div>
        </div>
      )}
    </>
  )
}
