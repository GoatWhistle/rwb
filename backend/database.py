import datetime
import decimal
import hashlib
import json
from typing import Any
import psycopg
from psycopg.rows import dict_row
from .config import settings


def serializable(value: Any) -> Any:
    if isinstance(value, decimal.Decimal):
        return str(value)  # preserve money exactly
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: serializable(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [serializable(v) for v in value]
    return value


class Database:
    async def query(self, sql: str, params=None, *, limit: int | None = None) -> dict:
        cfg = settings()
        limit = limit or cfg.sql_row_limit
        async with await psycopg.AsyncConnection.connect(
            cfg.database_url, row_factory=dict_row,
            options="-c default_transaction_read_only=on -c search_path=pg_catalog,core,mart,public",
        ) as conn:
            await conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(cfg.sql_timeout_ms),))
            async with conn.cursor() as cur:
                await cur.execute(sql, params)
                rows = await cur.fetchmany(limit + 1)
                columns = [{"name": c.name, "postgres_oid": c.type_code} for c in cur.description or []]
        return {"columns": columns, "rows": serializable(rows[:limit]), "truncated": len(rows) > limit}

    async def version(self) -> str:
        # Cheap snapshot identity. Index freshness is checked using review content hashes separately.
        result = await self.query("""SELECT count(*) AS orders, max(purchased_at) AS latest,
          (SELECT count(*) FROM core.order_items) AS items,
          (SELECT sum(price) FROM core.order_items) AS prices,
          (SELECT count(*) FROM core.order_reviews) AS reviews FROM core.orders""")
        return hashlib.sha256(json.dumps(result["rows"], sort_keys=True).encode()).hexdigest()[:16]


db = Database()
