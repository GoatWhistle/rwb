-- ============================================================
-- Копия answers_block_a.sql для сверки с контрольными цифрами.
-- После каждого ответа: строка-свод (факт из базы) и контроль
-- из docs/tasks.md — сравниваются глазами.
-- Учебные разборы по словам здесь опущены, см. оригинальный файл.
--
-- Запуск:
--   docker exec -i hack_postgres psql -U hack -d marketplace \
--     < solution/answers_block_a_check.sql
-- ============================================================

\echo
\echo '=== 1. Выручка и число заказов по месяцам ==='

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

-- свод: те же строки, свёрнутые в одну
WITH months AS (
    SELECT generate_series('2016-09-01'::date, '2018-08-01', interval '1 month')::date AS month
),
monthly AS (
    SELECT
        date_trunc('month', o.purchased_at)::date AS month,
        coalesce(sum(i.price) FILTER (WHERE o.status = 'delivered'), 0) AS revenue
    FROM core.orders o
    LEFT JOIN core.order_items i USING (order_id)
    GROUP BY 1
)
SELECT
    count(*)                                         AS rows_total,
    count(*) FILTER (WHERE coalesce(revenue, 0) = 0) AS rows_zero_revenue,
    sum(coalesce(revenue, 0))                        AS revenue_total
FROM months m
LEFT JOIN monthly t USING (month);

\echo 'КОНТРОЛЬ: 24 строки, одна из них с нулевой выручкой, итого 13 221 498.11'

\echo
\echo '=== 2. Топ-10 продавцов по выручке ==='

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

\echo 'КОНТРОЛЬ: у первого продавца 226 987.93 (первая строка таблицы выше)'

\echo
\echo '=== 3. Средний чек заказа ==='

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

\echo 'КОНТРОЛЬ: 159.88 (неверные уровни дали бы ~120 без доставки / 139.97 с доставкой)'

\echo
\echo '=== 4. Покупатели и повторные покупки ==='

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

\echo 'КОНТРОЛЬ: 96 096 покупателей, вернулись 3.12% (ключ customer_id дал бы 99 441)'

\echo
\echo '=== 5. Выручка по категориям ==='

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

-- свод: 74 строки выше, свёрнутые в одну
WITH cat AS (
    SELECT
        coalesce(p.category_name, '(без категории)') AS category,
        sum(i.price)                                 AS revenue
    FROM core.order_items i
    JOIN core.orders   o USING (order_id)
    JOIN core.products p USING (product_id)
    WHERE o.status = 'delivered'
    GROUP BY 1
)
SELECT
    count(*)     AS categories,
    max(revenue) AS top_revenue,
    sum(revenue) AS revenue_total
FROM cat;

\echo 'КОНТРОЛЬ: 74 категории, у крупнейшей 1 233 131.72, сумма по всем 13 221 498.11 (= итог №1)'
\echo
