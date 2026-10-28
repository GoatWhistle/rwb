import type { CSSProperties } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import type { DashboardContext, Filters, MetricResult } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, ErrorState } from "@/shared/ui/controls"
import { CustomerProfile } from "./customer-profile"
import { DeliveryTrend, Geography, Lateness, SellerDelivery } from "./delivery-panels"
import { FiltersBar } from "./filters"
import { MetricCard } from "./metric-card"
import { getMetricGroups } from "./metric-groups"
import { Categories, SalesTrend, Sellers } from "./sales-panels"

const rowsOf = (result: MetricResult | undefined) => result?.table.rows ?? []

const TABS = ["overview", "sales", "delivery", "customers"] as const
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
  const states = useMetric("dashboard.states", filters, overview || delivery)
  const lateness = useMetric("dashboard.lateness", filters, delivery)
  const sellerDelivery = useMetric("dashboard.sellers", filters, delivery)
  const kpiQueries = {
    overview: [monthly, avg, kpi],
    sales: [monthly, avg, customers],
    delivery: [kpi],
    customers: [customers, avg],
  }[tab]
  const kpiError = kpiQueries.some((q) => q.isError)
  const kpiLoading = kpiQueries.some((q) => q.isPending)
  const { salesMetrics, deliveryMetrics, customerMetrics, returnedPct } = getMetricGroups(
    monthly.data,
    avg.data,
    customers.data,
    kpi.data,
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
  }[tab]
  return (
    <div className="dashboard">
      <nav ref={tabsRef} className="dashboard-tabs" aria-label={ru.analytics}>
        {indicator && (
          <span
            className="tabs-indicator"
            aria-hidden="true"
            style={{ transform: `translateX(${indicator.x}px) scaleX(${indicator.w})` }}
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
          q={{ monthly, categories, sellers, states, deliveryMonthly, lateness, sellerDelivery }}
        />
        {tab === "customers" && <CustomerProfile returnedPct={returnedPct} />}
      </div>
    </div>
  )
}

type Query = ReturnType<typeof useMetric>
function TabCards({
  tab,
  q,
}: {
  tab: DashboardTab
  q: Record<
    | "monthly"
    | "categories"
    | "sellers"
    | "states"
    | "deliveryMonthly"
    | "lateness"
    | "sellerDelivery",
    Query
  >
}) {
  return (
    <>
      {(tab === "overview" || tab === "sales") && (
        <SalesTrend result={q.monthly.data} query={q.monthly} index={4} />
      )}
      {tab === "overview" && (
        <div className="detail-grid">
          <Geography rows={rowsOf(q.states.data)} query={q.states} index={5} limit={5} />
          <Categories rows={rowsOf(q.categories.data)} query={q.categories} index={6} limit={5} />
        </div>
      )}
      {tab === "sales" && (
        <div className="detail-grid">
          <Categories rows={rowsOf(q.categories.data)} query={q.categories} index={5} />
          <Sellers rows={rowsOf(q.sellers.data)} query={q.sellers} index={6} />
        </div>
      )}
      {tab === "delivery" && (
        <>
          <DeliveryTrend
            rows={rowsOf(q.deliveryMonthly.data)}
            query={q.deliveryMonthly}
            index={4}
          />
          <div className="detail-grid">
            <Geography rows={rowsOf(q.states.data)} query={q.states} index={5} />
            <div className="panel-stack">
              <Lateness rows={rowsOf(q.lateness.data)} query={q.lateness} index={6} />
              <SellerDelivery
                rows={rowsOf(q.sellerDelivery.data)}
                query={q.sellerDelivery}
                index={7}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}
