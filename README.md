# Кейс «Модель маркетплейса: от корзины до выкупа»

Окружение и раздаточный материал для команд. Вам предстоит спроектировать
модель данных маркетплейса, наполнить её из сырой выгрузки и ответить
SQL-запросами на вопросы аналитиков.

Данные — [Brazilian E-Commerce Public Dataset by Olist](https://github.com/olist/work-at-olist-data),
550 759 строк в восьми файлах, период с сентября 2016 по октябрь 2018.

## Решение команды

Модель и ответы — в [solution/](solution/): `build_core.sql` собирает `core`
из `raw`, `answers_block_a.sql` отвечает на вопросы блока А. Разбор данных
и решений — [report.html](report.html). Дашборд «Исполнение заказа» —
[solution/dashboard.html](solution/dashboard.html), его данные собирает
`solution/build_dashboard.py`.

## Полный запуск с агентом и Codex

Пошаговая инструкция: [docs/RUN_WITH_CODEX.md](docs/RUN_WITH_CODEX.md).
Первый запуск: `bash scripts/bootstrap-demo.sh`, затем `bash scripts/run-demo.sh`.
Фронтенд: http://127.0.0.1:5173.

## Быстрый старт

```bash
bash scripts/setup.sh
```

Скрипт проверяет Docker, поднимает PostgreSQL, скачивает данные, создаёт
схемы и загружает 550 759 строк в схему `raw`. На каждом шаге проверяет
результат и при сбое объясняет, что чинить. Первый запуск занимает
несколько минут — докачиваются образ PostgreSQL и 61 МБ данных;
повторный — меньше минуты.

Начать с чистого листа: `bash scripts/setup.sh --reset`

Подключение: `postgresql://hack:hack@localhost:5432/marketplace`

## С чего начать

1. [docs/handout.md](docs/handout.md) — задание, описание данных и что сдавать.
2. [docs/tasks.md](docs/tasks.md) — вопросы, на которые должна отвечать
   ваша модель.

Вопросов в файле пять, но это не весь список: ещё пять вопросов и вброс
появятся там же в середине хакатона. Заранее их нет намеренно.

## Структура

```
.
├── README.md                     этот файл
├── docker-compose.yml            PostgreSQL 16, порт 5432
│
├── docs/
│   ├── handout.md                задание и описание данных
│   └── tasks.md                  вопросы к модели
│
├── scripts/
│   ├── setup.sh                  установка окружения целиком
│   ├── download_data.sh          скачивание CSV из репозитория Olist
│   ├── load_raw.py               загрузка CSV в схему raw
│   └── init/
│       ├── 01_init.sql           схемы raw, core, mart
│       └── 02_raw_ddl.sql        таблицы raw-слоя
│
└── data/                         исходные CSV, 61 МБ (скачиваются скриптом)
```

Свои скрипты складывайте рядом — например, в папку `model/`. Главное,
чтобы модель собиралась из `raw` одним запуском и на чистой базе.

## Схемы в базе

- `raw` — исходные данные как есть, все колонки `text`. Менять не нужно.
- `core` — ваша модель. Основное место работы.
- `mart` — витрины и сохранённые ответы, если понадобятся.

Все колонки в `raw` объявлены как `text` намеренно: в raw-слой данные
кладут в том виде, в каком они пришли. Объяви дату как `timestamp` —
и одно пустое значение уронит загрузку целиком. Приведение типов
и чистка это уже работа по переносу в свою модель.

## Требования к окружению

Docker Desktop или Docker Engine с плагином compose. Python 3.10+
с пакетом `psycopg2-binary` — `setup.sh` поставит его сам, если нет.
SQL-клиент по вкусу: DBeaver, psql внутри контейнера или веб-клиент
pgAdmin (`docker compose --profile tools up -d`, потом
http://localhost:8080). В настройках подключения внутри pgAdmin хост —
`postgres`, не localhost: веб-клиент живёт в соседнем контейнере
и видит базу по имени сервиса.

Логин и пароль `hack` / `hack` простые намеренно, это локальная
учебная база.

## AI-агент и API дашборда

Ветка `feature/ai-agent` также содержит `design/` и `brand/`, перенесённые
из `origin/frontend` (`de327aa`). Каталог дизайн-системы —
[design/design-system.html](design/design-system.html), бренд Datum —
[brand/BRAND.md](brand/BRAND.md). Готовый фронтенд находится в [frontend/](frontend/README.md).

Стек: Python 3.12+, FastAPI, OpenAI Agents SDK, PostgreSQL/pgvector.
История чатов и журнал инструментов сохраняются отдельно в SQLite:
`.local/agent.sqlite3`. Контракт фронтенда и примеры запросов —
[docs/agent_api.md](docs/agent_api.md).

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cp .env.example .env
bash scripts/setup.sh
docker compose exec -T postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 < solution/build_core.sql
.venv/bin/python -m backend.setup
# Вписать POLZA_API_KEY в локальный .env.
.venv/bin/python -m backend.reviews index
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8090
```

Swagger/OpenAPI: http://127.0.0.1:8090/docs. Проверка: `/api/health`.
Настройте `CORS_ORIGINS` в `.env` под адрес фронтенда.
Не используйте `setup.sh --reset` для обычного обновления: он удаляет volume.
После пересборки `core` повторите `backend.setup` для прав доступа и индексацию
для сверки изменений отзывов. Индексация возобновляется с уже сохранённых векторов;
пока она не завершена, поиск сообщает, что индекс не готов. Остальные тулзы работают.

LLM задаётся через `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. На текущем компьютере
настроен локальный Codex gateway для `gpt-6.1-sol`:

```bash
.venv/bin/pip install -e '.[gateway]'
.venv/bin/python -m uvicorn backend.codex_gateway:app --host 127.0.0.1 --port 8091
```

Переносимый адаптер включён в `backend/codex_gateway.py`. Он использует локальную
авторизацию Codex; ключи и история в Git не передаются. SDK использует свой
закреплённый runtime; при необходимости путь к установленному CLI задаётся через
`GATEWAY_CODEX_BIN`. Также можно подключить Responses-совместимый endpoint через `.env`.
Сам backend использует обычный OpenAI SDK, поддерживает function calling и SSE;
gateway не требуется на машине проверяющего при наличии обычного API-ключа OpenAI.

SQL-инструмент работает от `agent_reader`, проверяет полный AST, разрешает
аналитические SELECT по `core`/`mart`, ограничивает время и объём результата.
Административное подключение используется только явными командами настройки
и индексации. Данные отзывов не считаются инструкциями для агента.

```bash
.venv/bin/python -m pytest -q
TEST_DATABASE=1 .venv/bin/python -m pytest -q
```

Второй запуск дополнительно проверяет контрольные ответы на загруженном Olist.
Для новых задач добавляйте определения и SQL в `backend/catalog/`:
API, агент и существующий генератор HTML используют один источник расчётов.

## Если что-то не работает

**Схем raw, core и mart нет в базе.** Скрипты из `scripts/init`
выполняются только при создании пустой базы. Если база уже была создана
раньше, схемы не появятся сколько ни перезапускай контейнер. Лечится:
`bash scripts/setup.sh --reset`

**DBeaver не показывает схемы, хотя скрипт отработал.** Кэш дерева.
Правый клик по соединению → Disconnect, потом подключиться заново.

**Порт 5432 занят.** Запустите на другом порту: `PG_PORT=5433 bash
scripts/setup.sh`. Данные при этом сохраняются, пересоздаётся только
контейнер.

**`docker compose up` будто завис.** Образ pgAdmin весит около 400 МБ.
Он вынесен в профиль `tools` и по умолчанию не запускается — поднимайте
базу через `setup.sh`.

**Загрузка падает на `ModuleNotFoundError: psycopg2`.** Поставьте вручную:
`pip install psycopg2-binary`
