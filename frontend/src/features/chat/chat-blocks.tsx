import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  LayoutDashboard,
  Loader2,
  Package,
  RotateCcw,
  Star,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { DataTable } from "@/shared/api/metrics"
import type { WidgetKind } from "@/shared/api/widget-types"
import { cell, downloadCsv, number, numeric } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
import { formatCell } from "./chat-format"
import { buildDraft, saveWidget } from "./save-widget"
import type { ChatChart, ChatOrder, ChatStep } from "./use-chat"

const ROW_LIMIT = 8

function stepMeta(step: ChatStep) {
  if (step.status === "running") return ru.chatStepRunning
  if (step.status === "error") return ru.chatStepFailed
  return step.elapsed === undefined ? "" : `${number(step.elapsed)} мс`
}

export function StepsTimeline({ steps }: { steps: ChatStep[] }) {
  if (!steps.length) return null
  const total = steps.reduce((sum, step) => sum + (step.elapsed ?? 0), 0)
  return (
    <details className="chat-steps">
      <summary className="chat-steps-summary">
        <span>{ru.chatSteps}</span>
        <span className="chat-steps-count">{steps.length}</span>
        {total > 0 && <span className="chat-steps-time">{(total / 1000).toFixed(1)} с</span>}
        <ChevronDown size={14} className="disclosure-chevron" />
      </summary>
      <ol className="chat-steps-list">
        {steps.map((step) => (
          <li key={step.id} className={`chat-step is-${step.status}`}>
            <span className="chat-step-icon" aria-hidden="true">
              {step.status === "running" ? (
                <Loader2 size={12} className="spin" />
              ) : step.status === "ok" ? (
                <Check size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
            </span>
            <span className="chat-step-name">{ru.chatToolNames[step.name] ?? step.name}</span>
            <span className="chat-step-meta">{stepMeta(step)}</span>
            {step.error && <p className="chat-step-error">{step.error}</p>}
          </li>
        ))}
      </ol>
    </details>
  )
}

function SaveAction({ build }: { build: () => Parameters<typeof saveWidget>[0] }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  useEffect(() => {
    if (state !== "saved" && state !== "failed") return
    const timer = window.setTimeout(() => setState("idle"), 2600)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <>
      <button
        type="button"
        className="chat-block-action"
        disabled={state === "saving"}
        onClick={() => {
          setState("saving")
          saveWidget(build()).then(
            () => setState("saved"),
            () => setState("failed"),
          )
        }}
      >
        <LayoutDashboard size={13} />
        {ru.chatToConstructor}
      </button>
      {(state === "saved" || state === "failed") && (
        <div className={`chat-toast ${state === "failed" ? "is-error" : ""}`} role="status">
          {state === "saved" ? <Check size={14} /> : <AlertCircle size={14} />}
          {state === "saved" ? ru.chatSaved : ru.chatSaveFailed}
        </div>
      )}
    </>
  )
}

interface BlockProps {
  table: DataTable
  question: string
  sql: string
  labels: Record<string, string>
}

function draftBuilder(
  props: BlockProps,
  title: string,
  kind: WidgetKind,
  x: string | null,
  y: string[],
) {
  return () =>
    buildDraft({
      table: props.table,
      title,
      question: props.question,
      kind,
      x,
      y,
      sql: props.sql,
      labels: props.labels,
    })
}

export function ChartBlock({ chart, ...props }: BlockProps & { chart: ChatChart }) {
  return (
    <figure className="chat-block">
      <header className="chat-block-head">
        <figcaption>{chart.title}</figcaption>
        <SaveAction
          build={draftBuilder(props, chart.title || props.question, chart.type, chart.x, chart.y)}
        />
      </header>
      {chart.y.length > 1 && (
        <ul className="chat-legend">
          {chart.y.map((y, i) => (
            <li key={y} style={{ ["--swatch" as string]: `var(--viz-${i + 1})` }}>
              {props.labels[y] ?? y}
            </li>
          ))}
        </ul>
      )}
      {chart.y.map((y) => (
        <Chart
          key={y}
          rows={props.table.rows}
          x={chart.x}
          y={y}
          label={`${chart.title}: ${props.labels[y] ?? y}`}
          type={chart.type}
          seriesLabel={props.labels[y] ?? y}
        />
      ))}
    </figure>
  )
}

function KpiTiles({ table, labels }: { table: DataTable; labels: Record<string, string> }) {
  const row = table.rows[0] ?? {}
  return (
    <div className="chat-kpis">
      {table.columns.map((col) => (
        <div key={col.name} className="chat-kpi">
          <span>{labels[col.name] ?? col.name}</span>
          <strong>{formatCell(col.name, row[col.name])}</strong>
        </div>
      ))}
    </div>
  )
}

function Grid({
  table,
  labels,
  rows,
}: {
  table: DataTable
  labels: Record<string, string>
  rows: DataTable["rows"]
}) {
  const numericColumns = new Set(
    table.columns
      .filter((col) => table.rows.some((row) => numeric(row[col.name]) !== null))
      .map((col) => col.name),
  )
  return (
    <div className="chat-table-scroll">
      <table className="chat-grid">
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th key={col.name} className={numericColumns.has(col.name) ? "is-num" : ""}>
                {labels[col.name] ?? col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={JSON.stringify(row)}>
              {table.columns.map((col) => (
                <td key={col.name} className={numericColumns.has(col.name) ? "is-num" : ""}>
                  {formatCell(col.name, row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TableBlock({ id = "result", ...props }: BlockProps & { id?: string }) {
  const [all, setAll] = useState(false)
  const { table, labels } = props
  const rows = all ? table.rows : table.rows.slice(0, ROW_LIMIT)
  return (
    <figure className="chat-block">
      <header className="chat-block-head">
        <figcaption>
          {ru.results}
          <span className="chat-block-count">{number(table.rows.length)}</span>
        </figcaption>
        <span className="chat-block-actions">
          <button
            type="button"
            className="chat-block-action"
            onClick={() => downloadCsv(table.rows, `datum-${id}.csv`)}
          >
            <Download size={13} />
            CSV
          </button>
          <SaveAction build={draftBuilder(props, props.question, "table", null, [])} />
        </span>
      </header>
      {table.rows.length === 1 ? (
        <KpiTiles table={table} labels={labels} />
      ) : (
        <Grid table={table} labels={labels} rows={rows} />
      )}
      {table.rows.length > ROW_LIMIT && (
        <button type="button" className="chat-show-all" onClick={() => setAll(!all)}>
          <span>{all ? ru.chatCollapse : ru.chatShowAll}</span>
          {!all && <span className="chat-block-count">{number(table.rows.length)}</span>}
        </button>
      )}
      {table.truncated && <p className="footnote">{ru.truncated}</p>}
    </figure>
  )
}

export function isReviewTable(table: DataTable) {
  const names = new Set(table.columns.map((col) => col.name))
  return (
    names.has("review_id") &&
    names.has("score") &&
    (names.has("original_text") || names.has("message"))
  )
}

export function ReviewCards({ table }: { table: DataTable }) {
  return (
    <section className="chat-reviews">
      <header className="chat-block-head">
        <h4>{ru.chatReviews}</h4>
        <span className="chat-block-count">{ru.chatReviewsNote}</span>
      </header>
      {table.rows.slice(0, 6).map((row) => {
        const score = numeric(row.score) ?? 0
        return (
          <blockquote key={cell(row.review_id)} className="chat-review">
            <div className="chat-stars" role="img" aria-label={`${score} из 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={12} className={n <= score ? "is-on" : ""} />
              ))}
            </div>
            <p>{cell(row.original_text ?? row.message)}</p>
            {Boolean(row.customer_state) && <cite>{cell(row.customer_state)}</cite>}
          </blockquote>
        )
      })}
    </section>
  )
}

function rowsOf(table: DataTable | undefined) {
  return table && Array.isArray(table.rows) ? table.rows : []
}

function OrderTotals({ totals }: { totals: Record<string, unknown> }) {
  if (totals.order_total === undefined && totals.paid === undefined) return null
  return (
    <div className="chat-order-totals">
      <span>
        {ru.chatTotal} <b className="is-num">{cell(totals.order_total)}</b>
      </span>
      <span>
        {ru.chatPaid} <b className="is-num">{cell(totals.paid)}</b>
      </span>
    </div>
  )
}

export function OrderCard({ order }: { order: ChatOrder }) {
  if (!order.found || !order.order)
    return (
      <div className="chat-notice">
        <Package size={15} />
        {ru.chatOrderNotFound}
      </div>
    )
  const info = order.order
  const events = Object.entries(ru.chatOrderEvents).filter(([key]) => info[key])
  const totals = rowsOf(order.totals)[0] ?? {}
  return (
    <section className="chat-order">
      <header className="chat-order-head">
        <Package size={15} />
        <strong>{ru.chatOrder}</strong>
        <code>{cell(info.order_id ?? order.order_id).slice(0, 12)}…</code>
        {Boolean(info.status) && <span className="chat-order-status">{cell(info.status)}</span>}
      </header>
      {events.length > 0 && (
        <ol className="chat-order-timeline">
          {events.map(([key, label]) => (
            <li key={key} className={key.startsWith("estimated") ? "is-planned" : ""}>
              <span>{label}</span>
              <time>{cell(info[key]).slice(0, 10)}</time>
            </li>
          ))}
        </ol>
      )}
      {rowsOf(order.items).length > 0 && (
        <div className="chat-order-section">
          <h5>{ru.chatItems}</h5>
          {rowsOf(order.items).map((item) => (
            <div key={JSON.stringify(item)} className="chat-order-line">
              <span>{cell(item.category_name ?? item.product_id)}</span>
              <span className="is-num">{cell(item.price)}</span>
            </div>
          ))}
        </div>
      )}
      {rowsOf(order.payments).length > 0 && (
        <div className="chat-order-section">
          <h5>{ru.chatPayments}</h5>
          {rowsOf(order.payments).map((payment) => (
            <div key={JSON.stringify(payment)} className="chat-order-line">
              <span>
                {cell(payment.payment_type ?? payment.type)}
                {numeric(payment.installments) ? ` × ${cell(payment.installments)}` : ""}
              </span>
              <span className="is-num">{cell(payment.amount ?? payment.payment_value)}</span>
            </div>
          ))}
        </div>
      )}
      <OrderTotals totals={totals} />
    </section>
  )
}

export function Notice({
  text,
  tone = "info",
  onRetry,
}: {
  text: string
  tone?: "info" | "error"
  onRetry?: (() => void) | undefined
}) {
  return (
    <div className={`chat-notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <AlertCircle size={15} />
      <span>{text}</span>
      {onRetry && (
        <button type="button" className="chat-block-action" onClick={onRetry}>
          <RotateCcw size={13} />
          {ru.chatRetry}
        </button>
      )}
    </div>
  )
}

export function SourceChips({ sources }: { sources: Record<string, unknown>[] }) {
  if (!sources.length) return null
  return (
    <ul className="chat-chips">
      {sources.map((source) => (
        <li
          key={JSON.stringify(source)}
          className="chat-chip"
          title={cell(source.sql ?? source.order_id ?? "")}
        >
          {source.type === "sql"
            ? source.metric_id
              ? cell(source.metric_id)
              : ru.sourceSql
            : source.type === "review"
              ? ru.sourceReview
              : ru.sourceOrder}
        </li>
      ))}
    </ul>
  )
}
