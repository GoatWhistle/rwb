import { ChevronDown, Download, FileText } from "lucide-react"
import Markdown from "react-markdown"
import { cell, downloadCsv } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import { DataTable } from "@/shared/ui/data-table"
import type { ChatMessage } from "./use-chat"

function Source({ source }: { source: Record<string, unknown> }) {
  if (source.type === "sql")
    return (
      <div className="source-item">
        <strong>{ru.sourceSql}</strong>
        <pre>{cell(source.sql)}</pre>
        {Boolean(source.definition) && <pre>{JSON.stringify(source.definition, null, 2)}</pre>}
      </div>
    )
  return (
    <div className="source-item">
      <strong>{source.type === "review" ? ru.sourceReview : ru.sourceOrder}</strong>
      <dl>
        {[
          ["review_id", ru.reviewId],
          ["order_id", ru.orderId],
        ].map(([key, label]) =>
          key && source[key] ? (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{cell(source[key])}</dd>
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
}: {
  message: ChatMessage
  details: string
  columnLabels: Record<string, string>
}) {
  const tables = Object.entries(message.tables)
  if (!details && !message.sources.length && !tables.length) return null
  return (
    <details className="message-details">
      <summary>
        {ru.messageDetails}
        <ChevronDown size={14} />
      </summary>
      <div className="message-details-body">
        {details && (
          <div className="evidence-prose">
            <Markdown>{details}</Markdown>
          </div>
        )}
        {tables.map(([id, table]) => (
          <details className="chat-table" key={id}>
            <summary>
              <FileText size={14} />
              {ru.results}
              <span>
                {table.rows.length} {ru.rows}
              </span>
              <ChevronDown size={14} />
            </summary>
            <div className="chat-table-toolbar">
              <IconButton
                label={ru.export}
                onClick={() => downloadCsv(table.rows, `datum-${id}.csv`)}
              >
                <Download size={15} />
              </IconButton>
            </div>
            <DataTable
              rows={table.rows}
              columns={table.columns.map((col) => ({
                key: col.name,
                label: columnLabels[col.name] ?? col.name,
              }))}
            />
            {table.truncated && <p className="footnote">{ru.truncated}</p>}
          </details>
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
    </details>
  )
}
