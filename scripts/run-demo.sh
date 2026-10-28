#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -x .venv/bin/python ] && [ -d frontend/node_modules ] || { echo "Сначала: bash scripts/bootstrap-demo.sh"; exit 1; }
.venv/bin/python - <<'PY'
import socket
for port in (8090, 8091, 5173):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            raise SystemExit(f"Порт {port} уже занят. Остановите предыдущий экземпляр приложения.")
PY
docker compose up -d --wait postgres

pids=()
cleanup() {
  for process_id in "${pids[@]:-}"; do
    if [ -n "$process_id" ]; then kill "$process_id" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT
trap 'exit 130' INT TERM

.venv/bin/python -m uvicorn backend.codex_gateway:app --host 127.0.0.1 --port 8091 &
pids+=("$!")
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8090 &
pids+=("$!")
npm --prefix frontend run dev -- --strictPort &
pids+=("$!")

echo "Datum: http://127.0.0.1:5173. API: http://127.0.0.1:8090/docs. Ctrl+C останавливает сервисы."
while kill -0 "${pids[@]}" 2>/dev/null; do sleep 1; done
echo "Один из сервисов завершился. Причина указана в его выводе выше."
exit 1
