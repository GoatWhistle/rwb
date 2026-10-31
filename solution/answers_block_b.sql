-- ============================================================
-- Ответы, блок Б
-- Определения общие с блоком А и каталогом метрик (backend/catalog):
--   доставлен        — status = 'delivered' и есть delivered_at
--                      (у 8 доставленных даты вручения нет — они
--                      выпадают из сроков, а не дают ноль дней);
--   дней доставки    — от оформления до вручения, дробное число:
--                      (delivered_at - purchased_at) в секундах / 86400;
--   опоздание        — вручён позже обещанного; сравнение по датам,
--                      обещание приходит без времени суток;
--   штат покупателя  — снимок в заказе на момент покупки (вброс:
--                      покупатель мог переехать, заказ — нет).
--
-- Конструкции, разобранные в answers_block_a.sql, здесь не
-- повторяются; новые объяснены при первом появлении.
--
-- Запуск:
--   docker exec -i hack_postgres psql -U hack -d marketplace \
--     < solution/answers_block_b.sql
-- ============================================================

\echo
\echo '=== 6. Как менялась цена одного товара ==='

-- ------------------------------------------------------------
-- Проданной считаем позицию любого заказа, кроме отменённых и
-- недоступных: цена — свойство предложения, ей не важно, вручён
-- ли уже заказ. На выбор товара фильтр не влияет: у лидера
-- 31 разная цена при любом наборе статусов, следующий — 29.
-- Товар 437c05a3…, beleza_saude, февраль — август 2018. Продают
-- его три продавца, поэтому в 5 днях из 71 цен несколько —
-- каждая отдельной строкой.
--
-- Разбор по словам:
--   ORDER BY count(DISTINCT price) DESC, product_id LIMIT 1 — лидер
--                          по числу разных цен; product_id вторым
--                          ключом — на случай ничьей ответ не «прыгает»
--                          от запуска к запуску.
--   purchased_at::date    — день заказа без времени: история по дням.
-- ------------------------------------------------------------
WITH sold AS (
    SELECT i.product_id, i.price, o.purchased_at
    FROM core.order_items i
    JOIN core.orders o USING (order_id)
    WHERE o.status NOT IN ('canceled', 'unavailable')
),
top_product AS (
    SELECT product_id
    FROM sold
    GROUP BY product_id
    ORDER BY count(DISTINCT price) DESC, product_id
    LIMIT 1
)
SELECT
    s.purchased_at::date AS day,
    s.price,
    count(*)             AS units_sold   -- одна строка = одна единица
FROM sold s
JOIN top_product USING (product_id)
GROUP BY 1, 2
ORDER BY 1, 2;

\echo
\echo '=== 7. Доставка по штатам покупателя ==='

-- ------------------------------------------------------------
-- Порог 500 — по доставленным заказам: на них считаются обе
-- метрики, и все три числа строки стоят на одной базе. Набор
-- штатов от выбора не зависит: по всем заказам граница проходит
-- между PB (536) и PI (495), по доставленным — между PB (517)
-- и PI (476). В отчёте 17 штатов из 27.
--
-- Разбор по словам:
--   extract(epoch FROM a - b) / 86400 — разность дат в секундах
--                          (epoch), делённая на секунды в сутках:
--                          длительность в днях с дробной частью.
--   avg((условие)::int)   — булево true/false как 1/0; среднее
--                          единиц и нулей = доля строк, где условие
--                          истинно.
--   HAVING count(*) >= 500 — фильтр ПОСЛЕ группировки: WHERE отбирает
--                          строки, HAVING — готовые группы.
-- ------------------------------------------------------------
SELECT
    customer_state                                                       AS state,
    count(*)                                                             AS orders_cnt,
    round(avg(extract(epoch FROM delivered_at - purchased_at) / 86400), 2) AS avg_delivery_days,
    round(100 * avg((delivered_at::date > estimated_delivery_date)::int), 2) AS late_pct
FROM core.orders
WHERE status = 'delivered'
  AND delivered_at IS NOT NULL
GROUP BY customer_state
HAVING count(*) >= 500
ORDER BY orders_cnt DESC;

\echo
\echo '=== 8. Воронка статусов ==='

-- ------------------------------------------------------------
-- Все 99 441 заказ, без фильтров. «Без позиций» — заказ, у
-- которого нет ни одной строки в order_items (775 штук; почти все —
-- unavailable и canceled, но есть и в других статусах).
--
-- Разбор по словам:
--   NOT EXISTS (SELECT 1 FROM … WHERE …) — «для заказа не нашлось ни
--                          одной позиции». Не размножает заказы, как
--                          JOIN, — проверка да/нет на каждый заказ.
--   sum(count(*)) OVER () — итог по всем группам рядом с каждой
--                          (оконная функция, как в вопросе 5).
-- ------------------------------------------------------------
SELECT
    status,
    count(*)                                              AS orders_cnt,
    round(100.0 * count(*) / sum(count(*)) OVER (), 2)    AS orders_pct,
    count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM core.order_items i WHERE i.order_id = o.order_id
    ))                                                    AS without_items
