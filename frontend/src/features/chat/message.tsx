import Markdown from "react-markdown"
import { ru } from "@/shared/i18n/ru"
import {
  ChartBlock,
  isReviewTable,
  Notice,
  OrderCard,
  ReviewCards,
  SourceChips,
  StepsTimeline,
  TableBlock,
} from "./chat-blocks"
import { MessageDetails } from "./message-details"
import { presentMessage } from "./message-presentation"
import type { ChatMessage } from "./use-chat"

const columnLabels: Record<string, string> = {
  month: ru.month,
  orders_cnt: ru.orders,
  revenue: ru.revenue,
  seller_id: ru.seller,
  city: ru.city,
  state: ru.region,
  avg_check: ru.avgCheck,
  category: ru.category,
  revenue_pct: ru.share,
  customers_total: ru.customerTotal,
  returned: ru.returned,
  returned_pct: ru.repeat,
  delivered: ru.delivered,
  otd: ru.onTime,
  median_days: ru.deliveryTime,
}
function sqlFor(message: ChatMessage, tableId: string) {
  const source = message.sources.find(
    (item) => item.type === "sql" && `table_${String(item.id)}` === tableId,
  )
  return typeof source?.sql === "string" ? source.sql : ""
}
function layout(message: ChatMessage, streaming: boolean) {
  const charted = new Set(message.charts.map((chart) => chart.table_id))
  const tables = Object.entries(message.tables)
  const orderTool = (message.orders ?? []).length > 0
  const done = !streaming && !message.error && !message.stopped
  return {
    reviewTables: tables.filter(([, table]) => isReviewTable(table)),
    plainTables: tables.filter(
      ([id, table]) =>
        !charted.has(id) && !isReviewTable(table) && !orderTool && table.rows.length > 1,
    ),
    done,
    empty: done && !message.text.trim() && !tables.length,
  }
}
export function Message({
  message,
  streaming = false,
  onRetry,
}: {
  message: ChatMessage
  streaming?: boolean
  onRetry?: (() => void) | undefined
}) {
  if (message.role === "user")
    return (
      <div className="user-row">
        <div className="user-message">{message.text}</div>
      </div>
    )
  const presentation = presentMessage(message.text, message.details)
  const question = message.question ?? ""
  const { reviewTables, plainTables, done, empty } = layout(message, streaming)
  return (
    <div className="assistant-message">
      <StepsTimeline steps={message.steps ?? []} />
      {presentation.text && (
        <div className={streaming && message.text ? "answer-prose is-streaming" : "answer-prose"}>
          <Markdown>{presentation.text}</Markdown>
        </div>
      )}
      {(message.orders ?? []).map((order) => (
        <OrderCard key={order.order_id} order={order} />
      ))}
      {reviewTables.map(([id, table]) => (
        <ReviewCards key={id} table={table} />
      ))}
      {message.charts.map((chart) => {
        const table = message.tables[chart.table_id]
        if (!table) return null
        return (
          <ChartBlock
            key={`${chart.table_id}-${chart.title}-${chart.y.join("-")}`}
            chart={chart}
            table={table}
            question={question}
            sql={sqlFor(message, chart.table_id)}
            labels={columnLabels}
          />
        )
      })}
      {plainTables.map(([id, table]) => (
        <TableBlock
          key={id}
          table={table}
          question={question}
          sql={sqlFor(message, id)}
          labels={columnLabels}
        />
      ))}
      {done && <SourceChips sources={message.sources} />}
      <MessageDetails
        message={message}
        details={presentation.details}
        columnLabels={columnLabels}
        question={question}
      />
      {empty && <Notice text={ru.chatNoAnswer} onRetry={onRetry} />}
      {message.error && <Notice tone="error" text={message.error} onRetry={onRetry} />}
      {message.stopped && <Notice text={ru.interrupted} onRetry={onRetry} />}
    </div>
  )
}
