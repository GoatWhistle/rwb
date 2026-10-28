import asyncio
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Literal
import psycopg
from agents import Agent, ModelBehaviorError, Runner, RunConfig, ModelSettings, OpenAIResponsesModel
from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from . import storage
from .config import settings
from .database import db
from .models import Filters
from .tools import GRAINS, RULES, scoped_sql

ROW_LIMIT = 500
router = APIRouter(prefix="/api", tags=["constructor"])

WidgetKind = Literal["kpi", "line", "bar", "hbar", "table"]
WidgetCell = str | int | float | None
NUMERIC = {"number", "money", "percent"}


class WidgetColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    label: str = Field(max_length=200)
    type: Literal["text", "number", "money", "percent", "date"]


class WidgetDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=4000)
    kind: WidgetKind
    sql: str = Field(min_length=1, max_length=50000)
    columns: list[WidgetColumn] = Field(default_factory=list, max_length=100)
    rows: list[dict[str, WidgetCell]] = Field(default_factory=list, max_length=ROW_LIMIT)
    x: str | None = None
    y: list[str] = Field(default_factory=list, max_length=20)
    source: Literal["agent", "chat", "catalog"]
    prompt: str | None = Field(default=None, max_length=20000)
    filters: Filters | None = None


class WidgetSpec(WidgetDraft):
    id: str
    created_at: str


class WidgetList(BaseModel):
    items: list[WidgetSpec]


class WidgetGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(min_length=1, max_length=20000)
    filters: Filters = Field(default_factory=Filters)


class WidgetGenerateResponse(BaseModel):
    widget: WidgetDraft
    answer: str


class WidgetRefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filters: Filters | None = None


class DashboardItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    widget_id: str = Field(min_length=1, max_length=100)
    size: Literal["s", "m", "l", "xl"]


class CustomDashboard(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str = Field(min_length=1, max_length=300)
    items: list[DashboardItem] = Field(default_factory=list, max_length=200)
    updated_at: str


class DashboardList(BaseModel):
    items: list[CustomDashboard]


class DashboardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)


class WidgetPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    description: str
    kind: WidgetKind
    sql: str
    x: str | None
    y: list[str]
    columns: list[WidgetColumn]


class WidgetError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def connect() -> sqlite3.Connection:
    storage.LOCAL_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(storage.LOCAL_DB, timeout=10)
    conn.execute("""CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, spec TEXT NOT NULL)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, spec TEXT NOT NULL)""")
    return conn


def _run(operation):
    conn = connect()
    try:
        with conn:
            return operation(conn)
    finally:
        conn.close()


async def run(operation):
    return await asyncio.to_thread(_run, operation)


def dump(model: BaseModel) -> str:
    return json.dumps(model.model_dump(mode="json"), ensure_ascii=False)


def load_widget(conn, widget_id: str) -> WidgetSpec | None:
    row = conn.execute("SELECT spec FROM widgets WHERE id=?", (widget_id,)).fetchone()
    return WidgetSpec.model_validate_json(row[0]) if row else None


def save_widget(conn, widget: WidgetSpec):
    conn.execute("INSERT OR REPLACE INTO widgets(id,created_at,spec) VALUES(?,?,?)",
                 (widget.id, widget.created_at, dump(widget)))


def save_dashboard(conn, dashboard: CustomDashboard):
    conn.execute("INSERT OR REPLACE INTO dashboards(id,updated_at,spec) VALUES(?,?,?)",
                 (dashboard.id, dashboard.updated_at, dump(dashboard)))


def numeric(value: WidgetCell) -> WidgetCell:
    if isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            return value
        return int(number) if number.is_integer() and "." not in value else number
    return value


async def snapshot(sql: str, filters: Filters | None) -> tuple[str, list[dict], list[str], bool]:
    try:
        safe, params = scoped_sql(sql, filters, ROW_LIMIT)
    except ValueError as exc:
        raise WidgetError(422, "sql_rejected", f"SQL отклонён проверкой: {exc}") from exc
    try:
        table = await db.query(safe, params, limit=ROW_LIMIT)
    except psycopg.OperationalError as exc:
        raise WidgetError(503, "database_unavailable", "PostgreSQL недоступен; проверьте настройку из README") from exc
    except psycopg.Error as exc:
        raise WidgetError(422, "sql_failed", f"SQL не выполнен: {type(exc).__name__}") from exc
    return safe, table["rows"], [c["name"] for c in table["columns"]], table["truncated"]


