#!/usr/bin/env python3
"""
Данные для дашборда «Исполнение заказа» (solution/dashboard.html).

Считает показатели из витрин mart (solution/build_mart.sql) и вписывает
их в блок <script id="dash-data"> внутри dashboard.html. Сам HTML
не зависит от базы и интернета: открывается двойным кликом.

Запуск из корня проекта, после build_core.sql и build_mart.sql:
    python solution/build_dashboard.py

Другая база:
    python solution/build_dashboard.py --host localhost --port 5433
"""

import argparse
import datetime
import json
import pathlib
import re
import sys

try:
    import psycopg2
except ImportError:
    sys.exit("Нет psycopg2. Поставьте:  pip install psycopg2-binary")

HTML = pathlib.Path(__file__).with_name("dashboard.html")

# Общая база всех показателей — срезы двух витрин mart:
#   d  — доставленные заказы с датой вручения, оформленные до конца
#        августа 2018 (в сентябре–октябре в выгрузке только отмены);
#        on_time и длительности этапов уже посчитаны в витрине;
#   os — отгрузки: пары заказ × продавец из заказов с одним
#        продавцом (shipped_at в источнике один на весь заказ).
BASE = """
CREATE TEMP VIEW d AS
SELECT *
FROM mart.order_fulfillment
WHERE status = 'delivered'
  AND delivered_at IS NOT NULL
  AND purchased_at < '2018-09-01';

CREATE TEMP VIEW os AS
SELECT order_id, seller_id, shipping_limit_at AS lim, shipped_at
FROM mart.seller_shipment
WHERE shipped_at IS NOT NULL
  AND purchased_at < '2018-09-01'
  AND is_single_seller;
"""

