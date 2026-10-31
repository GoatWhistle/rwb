#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON_BIN="${PYTHON_BIN:-python3}"
"$PYTHON_BIN" -c 'import sys; assert sys.version_info >= (3, 12), "Нужен Python 3.12+; задайте PYTHON_BIN=python3.12"'
command -v npm >/dev/null || { echo "Нужен Node.js с npm"; exit 1; }
command -v codex >/dev/null || { echo "Нужен Codex CLI в PATH; затем выполните codex login"; exit 1; }
codex login status || { echo "Сначала выполните codex login"; exit 1; }

"$PYTHON_BIN" -m venv .venv
.venv/bin/python -m pip install -e '.[dev,gateway]' psycopg2-binary
if [ ! -f .env ]; then cp .env.example .env; fi
export PATH="$PWD/.venv/bin:$PATH"
bash scripts/setup.sh
docker compose exec -T postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 < solution/build_core.sql
.venv/bin/python -m backend.setup
npm --prefix frontend ci --no-audit --no-fund

echo
echo "Готово. Запуск: bash scripts/run-demo.sh"
echo "Для поиска отзывов укажите POLZA_API_KEY в .env и выполните: .venv/bin/python -m backend.reviews index"
