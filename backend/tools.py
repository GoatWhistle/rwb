import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Any
from agents import RunContextWrapper, function_tool
import sqlglot
from sqlglot import exp
from .database import db, serializable
from .config import settings
from .metrics import catalog, compile_metric, query_metric, scope_sql
from .models import Filters, DashboardContext
from .sql_guard import validate_sql
from . import reviews


GRAINS = {
    "orders":"order_id", "order_items":"order_id + item_no (одна единица товара)",
    "order_payments":"order_id + payment_no", "order_reviews":"review_id + order_id",
    "customers":"customer_unique_id (человек)", "products":"product_id", "sellers":"seller_id"}
RULES = ["Выручка: price, delivered, без freight.","Чек: среднее суммы price+freight по доставленному заказу.",
    "Историческая география: core.orders.customer_state/city.","Платежи, позиции и отзывы агрегировать до JOIN: иначе суммы размножатся.",
    "Штат — двухбуквенный код Бразилии; категории — португальские коды, переводы в product_categories.",
    "Для разбора отзывов последний отзыв: answered_at DESC NULLS LAST, created_at DESC, review_id; у дашборда своё правило."]


def scoped_sql(sql: str, filters: Filters | None, row_limit: int) -> tuple[str, dict | None]:
    safe = validate_sql(sql)
    params = None
    if filters is not None and filters.model_dump(exclude_defaults=True):
        tree = sqlglot.parse_one(safe, read="postgres")
        reserved = {"_agent_orders","_agent_items","_agent_metric_items"}
        if any(c.alias in reserved for c in tree.find_all(exp.CTE)):
            raise ValueError("Имена CTE _agent_* зарезервированы")
        for table in tree.find_all(exp.Table):
            if table.db == "core" and table.name in {"orders","order_items"}:
                alias = table.alias_or_name
                table.set("this", exp.to_identifier("_agent_orders" if table.name == "orders" else "_agent_metric_items"))
                table.set("db", None)
                if not table.alias:
                    table.set("alias", exp.TableAlias(this=exp.to_identifier(alias)))
        prefix, params = scope_sql(filters, name_prefix="_agent_")
        safe = tree.sql(dialect="postgres")
        safe = f"WITH {prefix}, " + safe[5:] if safe.startswith("WITH ") else f"WITH {prefix} {safe}"
    return f"SELECT * FROM ({safe}) AS _agent_result LIMIT {row_limit + 1}", params


@dataclass
class ToolContext:
    dashboard: DashboardContext | None
    emit: Callable[[str, dict], Awaitable[None]]
    tables: dict = field(default_factory=dict)
    sources: list = field(default_factory=list)

    def filters(self, supplied):
        return supplied if supplied is not None else self.dashboard.filters if self.dashboard else Filters()

    async def call(self, name, arguments, operation):
        call_id = uuid.uuid4().hex
        start = time.monotonic()
        await self.emit("tool_started", {"call_id":call_id,"name":name,"arguments":arguments})
        try:
            result = await operation()
            if "table" in result:
                table_id = "table_" + call_id
                result["table_id"] = table_id
                self.tables[table_id] = result["table"]
                await self.emit("table", {"table_id":table_id, **result["table"]})
            if "sql" in result:
                result.setdefault("sources", []).append({"type":"sql", "id":call_id, "sql":result["sql"],
                    "parameters":result.get("parameters",{}), "metric_id":result.get("metric_id"),
                    "definition":result.get("definition"), "filters":result.get("filters")})
            self.sources.extend(result.get("sources", []))
            await self.emit("tool_finished", {"call_id":call_id,"name":name,"ok":True,
                "elapsed_ms":round((time.monotonic()-start)*1000),"result":result})
            return result
        except Exception as exc:
            message = str(exc) if isinstance(exc, ValueError) else f"Инструмент недоступен ({type(exc).__name__}); попробуй другой способ или сообщи об ограничении."
            await self.emit("tool_finished", {"call_id":call_id,"name":name,"ok":False,"error":message})
            return {"error":message}


@function_tool
async def describe_dataset(ctx: RunContextWrapper[ToolContext], metric_id: str | None = None) -> dict:
    """Discover core tables/columns, grains, metric IDs and business definitions. For a widget pass its metric_id to inspect the exact SQL."""
    async def run():
        if metric_id:
            report, _, sql, params = compile_metric(metric_id, ctx.context.filters(None))
            return {"metric_id":metric_id,"definition":report,"sql":sql,"parameters":serializable(params)}
        schema = await db.query("""SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
          WHERE table_schema='core' ORDER BY table_name,ordinal_position""")
        data = catalog()
        for report in data["reports"]:
            report.pop("sql", None)
        return {"schema":schema,"catalog":data,"grains":GRAINS,"rules":RULES}
    return await ctx.context.call("describe_dataset", {"metric_id":metric_id}, run)


