"""The SQL registry is shared by the dashboard exporter, API and agent tools."""
import hashlib
import json
from pathlib import Path
from .database import db, serializable
from .models import Filters


def load_reports() -> dict:
    reports = {}
    for path in sorted((Path(__file__).parent / "catalog").glob("*.json")):
        for report in json.loads(path.read_text()):
            if report["id"] in reports:
                raise ValueError(f"Duplicate metric ID: {report['id']}")
            reports[report["id"]] = report
    return reports


REPORTS = load_reports()
METRICS_VERSION = hashlib.sha256(json.dumps(REPORTS, sort_keys=True).encode()).hexdigest()[:16]


def catalog() -> dict:
    return {"metrics_version": METRICS_VERSION, "reports": [
        {**{k: v for k, v in r.items() if k != "dashboard_base"},
         "supported_filters": list(Filters.model_fields)} for r in REPORTS.values()]}


def resolve(metric_id: str):
    if metric_id in REPORTS:
        return REPORTS[metric_id], None
    parent, _, field = metric_id.rpartition(".")
    if parent in REPORTS and field in REPORTS[parent]["definitions"] and field != "report":
        return REPORTS[parent], field
    raise ValueError(f"Неизвестный metric_id: {metric_id}. Сначала вызови describe_dataset.")


def scope_sql(filters: Filters, name_prefix: str = "") -> tuple[str, dict]:
    conditions, item_conditions, params = [], [], {}
    for name, op in [("start_date", ">="), ("end_date", "<")]:
        if value := getattr(filters, name):
            conditions.append(f"o.purchased_at {op} %({name})s")
            params[name] = value
    if filters.states:
        conditions.append("o.customer_state = ANY(%(states)s)")
        params["states"] = filters.states
    if filters.seller_ids:
        item_conditions.append("fi.seller_id = ANY(%(seller_ids)s)")
        params["seller_ids"] = filters.seller_ids
    if filters.categories:
        item_conditions.append("coalesce(fp.category_name, '(без категории)') = ANY(%(categories)s)")
        params["categories"] = filters.categories
    item_where = " AND ".join(item_conditions) or "true"
    if item_conditions:
        conditions.append(f"EXISTS (SELECT 1 FROM core.order_items fi JOIN core.products fp USING(product_id) WHERE fi.order_id=o.order_id AND {item_where})")
    where = " AND ".join(conditions) or "true"
    prefix = f"""{name_prefix}orders AS (SELECT o.* FROM core.orders o WHERE {where}),
    {name_prefix}items AS (SELECT i.* FROM core.order_items i JOIN {name_prefix}orders o USING(order_id)),
    {name_prefix}metric_items AS (SELECT fi.* FROM {name_prefix}items fi JOIN core.products fp USING(product_id) WHERE {item_where})"""
    return prefix, params


def compile_metric(metric_id: str, filters: Filters):
    report, field = resolve(metric_id)
    prefix, params = scope_sql(filters)
    # Only static, versioned SQL templates are rewritten; parameters remain bound.
    def scoped(sql):
        item_table = "metric_items" if report["id"] in {"block_a.1", "block_a.2", "block_a.5"} else "items"
        return sql.replace("core.orders", "orders").replace("core.order_items", item_table)
    if "dashboard_base" in report:
        extra = ", ".join(f"{name} AS ({scoped(sql)})" for name, sql in report["dashboard_base"].items())
        sql = f"WITH {prefix}, {extra} {scoped(report['sql'])}"
    else:
        sql = scoped(report["sql"])
        if report["id"] == "block_a.1" and (filters.start_date or filters.end_date):
            params["calendar_start"] = filters.start_date or "2016-09-01"
            params["calendar_end"] = filters.end_date or "2018-09-01"
            sql = sql.replace("'2016-09-01'::date, '2018-08-01'", "date_trunc('month', %(calendar_start)s::date), date_trunc('month', %(calendar_end)s::date - 1)")
        if sql.lstrip().upper().startswith("WITH "):
            sql = f"WITH {prefix}, " + sql.lstrip()[5:]
        else:
            sql = f"WITH {prefix} {sql}"
    return report, field, sql, params


async def query_metric(metric_id: str, filters: Filters) -> dict:
    report, field, sql, params = compile_metric(metric_id, filters)
    table = await db.query(sql, params)
    if "dashboard_base" in report:
        payload = next(iter(table["rows"][0].values())) if table["rows"] else None
        if field:
            payload = {field: (payload or {}).get(field)}
        rows = payload if isinstance(payload, list) else [payload] if payload is not None else []
        table = {"columns": [{"name": k, "type": type(v).__name__} for k, v in (rows[0] if rows else {}).items()],
                 "rows": rows, "truncated": False}
    return {"metric_id": metric_id, "table": table, "definition": report["definitions"],
            "units": report["units"], "limitations": report["limitations"],
            "filters": filters.model_dump(mode="json"), "sql": sql,
            "parameters": serializable(params),
            "metrics_version": METRICS_VERSION, "data_version": await db.version()}


def legacy_dashboard_sql():
    # Keep the original exporter shape, but all query text comes from the registry.
    queries = {}
    for key in ["kpi", "checks", "monthly", "states", "lateness", "sellers"]:
        _, _, sql, _ = compile_metric("dashboard." + key, Filters())
        queries[key] = sql
    return "SELECT 1;", queries
