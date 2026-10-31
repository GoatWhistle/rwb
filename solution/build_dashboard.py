#!/usr/bin/env python3
"""
Данные для дашборда «Исполнение заказа» (solution/dashboard.html).

Считает показатели из модели core и вписывает их в блок
<script id="dash-data"> внутри dashboard.html. Сам HTML не зависит
от базы и интернета: открывается двойным кликом.

Запуск из корня проекта, после сборки core:
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

# SQL and metric definitions are shared with the agent API.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from backend.metrics import legacy_dashboard_sql
BASE, QUERIES = legacy_dashboard_sql()


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