@function_tool
async def query_metrics(ctx: RunContextWrapper[ToolContext], metric_id: str, filters: Filters | None = None) -> dict:
    """Compute a registered dashboard/block A metric using shared SQL. Inherits dashboard filters unless explicitly supplied. Returns definitions, exact SQL and table_id for charts."""
    selected = ctx.context.filters(filters)
    return await ctx.context.call("query_metrics", {"metric_id":metric_id,"filters":selected.model_dump(mode="json")},
                                  lambda: query_metric(metric_id, selected))


@function_tool
async def get_order(ctx: RunContextWrapper[ToolContext], order_id: str) -> dict:
    """Get an exact order by full ID, its dates, items, sellers, payments, all reviews and reconciled totals. Does not filter by active dashboard slice."""
    async def run():
        order = await db.query("SELECT * FROM core.orders WHERE order_id=%s", (order_id,))
        if not order["rows"]:
            return {"found":False,"order_id":order_id}
        items = await db.query("""SELECT i.*,p.category_name,s.city AS seller_city,s.state AS seller_state
          FROM core.order_items i JOIN core.products p USING(product_id) JOIN core.sellers s USING(seller_id)
          WHERE i.order_id=%s ORDER BY item_no""", (order_id,))
        payments = await db.query("SELECT * FROM core.order_payments WHERE order_id=%s ORDER BY payment_no", (order_id,))
        feedback = await db.query("""SELECT * FROM core.order_reviews WHERE order_id=%s
          ORDER BY answered_at DESC NULLS LAST,created_at DESC,review_id""", (order_id,))
        totals = await db.query("""SELECT (SELECT sum(price+freight_value) FROM core.order_items WHERE order_id=%s) AS order_total,
          (SELECT sum(amount) FROM core.order_payments WHERE order_id=%s) AS paid""", (order_id,order_id))
        return {"found":True,"order":order["rows"][0],"items":items,"payments":payments,"reviews":feedback,"totals":totals,
                "sources":[{"type":"order","order_id":order_id,"tables":["core.orders","core.order_items","core.order_payments","core.order_reviews"]}]}
    return await ctx.context.call("get_order", {"order_id":order_id}, run)


@function_tool
async def execute_sql(ctx: RunContextWrapper[ToolContext], sql: str, apply_dashboard_filters: bool = True) -> dict:
    """Run one read-only PostgreSQL SELECT on core/mart. Inherits dashboard filters by default; item filters select matching positions. For whole-order check use query_metrics. Set apply_dashboard_filters=false only when the question requests a different scope, and put those filters explicitly in SQL. Always inspect truncation."""
    async def run():
        filters = ctx.context.filters(None)
        safe, params = scoped_sql(sql, filters if apply_dashboard_filters else None, settings().sql_row_limit)
        return {"table":await db.query(safe, params),"sql":safe,
                "parameters":serializable(params or {}),
                "filters":filters.model_dump(mode="json") if apply_dashboard_filters else {"scope":"explicit SQL only"}}
    return await ctx.context.call("execute_sql", {"sql":sql,"apply_dashboard_filters":apply_dashboard_filters}, run)


@function_tool
async def search_reviews(ctx: RunContextWrapper[ToolContext], query: str, filters: Filters | None = None,
                         top_k: int = 8, min_score: int = 1, max_score: int = 5, late_only: bool = False) -> dict:
    """Semantic cross-lingual review search (Russian questions, Portuguese originals). Returns exact review/order sources. Examples are not population counts or proof of responsibility."""
    selected=ctx.context.filters(filters)
    return await ctx.context.call("search_reviews", {"query":query,"filters":selected.model_dump(mode="json"),"top_k":top_k},
        lambda: reviews.search(query,selected,top_k=top_k,min_score=min_score,max_score=max_score,late_only=late_only))


@function_tool
async def run_quality_checks(ctx: RunContextWrapper[ToolContext]) -> dict:
    """Run shared dashboard data checks and reconcile order item totals with payments, aggregated independently. Findings describe data, not necessarily errors."""
    async def run():
        checks = await query_metric("dashboard.checks", ctx.context.filters(None))
        reconciliation = await db.query("""WITH i AS (SELECT order_id,sum(price+freight_value) total FROM core.order_items GROUP BY 1),
          p AS (SELECT order_id,sum(amount) paid FROM core.order_payments GROUP BY 1)
          SELECT count(*) AS orders, count(*) FILTER(WHERE i.total IS NULL) AS without_items,
          count(*) FILTER(WHERE p.paid IS NULL) AS without_payments,
          count(*) FILTER(WHERE abs(i.total-p.paid)>0.01) AS differing_totals
          FROM core.orders o LEFT JOIN i USING(order_id) LEFT JOIN p USING(order_id)""")
        return {**checks,"reconciliation_all_dataset":reconciliation}
    return await ctx.context.call("run_quality_checks", {}, run)


TOOLS = [describe_dataset,get_order,query_metrics,execute_sql,search_reviews,run_quality_checks]
