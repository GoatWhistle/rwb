<p align="center">
  <img src="brand/logo/01-strata-lockup-white.svg" alt="Datum: одна цифра для всех аналитиков маркетплейса" width="420">
</p>

<p align="center">
  Аналитик маркетплейса Capibara открывает дашборд исполнения заказов, спрашивает в чате
  «покажи выручку по месяцам» и получает таблицу, график и SQL, по которому посчитана цифра.
</p>

<p align="center">
  <a href="#зачем-это">Зачем это</a> ·
  <a href="#как-это-работает">Как это работает</a> ·
  <a href="#попробовать">Попробовать</a> ·
  <a href="#запуск">Запуск</a> ·
  <a href="#устройство">Устройство</a> ·
  <a href="#ограничения">Ограничения</a> ·
  <a href="#материалы-кейса">Материалы кейса</a>
</p>

> **Каждая цифра в ответе чата получена SQL-запросом к базе, и этот запрос показан в ответе.**
> Языковая модель выбирает инструмент и пишет текст; числа приходят из строк, которые вернул
> PostgreSQL, и уходят во фронтенд событиями `table` и `sources` вместе с SQL и параметрами.
> Запрос с записью, к `raw` или с функцией вне белого списка отклоняется до выполнения.

## Зачем это

Восемь выгрузок Olist лежат как есть: покупатель записан анкетой заказа, а не человеком, выручку
можно считать по разным статусам и уровням. Поэтому один и тот же вопрос даёт разные ответы: число
покупателей выходит 99 441 вместо 96 096, средний чек 123.75 вместо 159.88
([вопросы кейса с контрольными цифрами](docs/tasks.md)).

Datum собирает из выгрузок модель `raw → core`, а определения метрик (что считается выручкой, кто
такой покупатель, на каком уровне считается чек) записывает один раз в каталог
`backend/catalog/reports.json`. **Дашборд и агент берут цифры из одного каталога**, поэтому на один
и тот же вопрос аналитик и чат получают одну цифру и один SQL.

Название — *datum*, «данное»: одна точка отсчёта, от которой считают все.

## Как это работает

```mermaid
flowchart LR
    A["CSV Olist"] --> B["raw<br/>как пришло"]
    B --> C["core<br/>модель, ключи, типы"]
    C --> K["Каталог метрик<br/>параметризованный SELECT"]
    K --> API["API метрик<br/>FastAPI :8090"]
    API --> UI["React-дашборд<br/>:5173"]
    Q["Вопрос в чате"] --> AG["Агент<br/>LLM через OpenAI-совместимый<br/>endpoint или Codex gateway"]
    AG --> K
    AG --> G{"SQL guard<br/>AST"}
    G -- "один SELECT к core/mart" --> C
    G -- "запись, raw, чужие функции" --> R["Отказ с причиной"]
    AG --> RV["Поиск по отзывам<br/>pgvector"]
    RV --> C
    AG --> F["Ответ: текст, таблица,<br/>график, SQL"]
```

<table>
<tr>
<td valign="top" width="33%">

**Одно определение метрики для дашборда и чата**

Каждый отчёт в `backend/catalog/` хранит SQL, зерно, единицы, определения и допустимые фильтры.
`POST /api/metrics/query` выполняет только эти статические SELECT; клиент свой SQL в API метрик не
передаёт. Агент вызывает тот же каталог через `query_metrics`.

<sub>Контракт: [docs/agent_api.md](docs/agent_api.md), тесты `tests/test_metrics.py`</sub>

</td>
<td valign="top" width="33%">

**Свободный SQL агента проходит три проверки**

`backend/sql_guard.py` разбирает полный AST через sqlglot: ровно один SELECT или WITH, таблицы только
из `core` и `mart`, функции из закрытого списка. Затем запрос идёт от роли `agent_reader` в
транзакции только для чтения, с таймаутом 10 с и лимитом 500 строк.

<sub>Тесты `tests/test_sql_guard.py`, права в `backend/bootstrap.sql`</sub>

</td>
<td valign="top" width="33%">

**Отзывы ищутся по смыслу и остаются данными**

