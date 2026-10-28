-- ============================================================
-- Витрины mart поверх core — источник дашборда «Исполнение заказа».
-- core не меняется; витрины пересобираются с нуля, запускать можно
-- сколько угодно раз.
--
-- Порядок сборки решения:
--   build_core.sql → build_mart.sql → build_dashboard.py
--
-- Запуск:
--   docker exec -i hack_postgres psql -U hack -d marketplace \
--     < solution/build_mart.sql
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

DROP TABLE IF EXISTS mart.order_fulfillment;
DROP TABLE IF EXISTS mart.seller_shipment;

-- ------------------------------------------------------------
-- mart.order_fulfillment: 1 строка = 1 заказ, все заказы.
-- Основа — core.orders; агрегаты позиций и последний отзыв
-- присоединяются LEFT JOIN, поэтому число строк обязано
-- совпадать с core.orders (проверяется ниже).
--
-- Производные поля исполнения:
--   on_time      — вручён не позже обещанного; сравнение по датам,
--                  потому что обещание приходит без времени суток;
--   days_*       — длительности этапов в днях; этапы с нарушенной
--                  хронологией (отгрузка раньше подтверждения)
--                  становятся NULL и не портят медианы.
-- ------------------------------------------------------------
CREATE TABLE mart.order_fulfillment AS
WITH item_agg AS (
    SELECT order_id,
           count(*)                  AS units,          -- одна строка = одна единица
           count(DISTINCT seller_id) AS sellers_cnt,
           sum(price)                AS items_total,
           sum(freight_value)        AS freight_total
    FROM core.order_items
    GROUP BY order_id
),
review_agg AS (
    SELECT order_id, count(*) AS reviews_cnt
    FROM core.order_reviews
    GROUP BY order_id
),
last_review AS (
    -- отзывов на заказ бывает несколько: берём последний по времени
    SELECT DISTINCT ON (order_id) order_id, score AS last_review_score
    FROM core.order_reviews
    ORDER BY order_id, created_at DESC, answered_at DESC NULLS LAST
)
SELECT o.order_id,
       o.customer_unique_id,
       o.status,
       o.purchased_at,
       o.approved_at,
       o.shipped_at,
       o.delivered_at,
       o.estimated_delivery_date,
       o.customer_city,
       o.customer_state,
       (o.delivered_at::date <= o.estimated_delivery_date)         AS on_time,
       extract(epoch FROM o.delivered_at - o.purchased_at) / 86400 AS days_total,
       CASE WHEN o.shipped_at >= o.approved_at
            THEN extract(epoch FROM o.shipped_at - o.approved_at) / 86400 END AS days_seller,
       CASE WHEN o.delivered_at >= o.shipped_at
            THEN extract(epoch FROM o.delivered_at - o.shipped_at) / 86400 END AS days_carrier,
       coalesce(i.units, 0)         AS units,
       coalesce(i.sellers_cnt, 0)   AS sellers_cnt,
       coalesce(i.items_total, 0)   AS items_total,
       coalesce(i.freight_total, 0) AS freight_total,
       coalesce(r.reviews_cnt, 0)   AS reviews_cnt,
       lr.last_review_score
FROM core.orders o
LEFT JOIN item_agg    i  USING (order_id)
LEFT JOIN review_agg  r  USING (order_id)
LEFT JOIN last_review lr USING (order_id);

ALTER TABLE mart.order_fulfillment ADD PRIMARY KEY (order_id);
CREATE INDEX ON mart.order_fulfillment (status);
CREATE INDEX ON mart.order_fulfillment (purchased_at);

-- ------------------------------------------------------------
-- mart.seller_shipment: 1 строка = заказ × продавец, все пары.
-- Срок отгрузки пары — максимум shipping_limit_at по её позициям.
-- shipped_at в источнике один на весь заказ, поэтому рейтинг
-- отгрузки честно считается только по заказам с одним продавцом —
-- для этого флаг is_single_seller.
-- ------------------------------------------------------------
CREATE TABLE mart.seller_shipment AS
WITH pairs AS (
    SELECT order_id,
           seller_id,
           max(shipping_limit_at) AS shipping_limit_at,
           count(*)               AS units,
           sum(price)             AS items_total,
           sum(freight_value)     AS freight_total
    FROM core.order_items
    GROUP BY order_id, seller_id
)
SELECT p.order_id,
       p.seller_id,
       o.status,
       o.purchased_at,
       o.shipped_at,
       p.shipping_limit_at,
       p.units,
       p.items_total,
       p.freight_total,
       (count(*) OVER (PARTITION BY p.order_id) = 1) AS is_single_seller,
       CASE WHEN o.shipped_at IS NOT NULL
            THEN o.shipped_at <= p.shipping_limit_at END AS shipped_on_time
FROM pairs p
JOIN core.orders o USING (order_id);

ALTER TABLE mart.seller_shipment ADD PRIMARY KEY (order_id, seller_id);
CREATE INDEX ON mart.seller_shipment (seller_id);

COMMIT;

-- ------------------------------------------------------------
-- Сверка: витрины ничего не потеряли и не размножили.
-- ------------------------------------------------------------
DO $$
DECLARE
    orders_core  bigint := (SELECT count(*) FROM core.orders);
    orders_mart  bigint := (SELECT count(*) FROM mart.order_fulfillment);
    pairs_core   bigint := (SELECT count(*) FROM (SELECT DISTINCT order_id, seller_id FROM core.order_items) x);
    pairs_mart   bigint := (SELECT count(*) FROM mart.seller_shipment);
    money_core   numeric := (SELECT sum(price) FROM core.order_items);
    money_mart   numeric := (SELECT sum(items_total) FROM mart.order_fulfillment);
BEGIN
    IF orders_mart <> orders_core THEN
        RAISE EXCEPTION 'order_fulfillment: % строк вместо % (core.orders)', orders_mart, orders_core;
    END IF;
    IF pairs_mart <> pairs_core THEN
        RAISE EXCEPTION 'seller_shipment: % строк вместо % пар заказ×продавец', pairs_mart, pairs_core;
    END IF;
    IF money_mart <> money_core THEN
        RAISE EXCEPTION 'сумма товаров разошлась: % в витрине против % в core', money_mart, money_core;
    END IF;
END $$;

SELECT t, core, mart
FROM (
    SELECT 1 AS n, 'заказов' AS t,
           (SELECT count(*) FROM core.orders)::text AS core,
           (SELECT count(*) FROM mart.order_fulfillment)::text AS mart
    UNION ALL
    SELECT 2, 'пар заказ × продавец',
           (SELECT count(*) FROM (SELECT DISTINCT order_id, seller_id FROM core.order_items) x)::text,
           (SELECT count(*) FROM mart.seller_shipment)::text
    UNION ALL
    SELECT 3, 'сумма товаров',
           (SELECT sum(price) FROM core.order_items)::text,
           (SELECT sum(items_total) FROM mart.order_fulfillment)::text
) s ORDER BY n;