def shape(columns: list[WidgetColumn], kind: str, x: str | None, y: list[str],
          rows: list[dict], names: list[str]) -> tuple[list[WidgetColumn], list[dict]]:
    known = {c.name: c for c in columns if c.name in names}
    columns = [known.get(name) or WidgetColumn(name=name, label=name, type="text") for name in names]
    missing = [name for name in [x, *y] if name and name not in names]
    if missing:
        raise WidgetError(422, "widget_invalid", f"В результате SQL нет колонок: {', '.join(missing)}")
    if kind != "table" and not y:
        raise WidgetError(422, "widget_invalid", "Для графика и KPI нужна хотя бы одна колонка y")
    if kind in {"line", "bar", "hbar"} and not x:
        raise WidgetError(422, "widget_invalid", "Для графика нужна колонка x")
    columns = [c if c.name not in y or c.type in NUMERIC else c.model_copy(update={"type": "number"})
               for c in columns]
    numbers = {c.name for c in columns if c.type in NUMERIC}
    rows = [{k: numeric(v) if k in numbers else v for k, v in row.items()} for row in rows]
    return columns, rows


async def schema_text() -> str:
    schema = await db.query("""SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns
      WHERE table_schema IN ('core','mart') ORDER BY table_schema,table_name,ordinal_position""", limit=5000)
    tables: dict[str, list[str]] = {}
    for row in schema["rows"]:
        tables.setdefault(f"{row['table_schema']}.{row['table_name']}", []).append(f"{row['column_name']} {row['data_type']}")
    return "\n".join(f"{name}({', '.join(cols)})" for name, cols in tables.items())


INSTRUCTIONS = """Ты проектируешь ОДИН виджет дашборда по датасету Olist. Верни строго JSON по схеме:
{title, description, kind, sql, x, y, columns:[{name,label,type}]}. Без пояснений вне JSON.
sql — один PostgreSQL SELECT или WITH … SELECT только по таблицам core.* и mart.* со схемой ниже.
Не подставляй фильтры среза в SQL: бэкенд сам ограничит core.orders и core.order_items фильтрами
пользователя. Витрины mart.* фильтрами не ограничиваются, поэтому при активном срезе бери core.*.
Не придумывай чисел: все значения виджета придут из базы. Результат не более 500 строк.
kind: kpi — одна строка, y[0] — показатель; line — x время (date_trunc, сортировка по x);
bar — x категории; hbar — рейтинг, ORDER BY y[0] DESC и LIMIT; table — таблица, x может быть null.
x и y — имена колонок результата (используй явные алиасы латиницей), y — числовые колонки.
columns перечисляют все колонки результата в порядке SELECT: label по-русски,
type ∈ text|number|money|percent|date. Деньги — money, доли — percent (0..1 или проценты, как в SQL).
title — короткий заголовок по-русски, description — одно-два предложения о методе расчёта.
"""


async def plan_widget(prompt: str, filters: Filters, schema: str) -> WidgetPlan:
    cfg = settings()
    context = json.dumps({"grains": GRAINS, "rules": RULES}, ensure_ascii=False)
    user_input = (f"Схема:\n{schema}\n\nПравила датасета: {context}\n\n"
                  f"Активный срез (применится автоматически): {filters.model_dump_json(exclude_defaults=True)}\n\n"
                  f"Запрос аналитика: {prompt}")
    async with AsyncOpenAI(base_url=cfg.llm_base_url, api_key=cfg.llm_api_key,
                           timeout=cfg.run_timeout_seconds, max_retries=0) as client:
        agent = Agent(name="Capibara widget designer", instructions=INSTRUCTIONS,
            model=OpenAIResponsesModel(model=cfg.llm_model, openai_client=client),
            output_type=WidgetPlan, model_settings=ModelSettings(reasoning={"effort": "medium"}, store=False))
        result = await Runner.run(agent, user_input, max_turns=1, run_config=RunConfig(tracing_disabled=True))
    plan = result.final_output
    if isinstance(plan, str):
        plan = WidgetPlan.model_validate_json(plan)
    if not isinstance(plan, WidgetPlan):
        raise ValueError("Модель вернула некорректный формат виджета")
    return plan


def describe(filters: Filters) -> str:
    active = filters.model_dump(mode="json", exclude_defaults=True)
    if not active:
        return "без фильтров"
    return "; ".join(f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in active.items())