QUERIES = {
    "kpi": """
SELECT json_build_object(
  'orders',          (SELECT count(*) FROM mart.order_fulfillment WHERE purchased_at < '2018-09-01'),
  'delivered',       (SELECT count(*) FROM d),
  'otd',             (SELECT round(avg(on_time::int), 4) FROM d),
  'otd_naive',       (SELECT round(avg((delivered_at <= estimated_delivery_date)::int), 4) FROM d),
  'on_promise_day',  (SELECT count(*) FROM d WHERE delivered_at::date = estimated_delivery_date),
  'median_days',     (SELECT round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_total)::numeric, 1) FROM d),
  'p90_days',        (SELECT round(percentile_cont(.9) WITHIN GROUP (ORDER BY days_total)::numeric, 1) FROM d),
  'median_promised', (SELECT round(percentile_cont(.5) WITHIN GROUP (ORDER BY estimated_delivery_date - purchased_at::date)::numeric, 1) FROM d),
  'median_approve',  (SELECT round(percentile_cont(.5) WITHIN GROUP (ORDER BY extract(epoch FROM approved_at - purchased_at) / 86400)::numeric, 2) FROM d),
  'median_seller',   (SELECT round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_seller)::numeric, 1) FROM d),
  'median_carrier',  (SELECT round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_carrier)::numeric, 1) FROM d),
  'cancel_rate',     (SELECT round(avg((status IN ('canceled', 'unavailable'))::int), 4) FROM mart.order_fulfillment WHERE purchased_at < '2018-09-01'),
  'stuck',           (SELECT count(*) FROM mart.order_fulfillment WHERE status = 'shipped'
                        AND estimated_delivery_date < (SELECT max(purchased_at)::date FROM mart.order_fulfillment)),
  'avg_score',       (SELECT round(avg(last_review_score), 2) FROM d WHERE last_review_score IS NOT NULL),
  'seller_on_time',  (SELECT round(avg((shipped_at <= lim)::int), 4) FROM os),
  'seller_pairs',    (SELECT count(*) FROM os),
  'sellers_100plus', (SELECT count(*) FROM (SELECT seller_id FROM os GROUP BY 1 HAVING count(*) >= 100) z)
)""",
    # Цифры для раздела «Правила»: каждое правило подкреплено счётчиком.
    # Дубли отзывов и их даты витрина не хранит (в ней только последний
    # отзыв), поэтому три последних счётчика идут в core.order_reviews.
    "checks": """
SELECT json_build_object(
  'orders_with_items',       (SELECT count(*) FROM mart.order_fulfillment WHERE units > 0),
  'orders_without_items',    (SELECT count(*) FROM mart.order_fulfillment WHERE units = 0),
  'multi_seller_orders',     (SELECT count(*) FROM mart.order_fulfillment WHERE sellers_cnt > 1),
  'order_seller_pairs',      (SELECT count(*) FROM mart.seller_shipment),
  'multi_review_orders',     (SELECT count(*) FROM mart.order_fulfillment WHERE reviews_cnt > 1),
  'diff_score_orders',       (SELECT count(*) FROM (SELECT order_id FROM core.order_reviews
                                GROUP BY 1 HAVING count(DISTINCT score) > 1) x),
  'no_review_orders',        (SELECT count(*) FROM mart.order_fulfillment WHERE reviews_cnt = 0),
  'shipped_before_approved', (SELECT count(*) FROM mart.order_fulfillment WHERE shipped_at < approved_at),
  'shipped_before_purchase', (SELECT count(*) FROM mart.order_fulfillment WHERE shipped_at < purchased_at),
  'delivered_no_date',       (SELECT count(*) FROM mart.order_fulfillment WHERE status = 'delivered' AND delivered_at IS NULL),
  'tail_orders',             (SELECT count(*) FROM mart.order_fulfillment WHERE purchased_at >= '2018-09-01'),
  'tail_canceled',           (SELECT count(*) FROM mart.order_fulfillment WHERE purchased_at >= '2018-09-01' AND status = 'canceled'),
  'review_before_delivery',  (SELECT count(*) FROM core.order_reviews r JOIN mart.order_fulfillment f USING (order_id)
                                WHERE f.delivered_at IS NOT NULL AND r.created_at < f.delivered_at::date)
)""",
    "monthly": """
SELECT json_agg(t ORDER BY month) FROM (
  SELECT to_char(date_trunc('month', purchased_at), 'YYYY-MM') AS month,
         count(*) AS delivered,
         round(avg(on_time::int), 4) AS otd,
         round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_total)::numeric, 1)   AS median_days,
         round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_seller)::numeric, 1)  AS median_seller,
         round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_carrier)::numeric, 1) AS median_carrier
  FROM d WHERE purchased_at >= '2017-01-01' GROUP BY 1) t""",
    "states": """
SELECT json_agg(t ORDER BY otd) FROM (
  SELECT customer_state AS state,
         count(*) AS delivered,
         round(avg(on_time::int), 4) AS otd,
         round(percentile_cont(.5) WITHIN GROUP (ORDER BY days_total)::numeric, 1) AS median_days,
         round(percentile_cont(.5) WITHIN GROUP (ORDER BY estimated_delivery_date - purchased_at::date)::numeric, 1) AS median_promised
  FROM d GROUP BY 1) t""",
    "lateness": """
SELECT json_agg(t ORDER BY ord) FROM (
  SELECT ord,
         (ARRAY['Вовремя', '1–3 дня', '4–7 дней', '8–14 дней', '15+ дней'])[ord] AS bucket,
         count(*) AS reviews,
         round(avg(score), 2) AS avg_score,
         round(avg((score <= 2)::int), 4) AS neg_share
  FROM (SELECT last_review_score AS score,
               CASE WHEN delivered_at::date - estimated_delivery_date <= 0  THEN 1
                    WHEN delivered_at::date - estimated_delivery_date <= 3  THEN 2
                    WHEN delivered_at::date - estimated_delivery_date <= 7  THEN 3
                    WHEN delivered_at::date - estimated_delivery_date <= 14 THEN 4
                    ELSE 5 END AS ord
        FROM d WHERE last_review_score IS NOT NULL) x
  GROUP BY ord) t""",
    "sellers": """
SELECT json_agg(t ORDER BY on_time, shipments DESC) FROM (
  SELECT left(os.seller_id, 8) AS seller, s.state,
         count(*) AS shipments,
         round(avg((shipped_at <= lim)::int), 4) AS on_time
  FROM os JOIN core.sellers s USING (seller_id)
  GROUP BY os.seller_id, s.state
  HAVING count(*) >= 100
  ORDER BY avg((shipped_at <= lim)::int), count(*) DESC
  LIMIT 15) t""",
}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", default=5432, type=int)
    p.add_argument("--db", default="marketplace")
    p.add_argument("--user", default="hack")
    p.add_argument("--password", default="hack")
    args = p.parse_args()

    try:
        conn = psycopg2.connect(host=args.host, port=args.port, dbname=args.db,
                                user=args.user, password=args.password)
    except psycopg2.OperationalError as e:
        sys.exit(f"Не удалось подключиться к базе: {e}\nПроверьте, что контейнер запущен:  docker compose ps")

    data = {"built_at": datetime.date.today().isoformat()}
    with conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'core'")
        if cur.fetchone()[0] == 0:
            sys.exit("Схема core пустая. Сначала соберите модель: solution/build_core.sql")
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'mart'")
        if cur.fetchone()[0] == 0:
            sys.exit("Схема mart пустая. Сначала соберите витрины: solution/build_mart.sql")
        cur.execute(BASE)
        for name, sql in QUERIES.items():
            cur.execute(sql)
            data[name] = cur.fetchone()[0]
            size = len(data[name]) if isinstance(data[name], list) else 1
            print(f"  {name:<9} {size:>3} строк")
    conn.close()

    payload = json.dumps(data, ensure_ascii=False, indent=1)
    html = HTML.read_text(encoding="utf-8")
    block = re.compile(r'(<script id="dash-data" type="application/json">)(.*?)(</script>)', re.S)
    if not block.search(html):
        sys.exit(f'В {HTML} нет блока <script id="dash-data" type="application/json">')
    html = block.sub(lambda m: m.group(1) + "\n" + payload + "\n" + m.group(3), html, count=1)
    HTML.write_text(html, encoding="utf-8")
    print(f"Готово: {HTML}")


if __name__ == "__main__":
    main()
