# Datum: фронтенд

Светлый русскоязычный дашборд на React, Vite и TypeScript. Использует бренд из
`../brand` и локальный Inter из `../design`. Из ветки `origin/frontend` взяты
зависимости и базовые настройки TypeScript/Biome. Ветка не переключалась.

```bash
cd frontend
npm ci
npm run dev
```

Открыть http://127.0.0.1:5173. API проксируется на http://127.0.0.1:8090.
Для другого адреса: `API_URL=http://127.0.0.1:8000 npm run dev`.
Запуск бэкенда описан в корневом README.

Данные берутся из `POST /api/metrics/query`. При недоступном API показывается
ошибка с повтором запроса. Демонстрационных данных в приложении нет.
Общий период по умолчанию: сентябрь 2016 — август 2018; фильтр правой даты
в интерфейсе включительный, в API преобразуется в исключительный.
Метрики покупателей тоже ограничены этим периодом, поэтому могут отличаться
от контрольных ответов по полному снимку, включающему сентябрь и октябрь 2018.

Чат использует `POST /api/chat/stream` и разбирает SSE из fetch POST.
Поддержаны text_delta, table, chart, sources, done, error и отмена запроса.
При done накопленный текст заменяется окончательным. Для продолжения диалога
сохраняются session_id и последние 30 сообщений в localStorage. Сворачивание
панели сохраняет активный поток; новый диалог создаёт новый session_id.
Выбранные фильтры и контекст метрики передаются с каждым сообщением.
Контекст можно добавить через вопросительный знак на метрике.

```bash
npm run verify
```

Проверка включает TypeScript, Biome, тесты границ SSE и production-сборку.
Схема `src/shared/api/schema.gen.ts` сгенерирована из OpenAPI текущего бэкенда.
При изменении API её можно обновить:

```bash
npx openapi-typescript http://127.0.0.1:8090/openapi.json -o src/shared/api/schema.gen.ts
```

## Моки API

`npm run dev:mock` запускает Vite с dev-middleware из `mocks/` (режим `--mode mock`; также включается `MOCK=1 npm run dev`). Бэкенд не нужен: мокаются `GET /api/health`, `GET /api/metrics`, `POST /api/metrics/query` (все метрики `block_a.*` и `dashboard.*`, фильтры по периоду и штату учитываются) и `POST /api/chat/stream` (SSE с теми же событиями, что у бэкенда). Цифры взяты из контрольных значений `docs/tasks.md` и `solution/dashboard.html`.

Удалить моки: папку `mocks/`, импорт `mockApi` и `mockApi()` в `vite.config.ts`, `"mocks"` в `tsconfig.json` и скрипт `dev:mock` в `package.json`.
