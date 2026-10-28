-- ============================================================
-- Эталонная модель core для кейса «От корзины до выкупа»
-- Собирается из raw с нуля: запускать можно сколько угодно раз.
--   docker exec -i hack_postgres psql -U hack -d marketplace \
--     -v ON_ERROR_STOP=1 < solution/build_core.sql
--
-- Словарь конструкций — для тех, кто видит SQL впервые.
-- Все они повторяются по файлу, поэтому объяснены один раз здесь:
--
--   BEGIN; … COMMIT;     — транзакция: всё между ними применяется целиком
--                          или, при любой ошибке, не применяется вовсе.
--                          Наполовину собранной модели не бывает.
--   DROP SCHEMA … CASCADE — снести схему со всем содержимым (CASCADE =
--                          «и всё, что в ней»). Так скрипт каждый раз
--                          начинает с чистого листа — пересборка с нуля.
--   CREATE TABLE         — создать таблицу: имя, список колонок, у каждой
--                          колонки тип (text — строка, int — целое,
--                          numeric(10,2) — число с 2 знаками после запятой
--                          для денег, timestamp — дата со временем).
--   PRIMARY KEY (PK)     — первичный ключ: колонка (или пара колонок),
--                          значение которой однозначно определяет строку.
--                          База сама не даст вставить дубль.
--   REFERENCES таблица   — внешний ключ (FK): значение колонки обязано
--                          существовать в той таблице. Позицию с несуществующим
--                          product_id база не примет — связи не «провиснут».
--   NOT NULL             — пустое значение в колонке запрещено.
--   CHECK (условие)      — правило, которое база проверяет при каждой
--                          вставке: статус только из списка, оценка 1–5,
--                          цена >= 0. Мусор не запишется молча.
--   INSERT INTO … SELECT — наполнить таблицу результатом запроса:
--                          читаем из raw, преобразуем, кладём в core.
--   NULLIF(trim(x), '')  — trim обрезает пробелы по краям; NULLIF(a, b)
--                          возвращает NULL, если a = b. Вместе: пустая
--                          строка из CSV превращается в NULL («значения
--                          нет»), а не в пустой текст.
--   ::тип                — приведение типа: '2017-05-14'::timestamp —
--                          текст становится датой. Упадёт с ошибкой на
--                          мусоре — и это хорошо: увидим, где грязь.
--   LEFT JOIN            — приклеить строки другой таблицы по условию,
--                          НЕ выбрасывая строки без пары (обычный JOIN
--                          выбрасывает — это главный источник потерь).
--   DISTINCT ON (k) … ORDER BY k, t DESC — постгресовский приём «одна
--                          строка на ключ»: из всех строк покупателя
--                          остаётся первая по сортировке, т.е. самая
--                          свежая (t DESC — время по убыванию).
--   CREATE INDEX         — индекс: ускоряет поиск и соединения по колонке;
--                          на цифры в отчётах не влияет, только на скорость.
-- ============================================================

BEGIN;

DROP SCHEMA IF EXISTS core CASCADE;
CREATE SCHEMA core;

-- ------------------------------------------------------------
-- 1. Справочник категорий
--    Файл переводов — raw.product_category_translation (71 строка):
--    справочник «категория по-португальски → по-английски», приехал
--    отдельным CSV. Названия категорий в товарах португальские
--    (beleza_saude и т.п.), перевод нужен только для читаемости отчётов.
--
--    В товарах категорий 73, в файле переводов — 71: у pc_gamer и
--    portateis_cozinha_e_preparadores_de_alimentos перевода нет.
--    Если собрать справочник ИЗ файла переводов и соединять товары
--    с ним через INNER JOIN, товары этих двух категорий выпадут из
--    любого отчёта по категориям — выручка потеряется молча.
--    Поэтому источник справочника — сами товары (полный список),
--    а перевод — необязательный атрибут (NULL у этих двух).
-- ------------------------------------------------------------
CREATE TABLE core.product_categories (
    category_name    text PRIMARY KEY,   -- португальское имя, как в источнике
    category_name_en text                -- NULL у категорий без перевода
);

INSERT INTO core.product_categories
SELECT DISTINCT
    p.product_category_name,
    t.product_category_name_english
