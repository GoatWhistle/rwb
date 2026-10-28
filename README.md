<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo/01-strata-lockup-mono-white.svg">
  <img src="brand/logo/01-strata-lockup.svg" alt="Datum" width="240">
</picture>

# Datum: модель маркетплейса от корзины до выкупа

Решение команды Datum для кейса RWB «Модель маркетплейса: от корзины до выкупа».
Из сырой выгрузки маркетплейса собирается модель `raw → core → mart`, поверх неё
работают дашборд, чат-ассистент и конструктор дашбордов. Все цифры считаются
SQL-запросами к базе, и запрос показан рядом с цифрой.

Данные — [Brazilian E-Commerce Public Dataset by Olist](https://github.com/olist/work-at-olist-data),
550 759 строк в восьми файлах, период с сентября 2016 по октябрь 2018.

## Быстрый старт

```bash
bash scripts/bootstrap-demo.sh
bash scripts/run-demo.sh
```

Первый скрипт выполняется один раз: создаёт `.venv` и `.env`, поднимает PostgreSQL,
скачивает данные, загружает `raw`, собирает `core`, выдаёт права агенту и ставит
зависимости фронтенда. Первый запуск занимает несколько минут. Второй скрипт
запускает три сервиса, после чего Datum открывается на http://127.0.0.1:5173.

| Адрес | Сервис |
| --- | --- |
| http://127.0.0.1:5173 | фронтенд Datum |
| http://127.0.0.1:8090/docs | API метрик, чата и конструктора; проверка: `/api/health` |
| http://127.0.0.1:8091/health | адаптер Responses к локальному Codex |

Чат по умолчанию работает через Codex CLI: перед запуском выполните `codex login`.
Пошаговая инструкция — [docs/RUN_WITH_CODEX.md](docs/RUN_WITH_CODEX.md).

Только фронтенд, без бэкенда и базы:

```bash
cd frontend
npm ci --silent
npm run dev:mock
```

Режим `dev:mock` отдаёт метрики, чат и конструктор из `frontend/mocks/`; цифры взяты
из контрольных значений [docs/tasks.md](docs/tasks.md).

Подключение к базе: `postgresql://hack:hack@localhost:5432/marketplace`

## С чего начать

1. **Дашборд.** Вкладки «Обзор», «Продажи», «Доставка» и «Покупатели» с фильтрами по
   периоду и штату. Определения метрик и их SQL лежат в `backend/catalog/`, у каждой
   метрики есть пояснение, что именно посчитано.
2. **Чат-ассистент.** Спросите «Покажи выручку по месяцам»: ответ придёт таблицей,
   графиком и блоком источников с SQL, параметрами и ID заказов или отзывов. Свободный
   SQL агента проходит проверку `backend/sql_guard.py`: один SELECT, только `core`
   и `mart`, функции из закрытого списка. Контракт и проверяемые сценарии —
   [docs/agent_api.md](docs/agent_api.md).
3. **Конструктор.** Опишите виджет словами, агент соберёт его по `core`/`mart`, виджет
   сохранится в библиотеку и раскладывается на собственные дашборды. Сохранить виджет
   можно и из ответа чата кнопкой «В конструктор». Подробно —
   [docs/constructor.md](docs/constructor.md).
4. **Мобильная версия.** На узком экране панели дашборда идут друг под другом,
   графики перестраиваются под ширину телефона, чат открывается на весь экран
   кнопкой в углу.

Материалы кейса: [docs/handout.md](docs/handout.md) — задание и описание данных,
[docs/tasks.md](docs/tasks.md) — вопросы к модели. Разбор данных и решений —
[report.html](report.html).

## Структура

```
.
├── README.md                     этот файл
├── docker-compose.yml            PostgreSQL 16 с pgvector, порт 5432
├── pyproject.toml                зависимости бэкенда
│
├── backend/
│   ├── app.py                    FastAPI: метрики, чат по SSE, конструктор
│   ├── agent.py, tools.py        агент на OpenAI Agents SDK и его инструменты
│   ├── sql_guard.py              проверка SQL агента по AST
│   ├── catalog/                  определения и SQL метрик
│   ├── widgets.py                виджеты и дашборды конструктора
│   ├── reviews.py                поиск по отзывам через pgvector
│   ├── speech.py                 голосовой ввод через GigaAM
│   └── codex_gateway.py          адаптер Responses к локальному Codex
│
├── frontend/                     React-приложение: дашборд, чат, конструктор
│   └── mocks/                    моки API для npm run dev:mock
│
├── solution/
│   ├── build_core.sql            сборка core из raw
│   ├── answers_block_a.sql       ответы на вопросы блока А
│   └── dashboard.html            статичный дашборд «Исполнение заказа»
│
├── docs/
│   ├── handout.md                задание и описание данных
│   ├── tasks.md                  вопросы к модели
│   ├── agent_api.md              API метрик и чата, события SSE
│   ├── constructor.md            API и правила конструктора
│   └── RUN_WITH_CODEX.md         запуск стенда с агентом через Codex
│
├── scripts/
│   ├── bootstrap-demo.sh         подготовка всего стенда
│   ├── run-demo.sh               запуск gateway, API и фронтенда
│   ├── setup.sh                  только база и загрузка raw
│   └── setup-voice.sh            установка модели GigaAM
│
├── tests/                        pytest: метрики, SQL guard, стриминг, виджеты
├── brand/, design/               логотип и дизайн-система
└── data/                         исходные CSV, 61 МБ (скачиваются скриптом)
```

## Схемы в базе

- `raw` — исходные данные как есть, все колонки `text`.
- `core` — модель: типы, ключи, связи. Собирается `solution/build_core.sql`.
- `mart` — витрины поверх `core`, если понадобятся.
- `ai` — эмбеддинги отзывов для поиска агента.

Агент читает базу от роли `agent_reader` в транзакции только для чтения, с таймаутом
10 с и лимитом 500 строк. Доступа к `raw` и записи у него нет.

## Требования к окружению

Docker с Compose, Python 3.12+, Node.js с npm и Codex CLI для чата. Команды выполняются
в bash: macOS, Linux или WSL2. Если `python3` старый:
`PYTHON_BIN=python3.12 bash scripts/bootstrap-demo.sh`.

Вместо Codex можно подключить любой OpenAI-совместимый endpoint через `LLM_BASE_URL`,
`LLM_API_KEY` и `LLM_MODEL` в `.env`. Для поиска по отзывам нужен `POLZA_API_KEY` и
индексация `.venv/bin/python -m backend.reviews index`. Голосовой ввод ставится
отдельно: `bash scripts/setup-voice.sh <каталог с моделью>`.

Проверки:

```bash
.venv/bin/python -m pytest -q
npm --prefix frontend run verify
```

## Если что-то не работает

**Чат не отвечает.** Нет доступа к языковой модели. Проверьте `codex login status`
и `curl http://127.0.0.1:8091/health`. Дашборд работает без LLM.

**Поиск по отзывам сообщает, что индекс не готов.** Не задан `POLZA_API_KEY` или не
завершена индексация. Остальные инструменты агента работают.

**`run-demo.sh`: порт уже занят.** Скрипт проверяет 8090, 8091 и 5173 до старта;
остановите предыдущий экземпляр приложения.

**База остановлена после `Ctrl+C`.** `Ctrl+C` завершает только сервисы демо.
Если база тоже остановлена: `docker compose up -d postgres`.

**Порт 5432 занят.** Запустите на другом порту: `PG_PORT=5433 bash scripts/setup.sh`.

**Схем raw, core и mart нет в базе.** Скрипты из `scripts/init` выполняются только при
создании пустой базы. Лечится: `bash scripts/setup.sh --reset`. Он удаляет volume,
для обычного обновления его не используйте.