FROM core.orders o
GROUP BY status
ORDER BY orders_cnt DESC;

\echo
\echo '=== 9. Способы оплаты и рассрочка ==='

-- ------------------------------------------------------------
-- Единица — платёж (строка order_payments), не заказ: заказ бывает
-- оплачен в несколько приёмов, например картой и ваучером.
-- Берём все платежи, без фильтра по статусу: вопрос про то, как
-- платят, а не про выручку. 2018 год — по дате оформления заказа.
-- «Срок рассрочки» — число частей (installments). У двух платежей
-- картой там 0 — ошибка источника, оставлены как есть: на среднее
-- влияют в четвёртом знаке.
--
-- Разбор по словам:
--   purchased_at >= '2018-01-01' AND purchased_at < '2019-01-01' —
--                          полуоткрытый интервал года: 31 декабря
--                          23:59 входит, а индекс по дате работает
--                          (с extract(year …) он бы не помог).
-- ------------------------------------------------------------

-- 9а. По штатам покупателя, 2018 год
--   card_pct / boleto_pct / voucher_pct / debit_pct — доля платежей
--                          штата этим способом, в процентах;
--   installment_pct       — доля платежей в рассрочку (installments > 1)
--                          среди всех платежей штата.
SELECT
    o.customer_state           AS state,
    count(*)                   AS payments_cnt,
    sum(p.amount)              AS amount,
    round(avg(p.installments), 2) AS avg_installments,
    round(100 * avg((p.payment_type = 'credit_card')::int), 2) AS card_pct,
    round(100 * avg((p.payment_type = 'boleto')::int), 2)      AS boleto_pct,
    round(100 * avg((p.payment_type = 'voucher')::int), 2)     AS voucher_pct,
    round(100 * avg((p.payment_type = 'debit_card')::int), 2)  AS debit_pct,
    round(100 * avg((p.installments > 1)::int), 2)             AS installment_pct
FROM core.order_payments p
JOIN core.orders o USING (order_id)
WHERE o.purchased_at >= '2018-01-01'
  AND o.purchased_at <  '2019-01-01'
GROUP BY o.customer_state
ORDER BY amount DESC;

-- 9б. По способам оплаты, весь период
SELECT
    payment_type,
    count(*)                      AS payments_cnt,
    sum(amount)                   AS amount,
    round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS payments_pct,
    round(avg(installments), 2)   AS avg_installments,
    max(installments)             AS max_installments
FROM core.order_payments
GROUP BY payment_type
ORDER BY payments_cnt DESC;

\echo
\echo '=== 10. Оценка покупателя и срок доставки ==='

-- ------------------------------------------------------------
-- Только доставленные заказы: у недоставленного нет срока
-- доставки, и все три числа строки должны стоять на одной базе.
-- 2 849 заказов с отзывом, но без вручения, сюда не входят.
-- Отзывов на заказ бывает несколько (547 заказов), и в 202 оценки
-- расходятся — берём последний по времени, как в метриках
-- дашборда (os.kpi_monthly, dc.*). Иначе заказ попал бы в две оценки сразу.
--
-- Разбор по словам:
--   generate_series(1, 5) … LEFT JOIN — все пять оценок в отчёте,
--                          даже если какая-то окажется пустой.
--   DISTINCT ON (order_id) … ORDER BY order_id, created_at DESC — одна
--                          строка на заказ: самый свежий отзыв.
-- ------------------------------------------------------------
WITH last_review AS (
    SELECT DISTINCT ON (order_id) order_id, score
    FROM core.order_reviews
    ORDER BY order_id, created_at DESC, answered_at DESC NULLS LAST
),
per_score AS (
    SELECT
        r.score,
        count(*)                                                       AS orders_cnt,
        avg(extract(epoch FROM o.delivered_at - o.purchased_at) / 86400) AS avg_days,
        avg((o.delivered_at::date > o.estimated_delivery_date)::int)    AS late_share
    FROM last_review r
    JOIN core.orders o USING (order_id)
    WHERE o.status = 'delivered'
      AND o.delivered_at IS NOT NULL
    GROUP BY r.score
)
SELECT
    s.score,
    coalesce(p.orders_cnt, 0)     AS orders_cnt,
    round(p.avg_days, 2)          AS avg_delivery_days,
    round(100 * p.late_share, 2)  AS late_pct
FROM generate_series(1, 5) AS s(score)
LEFT JOIN per_score p USING (score)
ORDER BY s.score;
