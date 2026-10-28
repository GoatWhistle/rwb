import { useLayoutEffect, useRef, useState } from "react"
import type { DashboardContext, Filters, MetricResult } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, ErrorState, Skeleton } from "@/shared/ui/controls"
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
  const sales = tab === "overview" || tab === "sales"
  const delivery = tab === "delivery"
  const monthly = useMetric("block_a.1", filters, sales)
  const avg = useMetric("block_a.3", filters, !delivery)
  const customers = useMetric("block_a.4", filters, !delivery)
  const categories = useMetric("block_a.5", filters, sales)
  const sellers = useMetric("block_a.2", filters, sales)
  const kpi = useMetric("dashboard.kpi", filters, delivery)
  const deliveryMonthly = useMetric("dashboard.monthly", filters, delivery)
  const states = useMetric("dashboard.states", filters, delivery)
  const lateness = useMetric("dashboard.lateness", filters, delivery)
  const sellerDelivery = useMetric("dashboard.sellers", filters, delivery)
  const queries = sales
    ? [monthly, avg, customers, categories, sellers]
    : delivery
      ? [kpi, deliveryMonthly, states, lateness, sellerDelivery]
      : [customers, avg]
  const error = queries.some((q) => q.isError)
  const loading = queries.some((q) => q.isPending)
  const { salesMetrics, deliveryMetrics, customerMetrics, returnedPct } = getMetricGroups(
    monthly.data,
    avg.data,
    customers.data,
    kpi.data,
  )
  const result = delivery ? kpi.data : (monthly.data ?? customers.data)
  const activeMetrics = {
    overview: salesMetrics,
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
      {error ? (
        <ErrorState
          retry={() => {
            for (const q of queries) void q.refetch()
          }}
        />
      ) : loading ? (
        <Skeleton />
      ) : (
        <div key={tab} className="tab-panel">
          <div className="metric-grid">
            {activeMetrics.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                filters={filters}
                result={result}
                onAsk={onAsk}
              />
            ))}
          </div>
          {sales && monthly.data && <SalesTrend result={monthly.data} />}
          {sales && (
            <div className="detail-grid">
              <Categories rows={rowsOf(categories.data)} />
              <Sellers rows={rowsOf(sellers.data)} />
            </div>
          )}
          {delivery && (
            <>
              <DeliveryTrend rows={rowsOf(deliveryMonthly.data)} />
              <div className="detail-grid">
                <Geography rows={rowsOf(states.data)} />
                <div className="panel-stack">
                  <Lateness rows={rowsOf(lateness.data)} />
                  <SellerDelivery rows={rowsOf(sellerDelivery.data)} />
                </div>
              </div>
            </>
          )}
          {tab === "customers" && <CustomerProfile returnedPct={returnedPct} />}
        </div>
      )}
    </div>
  )
}
