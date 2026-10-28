-- ============================================================
-- Эталонные ответы, блок А
-- Выручка = sum(price) по заказам со статусом delivered.
-- Доставка (freight) выручкой площадки не считается,
-- но входит в чек покупателя (вопрос 3).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Выручка и число заказов по месяцам, сен 2016 — авг 2018
--    Календарь генерируем: ноябрь 2016 пуст и без generate_series
--    выпадет из отчёта. Контроль: 24 строки, итого 13 221 498.11
-- ------------------------------------------------------------
WITH months AS (
    SELECT generate_series('2016-09-01'::date, '2018-08-01', interval '1 month')::date AS month
),
monthly AS (
    SELECT
        date_trunc('month', o.purchased_at)::date AS month,
        count(DISTINCT o.order_id)                AS orders_cnt,
        coalesce(sum(i.price) FILTER (WHERE o.status = 'delivered'), 0) AS revenue
    FROM core.orders o
    LEFT JOIN core.order_items i USING (order_id)
    GROUP BY 1
)
SELECT
    m.month,
    coalesce(t.orders_cnt, 0) AS orders_cnt,
    coalesce(t.revenue, 0)    AS revenue
FROM months m
LEFT JOIN monthly t USING (month)
ORDER BY m.month;

-- ------------------------------------------------------------
-- 2. Топ-10 продавцов по выручке
--    Контроль: у первого 226 987.93
-- ------------------------------------------------------------
SELECT
    s.seller_id,
    s.city,
    s.state,
    count(DISTINCT i.order_id) AS orders_cnt,
    count(*)                   AS units,
    sum(i.price)               AS revenue
FROM core.order_items i
JOIN core.orders  o USING (order_id)
JOIN core.sellers s USING (seller_id)
WHERE o.status = 'delivered'
GROUP BY s.seller_id, s.city, s.state
ORDER BY revenue DESC
LIMIT 10;

-- ------------------------------------------------------------
-- 3. Средний чек заказа
--    Чек — свойство заказа: сначала сумма по заказу, потом среднее.
--    Контроль: 159.88
-- ------------------------------------------------------------
WITH per_order AS (
    SELECT
        i.order_id,
        sum(i.price + i.freight_value) AS order_total,
        count(*)                       AS lines,
        count(*)                       AS units   -- одна строка = одна единица
    FROM core.order_items i
    JOIN core.orders o USING (order_id)
    WHERE o.status = 'delivered'
    GROUP BY i.order_id
)
SELECT
    round(avg(order_total), 2) AS avg_check,
    round(avg(lines), 2)       AS avg_lines_per_order,
    round(avg(units), 2)       AS avg_units_per_order
FROM per_order;

-- ------------------------------------------------------------
-- 4. Покупатели и повторные покупки
--    Человек = customer_unique_id, не customer_id.
--    Контроль: 96 096 покупателей, вернулись 3.12%
-- ------------------------------------------------------------
WITH per_customer AS (
    SELECT customer_unique_id, count(*) AS orders_cnt
    FROM core.orders
    GROUP BY 1
)
SELECT
    count(*)                                   AS customers_total,
    count(*) FILTER (WHERE orders_cnt >= 2)    AS returned,
    round(100.0 * count(*) FILTER (WHERE orders_cnt >= 2) / count(*), 2) AS returned_pct
FROM per_customer;

-- ------------------------------------------------------------
-- 5. Выручка по категориям
--    Товары без категории не выбрасываем — отдельная строка,
--    иначе сумма не сойдётся с общей выручкой.
--    Контроль: 74 категории, топ 1 233 131.72, итого 13 221 498.11
-- ------------------------------------------------------------
SELECT
    coalesce(p.category_name, '(без категории)') AS category,
    sum(i.price)                                 AS revenue,
    round(100 * sum(i.price) / sum(sum(i.price)) OVER (), 2) AS revenue_pct
FROM core.order_items i
JOIN core.orders   o USING (order_id)
JOIN core.products p USING (product_id)
WHERE o.status = 'delivered'
GROUP BY 1
ORDER BY revenue DESC;