`search_reviews` ищет в `ai.review_embeddings` (pgvector, косинусная близость) по русскому запросу и
возвращает португальские оригиналы с ID отзыва и заказа. Тексты отзывов и контекст дашборда агент не
выполняет как инструкции.

<sub>Тесты `tests/test_reviews.py`, индексация `python -m backend.reviews index`</sub>

</td>
</tr>
</table>

Инструменты агента (`backend/tools.py`): `describe_dataset`, `query_metrics`, `get_order`,
`execute_sql`, `search_reviews`, `run_quality_checks`. Агент собран на OpenAI Agents SDK, ответ
стримится по SSE. История чатов и журнал вызовов инструментов хранятся в SQLite
`.local/agent.sqlite3` и переживают перезапуск бэкенда.

## Попробовать

После [запуска](#запуск) открыть http://127.0.0.1:5173.

| | Что сделать | Что увидите |
|---|---|---|
| 1 | В чате: «Покажи выручку по месяцам» | Таблица по месяцам, линейный график и SQL отчёта из каталога |
| 2 | Нажать вопросительный знак на метрике «доставка вовремя» и спросить «Почему здесь такая цифра?» | Определение виджета и SQL, по которому посчитано значение на экране |
| 3 | «Найди жалобы на недокомплект» | Примеры отзывов на португальском с ID отзыва и заказа |

Остальные проверяемые сценарии — в [docs/agent_api.md](docs/agent_api.md#проверяемые-сценарии).

## Запуск

Нужны Docker с Compose, Python 3.12+, Node.js с npm и, для режима с Codex, Codex CLI после
`codex login`. Команды выполняются в bash: macOS, Linux или WSL2.

```bash
bash scripts/bootstrap-demo.sh   # один раз: .venv, .env, PostgreSQL, raw, core, права агента, фронтенд
bash scripts/run-demo.sh         # gateway :8091, API :8090, фронтенд :5173
```

| Адрес | Сервис |
| --- | --- |
| http://127.0.0.1:5173 | Фронтенд Datum |
| http://127.0.0.1:8090/docs | Swagger API метрик и чата; проверка: `/api/health` |
| http://127.0.0.1:8091/health | Адаптер Responses к локальному Codex |

База: `postgresql://hack:hack@localhost:5432/marketplace`. Если `python3` старый:
`PYTHON_BIN=python3.12 bash scripts/bootstrap-demo.sh`. Пошаговая инструкция —
[docs/RUN_WITH_CODEX.md](docs/RUN_WITH_CODEX.md).

<details>
<summary><b>Бэкенд вручную, без скриптов демо</b></summary>
<br>

Стек: Python 3.12+, FastAPI, OpenAI Agents SDK, PostgreSQL 16 с pgvector. Контракт фронтенда и
примеры запросов — [docs/agent_api.md](docs/agent_api.md).

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

Настройте `CORS_ORIGINS` в `.env` под адрес фронтенда. Не используйте `setup.sh --reset` для
обычного обновления: он удаляет volume. После пересборки `core` повторите `backend.setup` для прав
доступа и индексацию для сверки изменений отзывов. Индексация возобновляется с уже сохранённых
векторов; пока она не завершена, поиск сообщает, что индекс не готов. Остальные инструменты работают.

SQL-инструмент работает от `agent_reader`, проверяет полный AST, разрешает аналитические SELECT по
`core`/`mart`, ограничивает время и объём результата. Административное подключение используется
только явными командами настройки и индексации.

</details>

<details>
<summary><b>LLM и Codex gateway</b></summary>
<br>

LLM задаётся через `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. По умолчанию бэкенд обращается к
локальному Codex gateway с моделью `gpt-6.1-sol`:

```bash
.venv/bin/pip install -e '.[gateway]'
.venv/bin/python -m uvicorn backend.codex_gateway:app --host 127.0.0.1 --port 8091
```

Адаптер — `backend/codex_gateway.py`. Он использует локальную авторизацию Codex; ключи и история в
Git не передаются. SDK использует свой закреплённый runtime; при необходимости путь к установленному
CLI задаётся через `GATEWAY_CODEX_BIN`. Также можно подключить Responses-совместимый endpoint через
`.env`. Сам бэкенд использует обычный OpenAI SDK, поддерживает function calling и SSE; gateway не
нужен на машине проверяющего при наличии обычного API-ключа OpenAI.

Эмбеддинги отзывов: `POLZA_API_KEY`, модель `qwen/qwen3-embedding-8b`, 4096 измерений
(`backend/config.py`).

</details>

<details>
<summary><b>Фронтенд и проверки</b></summary>
<br>

```bash
cd frontend
npm ci --silent
npm run dev        # http://127.0.0.1:5173, API проксируется на http://127.0.0.1:8090
npm run verify     # TypeScript, Biome, тесты границ SSE, production-сборка
```

Подробно: [frontend/README.md](frontend/README.md).

```bash
.venv/bin/python -m pytest -q
TEST_DATABASE=1 .venv/bin/python -m pytest -q
```

Второй запуск дополнительно проверяет контрольные ответы на загруженном Olist.

</details>

## Устройство

Модель данных и ответы кейса лежат в `solution/`, API и агент в `backend/`, дашборд и чат в
`frontend/`. Ключевое решение — какой SQL выполнить — принимается в каталоге метрик либо в
`sql_guard.py`, до обращения к базе.

| Путь | Что внутри |
|---|---|
| [docs/agent_api.md](docs/agent_api.md) | API метрик, фильтры, SSE-события чата, проверяемые сценарии |
| [docs/RUN_WITH_CODEX.md](docs/RUN_WITH_CODEX.md) | запуск всего стенда с агентом через Codex |
| [frontend/README.md](frontend/README.md) | React-приложение, разбор SSE, генерация схемы из OpenAPI |
| `backend/catalog/` | определения и SQL отчётов; новые отчёты, в том числе блока Б, добавляются сюда |
| [design/design-system.html](design/design-system.html) | дизайн-система, снятая с презентации кейса |
| [brand/BRAND.md](brand/BRAND.md) | название, знак, правила логотипа |
| [solution/dashboard.html](solution/dashboard.html) | статичный дашборд «Исполнение заказа», данные собирает `solution/build_dashboard.py` |

Для новых задач добавляйте определения и SQL в `backend/catalog/`: API, агент и генератор HTML
используют один источник расчётов. После добавления записи перезапустите бэкенд.

## Ограничения

- **Поиск по отзывам требует внешнего ключа эмбеддингов.** Без `POLZA_API_KEY` и завершённой
  индексации `search_reviews` сообщает, что индекс не готов; остальные инструменты работают.
- **Чату нужна языковая модель.** Без доступа к Codex или OpenAI-совместимому endpoint чат не
  отвечает; дашборд работает без LLM.
- **Период дашборда — сентябрь 2016 – август 2018.** Метрики покупателей на дашборде могут
  отличаться от контрольных ответов по полному снимку, который включает сентябрь и октябрь 2018.
- **Отзывы — примеры, а не частота.** `search_reviews` возвращает ближайшие по смыслу отзывы, а не
  подсчёт всех жалоб.

## Материалы кейса

Кейс «Модель маркетплейса: от корзины до выкупа»: спроектировать модель данных маркетплейса,
наполнить её из сырой выгрузки и ответить SQL-запросами на вопросы аналитиков. Данные —
[Brazilian E-Commerce Public Dataset by Olist](https://github.com/olist/work-at-olist-data),
550 759 строк в восьми файлах, период с сентября 2016 по октябрь 2018.

1. [docs/handout.md](docs/handout.md) — задание, описание данных и что сдавать.
2. [docs/tasks.md](docs/tasks.md) — вопросы, на которые должна отвечать модель.

Вопросов в файле пять, но это не весь список: ещё пять вопросов и вброс появятся там же в середине
хакатона. Заранее их нет намеренно.

Решение команды: `solution/build_core.sql` собирает `core` из `raw`, `solution/answers_block_a.sql`
отвечает на вопросы блока А. Разбор данных и решений — [report.html](report.html).

<details>
<summary><b>Окружение базы</b></summary>
<br>

```bash
bash scripts/setup.sh
```

Скрипт проверяет Docker, поднимает PostgreSQL, скачивает данные, создаёт схемы и загружает 550 759
строк в схему `raw`. На каждом шаге проверяет результат и при сбое объясняет, что чинить. Первый
запуск занимает несколько минут: докачиваются образ PostgreSQL и 61 МБ данных; повторный — меньше
минуты. Начать с чистого листа: `bash scripts/setup.sh --reset`.

Подключение: `postgresql://hack:hack@localhost:5432/marketplace`.

Схемы в базе:

- `raw` — исходные данные как есть, все колонки `text`. Менять не нужно.
- `core` — модель. Основное место работы.
- `mart` — витрины и сохранённые ответы, если понадобятся.
- `ai` — эмбеддинги отзывов для поиска агента.

Все колонки в `raw` объявлены как `text` намеренно: в raw-слой данные кладут в том виде, в каком
они пришли. Объяви дату как `timestamp` — и одно пустое значение уронит загрузку целиком. Приведение
типов и чистка — работа по переносу в свою модель.

Свои скрипты складывайте рядом, например в папку `model/`. Главное, чтобы модель собиралась из `raw`
одним запуском и на чистой базе.

Нужны Docker Desktop или Docker Engine с плагином compose и Python 3.10+ с пакетом
`psycopg2-binary` — `setup.sh` поставит его сам, если нет (бэкенду агента нужен Python 3.12+).
SQL-клиент по вкусу: DBeaver, psql внутри контейнера или веб-клиент pgAdmin
(`docker compose --profile tools up -d`, потом http://localhost:8080). В настройках подключения
внутри pgAdmin хост — `postgres`, не localhost: веб-клиент живёт в соседнем контейнере и видит базу
по имени сервиса.

Логин и пароль `hack` / `hack` простые намеренно, это локальная учебная база.

</details>

<details>
<summary><b>Структура раздаточного окружения</b></summary>
<br>

```
.
├── docker-compose.yml            PostgreSQL 16 с pgvector, порт 5432
├── docs/
│   ├── handout.md                задание и описание данных
│   └── tasks.md                  вопросы к модели
├── scripts/
│   ├── setup.sh                  установка окружения целиком
│   ├── download_data.sh          скачивание CSV из репозитория Olist
│   ├── load_raw.py               загрузка CSV в схему raw
│   └── init/
│       ├── 01_init.sql           схемы raw, core, mart
│       └── 02_raw_ddl.sql        таблицы raw-слоя
└── data/                         исходные CSV, 61 МБ (скачиваются скриптом)
```

</details>

<details>
<summary><b>Если что-то не работает</b></summary>
<br>

**Схем raw, core и mart нет в базе.** Скрипты из `scripts/init` выполняются только при создании
пустой базы. Если база уже была создана раньше, схемы не появятся сколько ни перезапускай контейнер.
Лечится: `bash scripts/setup.sh --reset`.

**DBeaver не показывает схемы, хотя скрипт отработал.** Кэш дерева. Правый клик по соединению →
Disconnect, потом подключиться заново.

**Порт 5432 занят.** Запустите на другом порту: `PG_PORT=5433 bash scripts/setup.sh`. Данные при
этом сохраняются, пересоздаётся только контейнер.

**`docker compose up` будто завис.** Образ pgAdmin весит около 400 МБ. Он вынесен в профиль `tools`
и по умолчанию не запускается — поднимайте базу через `setup.sh`.

**Загрузка падает на `ModuleNotFoundError: psycopg2`.** Поставьте вручную:
`pip install psycopg2-binary`.

**`run-demo.sh`: порт уже занят.** Скрипт проверяет 8090, 8091 и 5173 до старта; остановите
предыдущий экземпляр приложения.

**База остановлена после `Ctrl+C`.** `Ctrl+C` завершает только сервисы демо, PostgreSQL продолжает
работать в Docker. Если база была остановлена: `docker compose up -d postgres`.

</details>

<p align="center">
  <img src="brand/logo/01-strata-sign.svg" alt="" width="40"><br>
  <sub>Команда Datum, хакатон RWB, 2026.</sub>
</p>
