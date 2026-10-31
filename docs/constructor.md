# Конструктор дашбордов

Вкладка «Конструктор» стоит справа от «Покупателей». Аналитик описывает виджет словами, агент
собирает его как артефакт (SQL по `core`/`mart`, снимок данных, тип визуализации), виджет
сохраняется в библиотеку и раскладывается на собственные дашборды. Сохранить виджет можно и из
ответа в чате кнопкой «В конструктор».

Типы: `frontend/src/shared/api/widget-types.ts`.

## API

| Метод и путь | Тело | Ответ |
|---|---|---|
| `POST /api/widgets/generate` | `{ prompt, filters }` | `{ widget: WidgetDraft, answer }` — агент пишет SQL через существующий SQL-инструмент (тот же guard), бэкенд выполняет его и возвращает снимок строк; ничего не сохраняет |
| `GET /api/widgets` | — | `{ items: WidgetSpec[] }`, новые сверху |
| `POST /api/widgets` | `WidgetDraft` | `WidgetSpec` (с `id`, `created_at`) |
| `DELETE /api/widgets/{id}` | — | `204`; виджет убирается и со всех дашбордов |
| `POST /api/widgets/{id}/refresh` | `{ filters }` | `WidgetSpec` с пересчитанными `rows` (SQL проходит guard заново) |
| `GET /api/dashboards` | — | `{ items: CustomDashboard[] }` |
| `POST /api/dashboards` | `{ title }` | `CustomDashboard` |
| `PUT /api/dashboards/{id}` | `CustomDashboard` | `CustomDashboard` |
| `DELETE /api/dashboards/{id}` | — | `204` |

Ошибки: `{ code, message }`, как в остальном API. Хранение — SQLite рядом с историей чатов
(`.local/agent.sqlite3`), таблицы `widgets` и `dashboards`.

## Правила виджета

- `kind`: `kpi` (одна цифра, `y[0]`), `line` (время по `x`), `bar` (категории по `x`), `hbar`
  (рейтинг, сортировка по `y[0]`), `table`.
- Цифры в виджете — только строки, вернувшиеся из базы; текст модели в данные не попадает.
- Снимок ограничен 500 строками и проходит тот же SQL guard, что и чат.

## Части фронтенда

| Часть | Файлы |
|---|---|
| Страница, холст, библиотека, список дашбордов | `frontend/src/features/constructor/` (`constructor-page.tsx`, `canvas*.tsx`, `library*.tsx`), `frontend/src/shared/api/widgets.ts` |
| Генерация по запросу и сохранение из чата | `frontend/src/features/constructor/generator*.tsx`, `frontend/src/shared/api/widgets-generate.ts`, кнопка в `frontend/src/features/chat/` |
| Отрисовка виджета по `WidgetSpec` | `frontend/src/features/constructor/widget-view.tsx` |
| Моки всех эндпоинтов | `frontend/mocks/constructor.ts` |