FROM raw.products p
LEFT JOIN raw.product_category_translation t
       ON t.product_category_name = p.product_category_name
WHERE NULLIF(trim(p.product_category_name), '') IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Товары
-- ------------------------------------------------------------
CREATE TABLE core.products (
    product_id         text PRIMARY KEY,
    category_name      text REFERENCES core.product_categories,  -- NULL = категория не заполнена
    name_length        int,
    description_length int,
    photos_qty         int,
    weight_g           int,
    length_cm          int,
    height_cm          int,
    width_cm           int
);

INSERT INTO core.products
SELECT
    product_id,
    NULLIF(trim(product_category_name), ''),
    NULLIF(trim(product_name_lenght), '')::int,          -- опечатка lenght — в источнике
    NULLIF(trim(product_description_lenght), '')::int,
    NULLIF(trim(product_photos_qty), '')::int,
    NULLIF(trim(product_weight_g), '')::int,
    NULLIF(trim(product_length_cm), '')::int,
    NULLIF(trim(product_height_cm), '')::int,
    NULLIF(trim(product_width_cm), '')::int
FROM raw.products;

-- ------------------------------------------------------------
-- 3. Продавцы
-- ------------------------------------------------------------
CREATE TABLE core.sellers (
    seller_id       text PRIMARY KEY,
    zip_code_prefix text,
    city            text,
    state           text
);

INSERT INTO core.sellers
SELECT seller_id, seller_zip_code_prefix, seller_city, seller_state
FROM raw.sellers;

-- ------------------------------------------------------------
-- 4. Покупатели
--    Человек = customer_unique_id. customer_id в источнике — это
--    «учётка одного заказа»: на каждый заказ своя, ключом быть не может.
--    Здесь — АКТУАЛЬНАЯ география (по последнему заказу): «где
--    покупатель сейчас». География на момент каждого заказа хранится
--    в core.orders — исторические отчёты по регионам считать оттуда.
-- ------------------------------------------------------------
CREATE TABLE core.customers (
    customer_unique_id text PRIMARY KEY,
    zip_code_prefix    text,
    city               text,
    state              text
);

INSERT INTO core.customers
SELECT DISTINCT ON (c.customer_unique_id)
    c.customer_unique_id,
    c.customer_zip_code_prefix,
    c.customer_city,
    c.customer_state
FROM raw.customers c
JOIN raw.orders o USING (customer_id)
ORDER BY c.customer_unique_id, o.order_purchase_timestamp DESC;

-- ------------------------------------------------------------
-- 5. Заказы
--    customer_id сохраняем как атрибут-ссылку на источник,
--    аналитика по людям ходит по customer_unique_id.
--    География покупателя (город/штат/индекс) — СНИМОК на момент
--    заказа: в raw.customers строка 1:1 с заказом, так что это
--    атрибут заказа. core.customers при соединении отдал бы всем
--    старым заказам последний адрес человека и исказил бы
--    исторические продажи по регионам.
-- ------------------------------------------------------------
CREATE TABLE core.orders (
    order_id                 text PRIMARY KEY,
    customer_unique_id       text NOT NULL REFERENCES core.customers,
    customer_id              text NOT NULL,                -- id учётки из источника
    status                   text NOT NULL CHECK (status IN
        ('created','approved','invoiced','processing',
         'shipped','delivered','canceled','unavailable')),
    purchased_at             timestamp NOT NULL,
    approved_at              timestamp,
    shipped_at               timestamp,                    -- передан в доставку
    delivered_at             timestamp,                    -- вручён покупателю
    estimated_delivery_date  date,                         -- обещано при оформлении
    customer_zip_code_prefix text,                         -- география на момент заказа
    customer_city            text,
    customer_state           text
);

INSERT INTO core.orders
SELECT
    o.order_id,
    c.customer_unique_id,
    o.customer_id,
    o.order_status,
    o.order_purchase_timestamp::timestamp,
    NULLIF(trim(o.order_approved_at), '')::timestamp,
    NULLIF(trim(o.order_delivered_carrier_date), '')::timestamp,
    NULLIF(trim(o.order_delivered_customer_date), '')::timestamp,
    NULLIF(trim(o.order_estimated_delivery_date), '')::date,
    c.customer_zip_code_prefix,
    c.customer_city,
    c.customer_state
