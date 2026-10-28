import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import Markdown from "react-markdown"
import { cell } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { TableBlock } from "./chat-blocks"
import { CodeBlock } from "./code-block"
import type { ChatMessage } from "./use-chat"

function Disclosure({
  className,
  summary,
  children,
}: {
  className: string
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <details className={className}>
      <summary className="disclosure-summary">
        {summary}
        <ChevronDown size={14} className="disclosure-chevron" />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  )
}
function period(filters: Record<string, unknown>) {
  const from = typeof filters.start_date === "string" ? filters.start_date : ""
  const to = typeof filters.end_date === "string" ? filters.end_date : ""
  return from || to ? `${from || "…"} — ${to || "…"}` : ""
}
function filterText(filters: Record<string, unknown>) {
  const parts = ["states", "categories", "seller_ids"]
    .map((key) => filters[key])
    .filter((value): value is unknown[] => Array.isArray(value) && value.length > 0)
    .map((value) => value.join(", "))
  return parts.join(" · ") || ru.chatNoFilters
}
function SqlMeta({ source }: { source: Record<string, unknown> }) {
  const filters =
    source.filters && typeof source.filters === "object"
      ? (source.filters as Record<string, unknown>)
      : {}
  const items: [string, string][] = [
    [ru.chatMetric, typeof source.metric_id === "string" ? source.metric_id : ""],
    [ru.chatPeriod, period(filters)],
    [ru.chatFilters, typeof filters.scope === "string" ? filters.scope : filterText(filters)],
  ]
  return (
    <dl className="source-meta">
      {items
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  )
}
function Source({ source }: { source: Record<string, unknown> }) {
  if (source.type === "sql")
    return (
      <div className="source-item">
        <strong>{ru.sourceSql}</strong>
        <SqlMeta source={source} />
        <CodeBlock code={cell(source.sql)} language="sql" />
        {Boolean(source.definition) && (
          <CodeBlock code={JSON.stringify(source.definition, null, 2)} language="json" />
        )}
      </div>
    )
  return (
    <div className="source-item">
      <strong>{source.type === "review" ? ru.sourceReview : ru.sourceOrder}</strong>
      <dl className="source-meta">
        {[
          ["review_id", ru.reviewId],
          ["order_id", ru.orderId],
        ].map(([key, label]) =>
          key && source[key] ? (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <code>{cell(source[key])}</code>
              </dd>
            </div>
          ) : null,
        )}
      </dl>
    </div>
  )
}
export function MessageDetails({
  message,
  details,
  columnLabels,
  question = "",
}: {
  question?: string
  message: ChatMessage
  details: string
  columnLabels: Record<string, string>
}) {
  const tables = Object.entries(message.tables)
  if (!details && !message.sources.length && !tables.length) return null
  return (
    <Disclosure className="message-details" summary={ru.messageDetails}>
      <div className="message-details-body">
        {details && (
          <div className="evidence-prose">
            <Markdown>{details}</Markdown>
          </div>
        )}
        {tables.map(([id, table]) => (
          <TableBlock
            key={id}
            id={id}
            table={table}
            question={question}
            sql=""
            labels={columnLabels}
          />
        ))}
        {message.sources.length > 0 && (
          <div className="evidence-sources">
            <h3>{ru.sources}</h3>
            {message.sources.map((source) => (
              <Source key={JSON.stringify(source)} source={source} />
            ))}
          </div>
        )}
      </div>
    </Disclosure>
  )
}
