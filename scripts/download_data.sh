#!/usr/bin/env bash
# Скачивает исходные CSV в папку data.
# Источник: официальный репозиторий Olist на GitHub, закреплён на коммите —
# чужой форс-пуш или переименование ветки не поменяют данные под нами.
#
# Запуск из корня проекта:  bash scripts/download_data.sh

set -euo pipefail

OLIST_COMMIT="d9e49802f3e92d09ee94ab9ccc5e457f207a8959"
BASE="https://raw.githubusercontent.com/olist/work-at-olist-data/$OLIST_COMMIT/datasets"
# Скрипт лежит в scripts/, данные — в data/ рядом с ним на уровень выше.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"

# файл : точный размер в байтах на закреплённом коммите
FILES=(
  "olist_orders_dataset.csv:17654914"
  "olist_order_items_dataset.csv:15007623"
  "olist_order_payments_dataset.csv:5647783"
  "olist_order_reviews_dataset.csv:14451670"
  "olist_products_dataset.csv:2379446"
  "olist_sellers_dataset.csv:163589"
  "olist_customers_dataset.csv:8562270"
  "product_category_name_translation.csv:2613"
)

mkdir -p "$DIR"

for entry in "${FILES[@]}"; do
  f="${entry%%:*}"
  want="${entry##*:}"
  have=$( (wc -c < "$DIR/$f") 2>/dev/null | tr -d ' ' || echo 0)
  if [ "${have:-0}" = "$want" ]; then
    echo "уже есть: $f"
    continue
  fi
  if [ "${have:-0}" != "0" ]; then
    echo "размер не сходится ($have байт вместо $want), качаю заново: $f"
  else
    echo "качаю:    $f"
  fi
  # качаем во временный файл: оборванная загрузка не притворится готовой
  curl -fsSL --retry 3 -o "$DIR/$f.part" "$BASE/$f"
  have=$(wc -c < "$DIR/$f.part" | tr -d ' ')
  if [ "$have" != "$want" ]; then
    rm -f "$DIR/$f.part"
    echo
    echo "ОШИБКА: $f скачался не целиком ($have байт вместо $want)."
    echo "Проверьте интернет и запустите скрипт ещё раз."
    exit 1
  fi
  mv "$DIR/$f.part" "$DIR/$f"
done

echo
echo "Готово. Файлы в $DIR"
du -sh "$DIR"
