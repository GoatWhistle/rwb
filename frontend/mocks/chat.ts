import type { Row } from "./data"
import { lateOrders, monthly, statesFor } from "./data"

interface Tool {
  name: string
  arguments: Record<string, unknown>
  sql: string
  metricId?: string
  rows: Row[]
  chart?: { type: "line" | "bar"; title: string; x: string; y: string[] }
}
export interface Scenario {
  tools: Tool[]
  text: string
  details: string
}

const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
    value,
  )

function revenueByMonth(): Scenario {
  const rows = monthly.map((row) => ({ ...row, month: String(row.month).slice(0, 7) }))
  return {
    tools: [
      {
        name: "query_metrics",
        arguments: { metric_id: "block_a.1" },
        metricId: "block_a.1",
        sql: "SELECT date_trunc('month', o.purchased_at)::date AS month,\n       count(DISTINCT o.order_id) AS orders_cnt,\n       coalesce(sum(i.price) FILTER (WHERE o.status = 'delivered'), 0) AS revenue\nFROM core.orders o LEFT JOIN core.order_items i USING (order_id)\nGROUP BY 1 ORDER BY 1",
        rows,
        chart: { type: "line", title: "Выручка по месяцам", x: "month", y: ["revenue"] },
      },
    ],
    text: `За сентябрь 2016 — август 2018 выручка Capibara составила **${money(13221498.11)} BRL** по доставленным заказам (сумма цен позиций без доставки).\n\n- Рост с единичных заказов в конце 2016 года до 6–7 тыс. заказов в месяц в 2018-м.\n- Пик — **ноябрь 2017** (Black Friday): 7 544 заказа и ${money(987765.37)} BRL.\n- В ноябре 2016 заказов нет совсем — это пробел в данных, а не падение продаж.\n- С января 2018 выручка стабилизировалась на уровне 0,83–0,98 млн BRL в месяц.\n\nДанные за сентябрь 2018 и позже исключены: там единичные, в основном отменённые заказы.`,
    details: "Метрика block_a.1: выручка = сумма price по позициям заказов со статусом delivered.",
  }
}

function deliveryProblems(): Scenario {
  const states = statesFor({}).slice(0, 8)
  return {
    tools: [
      {
        name: "query_metrics",
        arguments: { metric_id: "dashboard.states" },
        metricId: "dashboard.states",
        sql: "SELECT customer_state AS state, count(*) AS delivered,\n       avg((delivered_at <= estimated_at)::int) AS otd,\n       percentile_cont(0.5) WITHIN GROUP (ORDER BY days_total) AS median_days\nFROM delivered GROUP BY 1 ORDER BY otd",
        rows: states,
        chart: { type: "bar", title: "Доля доставок вовремя по штатам", x: "state", y: ["otd"] },
      },
      {
        name: "execute_sql",
        arguments: { sql: "SELECT … FROM core.orders WHERE delivered_at > estimated_at LIMIT 6" },
        sql: "SELECT o.order_id, o.customer_state AS state, o.purchased_at::date,\n       o.estimated_at::date - o.purchased_at::date AS promised_days,\n       o.delivered_at::date - o.purchased_at::date AS actual_days, r.score AS review_score\nFROM core.orders o JOIN core.reviews r USING (order_id)\nWHERE o.status = 'delivered' AND o.delivered_at > o.estimated_at\nORDER BY actual_days - promised_days DESC LIMIT 6",
        rows: lateOrders(6),
      },
    ],
    text: "Вовремя доставлено **93,2%** заказов (96 470 доставленных), медианный срок — 10,2 дня при обещанных 24.\n\nГлавные проблемы:\n\n1. **Север и северо-восток.** Хуже всего AL (78,6% вовремя), MA (82,6%) и SE (84,8%): медианная доставка 18–22 дня против 8–9 в SP.\n2. **Опоздание бьёт по оценкам.** При доставке вовремя средняя оценка 4,29, при опоздании на 4–7 дней — 2,10, а доля негативных отзывов растёт с 9% до 68%.\n3. **Пиковые месяцы.** В ноябре 2017 и феврале–марте 2018 доля доставок вовремя проседала до 85–88%.\n\nПо узким местам: этап перевозчика (медиана 7,1 дня) длиннее этапа продавца (1,8 дня) — начинать стоит с логистики в северные штаты.",
    details:
      "Источник: dashboard.states и dashboard.lateness; опоздание = delivered_at > estimated_at.",
  }
}