FROM raw.orders o
JOIN raw.customers c USING (customer_id);

CREATE INDEX ON core.orders (customer_unique_id);
CREATE INDEX ON core.orders (status);
CREATE INDEX ON core.orders (purchased_at);

-- ------------------------------------------------------------
-- 6. Позиции заказов
--    item_no — порядковый номер строки внутри заказа, не идентификатор.
-- ------------------------------------------------------------
CREATE TABLE core.order_items (
    order_id          text NOT NULL REFERENCES core.orders,
    item_no           int  NOT NULL,
    product_id        text NOT NULL REFERENCES core.products,
    seller_id         text NOT NULL REFERENCES core.sellers,
    shipping_limit_at timestamp NOT NULL,    -- крайний срок отгрузки продавцом
    price             numeric(10,2) NOT NULL CHECK (price >= 0),
    freight_value     numeric(10,2) NOT NULL CHECK (freight_value >= 0),
    PRIMARY KEY (order_id, item_no)
);

INSERT INTO core.order_items
SELECT
    order_id,
    order_item_id::int,
    product_id,
    seller_id,
    shipping_limit_date::timestamp,
    price::numeric,
    freight_value::numeric
FROM raw.order_items;

CREATE INDEX ON core.order_items (product_id);
CREATE INDEX ON core.order_items (seller_id);

-- ------------------------------------------------------------
-- 7. Платежи
-- ------------------------------------------------------------
CREATE TABLE core.order_payments (
    order_id     text NOT NULL REFERENCES core.orders,
    payment_no   int  NOT NULL,                -- payment_sequential источника
    payment_type text NOT NULL,
    installments int  NOT NULL,                -- частей рассрочки
    amount       numeric(10,2) NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (order_id, payment_no)
);

INSERT INTO core.order_payments
SELECT
    order_id,
    payment_sequential::int,
    payment_type,
    payment_installments::int,
    payment_value::numeric
FROM raw.order_payments;

-- ------------------------------------------------------------
-- 8. Отзывы
--    review_id в источнике не уникален: один отзыв может висеть
--    на нескольких заказах. Ключ — пара (review_id, order_id).
-- ------------------------------------------------------------
CREATE TABLE core.order_reviews (
    review_id   text NOT NULL,
    order_id    text NOT NULL REFERENCES core.orders,
    score       smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
    title       text,
    message     text,
    created_at  timestamp NOT NULL,
    answered_at timestamp,
    PRIMARY KEY (review_id, order_id)
);

INSERT INTO core.order_reviews
SELECT
    review_id,
    order_id,
    review_score::smallint,
    NULLIF(trim(review_comment_title), ''),
    NULLIF(trim(review_comment_message), ''),
    review_creation_date::timestamp,
    NULLIF(trim(review_answer_timestamp), '')::timestamp
FROM raw.order_reviews;

CREATE INDEX ON core.order_reviews (order_id);

COMMIT;

-- ------------------------------------------------------------
-- Сверка: ничего не потеряли при переносе
-- ------------------------------------------------------------
SELECT 'orders'         AS t, (SELECT count(*) FROM raw.orders)         AS raw, (SELECT count(*) FROM core.orders)         AS core
UNION ALL
SELECT 'order_items',        (SELECT count(*) FROM raw.order_items),        (SELECT count(*) FROM core.order_items)
UNION ALL
SELECT 'order_payments',     (SELECT count(*) FROM raw.order_payments),     (SELECT count(*) FROM core.order_payments)
UNION ALL
SELECT 'order_reviews',      (SELECT count(*) FROM raw.order_reviews),      (SELECT count(*) FROM core.order_reviews)
UNION ALL
SELECT 'products',           (SELECT count(*) FROM raw.products),           (SELECT count(*) FROM core.products)
UNION ALL
SELECT 'sellers',            (SELECT count(*) FROM raw.sellers),            (SELECT count(*) FROM core.sellers)
UNION ALL
SELECT 'customers (люди)',   (SELECT count(DISTINCT customer_unique_id) FROM raw.customers),
                             (SELECT count(*) FROM core.customers);