@router.post("/widgets/generate", response_model=WidgetGenerateResponse)
async def generate(request: WidgetGenerateRequest):
    try:
        try:
            schema = await schema_text()
        except psycopg.Error as exc:
            raise WidgetError(503, "database_unavailable", "PostgreSQL недоступен; проверьте настройку из README") from exc
        try:
            async with asyncio.timeout(settings().run_timeout_seconds):
                plan = await plan_widget(request.prompt, request.filters, schema)
        except (ValidationError, ValueError, ModelBehaviorError) as exc:
            raise WidgetError(502, "llm_invalid", "Модель вернула некорректную спецификацию виджета") from exc
        except Exception as exc:
            raise WidgetError(502, "llm_unavailable", f"Модель недоступна ({type(exc).__name__})") from exc
        _, rows, names, truncated = await snapshot(plan.sql, request.filters)
        columns, rows = shape(plan.columns, plan.kind, plan.x, plan.y, rows, names)
    except WidgetError as exc:
        return error(exc.status, exc.code, exc.message)
    widget = WidgetDraft(title=plan.title, description=plan.description, kind=plan.kind, sql=plan.sql,
        columns=columns, rows=rows, x=plan.x, y=plan.y, source="agent", prompt=request.prompt,
        filters=request.filters)
    answer = f"{plan.description} Строк в снимке: {len(rows)}"
    answer += f" (усечено до {ROW_LIMIT})." if truncated else "."
    answer += f" Срез: {describe(request.filters)}."
    return WidgetGenerateResponse(widget=widget, answer=answer.strip())


@router.get("/widgets", response_model=WidgetList)
async def list_widgets():
    rows = await run(lambda conn: conn.execute(
        "SELECT spec FROM widgets ORDER BY created_at DESC, rowid DESC").fetchall())
    return WidgetList(items=[WidgetSpec.model_validate_json(r[0]) for r in rows])


@router.post("/widgets", response_model=WidgetSpec)
async def create_widget(draft: WidgetDraft):
    widget = WidgetSpec(**draft.model_dump(), id=uuid.uuid4().hex, created_at=now())
    await run(lambda conn: save_widget(conn, widget))
    return widget


@router.delete("/widgets/{widget_id}", status_code=204)
async def delete_widget(widget_id: str):
    def operation(conn):
        if not conn.execute("DELETE FROM widgets WHERE id=?", (widget_id,)).rowcount:
            return False
        for (spec,) in conn.execute("SELECT spec FROM dashboards").fetchall():
            dashboard = CustomDashboard.model_validate_json(spec)
            items = [i for i in dashboard.items if i.widget_id != widget_id]
            if len(items) != len(dashboard.items):
                save_dashboard(conn, dashboard.model_copy(update={"items": items, "updated_at": now()}))
        return True
    if not await run(operation):
        return error(404, "not_found", "Виджет не найден")
    return Response(status_code=204)


@router.post("/widgets/{widget_id}/refresh", response_model=WidgetSpec)
async def refresh_widget(widget_id: str, request: WidgetRefreshRequest | None = None):
    widget = await run(lambda conn: load_widget(conn, widget_id))
    if widget is None:
        return error(404, "not_found", "Виджет не найден")
    filters = request.filters if request and request.filters is not None else widget.filters or Filters()
    try:
        _, rows, names, _ = await snapshot(widget.sql, filters)
        columns, rows = shape(widget.columns, widget.kind, widget.x, widget.y, rows, names)
    except WidgetError as exc:
        return error(exc.status, exc.code, exc.message)
    updated = widget.model_copy(update={"rows": rows, "columns": columns, "filters": filters})
    await run(lambda conn: save_widget(conn, updated))
    return updated


@router.get("/dashboards", response_model=DashboardList)
async def list_dashboards():
    rows = await run(lambda conn: conn.execute(
        "SELECT spec FROM dashboards ORDER BY updated_at DESC, rowid DESC").fetchall())
    return DashboardList(items=[CustomDashboard.model_validate_json(r[0]) for r in rows])


@router.post("/dashboards", response_model=CustomDashboard)
async def create_dashboard(request: DashboardCreate):
    dashboard = CustomDashboard(id=uuid.uuid4().hex, title=request.title, items=[], updated_at=now())
    await run(lambda conn: save_dashboard(conn, dashboard))
    return dashboard


@router.put("/dashboards/{dashboard_id}", response_model=CustomDashboard)
async def update_dashboard(dashboard_id: str, request: CustomDashboard):
    def operation(conn):
        if not conn.execute("SELECT 1 FROM dashboards WHERE id=?", (dashboard_id,)).fetchone():
            return None
        known = {r[0] for r in conn.execute("SELECT id FROM widgets").fetchall()}
        dashboard = request.model_copy(update={"id": dashboard_id, "updated_at": now(),
            "items": [i for i in request.items if i.widget_id in known]})
        save_dashboard(conn, dashboard)
        return dashboard
    dashboard = await run(operation)
    if dashboard is None:
        return error(404, "not_found", "Дашборд не найден")
    return dashboard


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str):
    if not await run(lambda conn: conn.execute("DELETE FROM dashboards WHERE id=?", (dashboard_id,)).rowcount):
        return error(404, "not_found", "Дашборд не найден")
    return Response(status_code=204)