function paymentsVsRevenue(): Scenario {
  const rows: Row[] = [
    { component: "Цена товаров (выручка)", value: 13221498.11, share_pct: 85.73 },
    { component: "Доставка (freight)", value: 2196959.35, share_pct: 14.25 },
    { component: "Проценты по рассрочке и прочее", value: 4004.31, share_pct: 0.02 },
    { component: "Платежи по доставленным заказам", value: 15422461.77, share_pct: 100 },
  ]
  return {
    tools: [
      {
        name: "execute_sql",
        arguments: { sql: "SELECT sum(price), sum(freight_value), sum(payment_value) …" },
        sql: "WITH d AS (SELECT order_id FROM core.orders WHERE status = 'delivered')\nSELECT (SELECT sum(price) FROM core.order_items JOIN d USING (order_id)) AS revenue,\n       (SELECT sum(freight_value) FROM core.order_items JOIN d USING (order_id)) AS freight,\n       (SELECT sum(payment_value) FROM core.payments JOIN d USING (order_id)) AS payments",
        rows,
        chart: { type: "bar", title: "Платежи и выручка", x: "component", y: ["value"] },
      },
    ],
    text: `Платежи по доставленным заказам — **${money(15422461.77)} BRL**, выручка — **${money(13221498.11)} BRL**. Разница ${money(2200963.66)} BRL почти целиком объясняется доставкой:\n\n- **freight_value** — ${money(2196959.35)} BRL (14,2% платежей). Покупатель платит за доставку, но это не выручка магазина.\n- Оставшиеся ~4 тыс. BRL — проценты по рассрочке (кредитные карты до 24 платежей) и округления ваучеров.\n\nПоэтому средний чек (159,88 BRL) считается с доставкой, а выручка продавцов — без неё.`,
    details: "Сверка core.payments с core.order_items по заказам со статусом delivered.",
  }
}

function generic(message: string): Scenario {
  return {
    tools: [
      {
        name: "describe_dataset",
        arguments: {},
        sql: "SELECT status, count(*) AS orders, round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS share_pct FROM core.orders GROUP BY 1 ORDER BY 2 DESC",
        rows: [
          { status: "delivered", orders: 96478, share_pct: 97.02 },
          { status: "shipped", orders: 1107, share_pct: 1.11 },
          { status: "canceled", orders: 625, share_pct: 0.63 },
          { status: "unavailable", orders: 609, share_pct: 0.61 },
          { status: "invoiced", orders: 314, share_pct: 0.32 },
          { status: "processing", orders: 301, share_pct: 0.3 },
        ],
      },
    ],
    text: `Это демо-ответ в режиме моков: вопрос «${message.slice(0, 80)}» не распознан.\n\nВ данных Capibara 99 441 заказ за сентябрь 2016 — октябрь 2018, **97%** из них доставлены. Отзывы: 5★ — 57,8%, 4★ — 19,3%, 1★ — 11,5%; средняя оценка 4,16.\n\nПопробуйте спросить: «выручка по месяцам», «проблемы с доставкой» или «платежи vs выручка».`,
    details: "Мок-ответ: сценарий по умолчанию.",
  }
}

export function scenarioFor(message: string): Scenario {
  const text = message.toLowerCase()
  if (text.includes("платеж") || text.includes("платёж")) return paymentsVsRevenue()
  if (text.includes("доставк") || text.includes("опозд") || text.includes("срок"))
    return deliveryProblems()
  if (text.includes("выручк") || text.includes("продаж")) return revenueByMonth()
  return generic(message)
}
