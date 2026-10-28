import Markdown from "react-markdown"
import { ru } from "@/shared/i18n/ru"
import { Chart } from "@/shared/ui/chart"
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
export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <div className="user-message">{message.text}</div>
  const presentation = presentMessage(message.text, message.details)
  return (
    <div className="assistant-message">
      <div className="answer-prose">
        <Markdown>{presentation.text}</Markdown>
      </div>
      {message.charts.map((chart) => {
        const table = message.tables[chart.table_id]
        if (!table) return null
        return (
          <div className="chat-data" key={`${chart.table_id}-${chart.title}-${chart.y.join("-")}`}>
            <strong>{chart.title}</strong>
            {chart.y.map((y) => (
              <Chart
                key={y}
                rows={table.rows}
                x={chart.x}
                y={y}
                label={`${chart.title}: ${columnLabels[y] ?? y}`}
                type={chart.type}
              />
            ))}
          </div>
        )
      })}
      <MessageDetails
        message={message}
        details={presentation.details}
        columnLabels={columnLabels}
      />
      {message.error && (
        <p className="message-error" role="alert">
          {message.error}
        </p>
      )}
      {message.stopped && <p className="chat-status">{ru.interrupted}</p>}
    </div>
  )
}
