import asyncio
import hashlib
import math
import argparse
import psycopg
from psycopg.rows import dict_row
from openai import AsyncOpenAI
from .config import settings
from .database import db
from .metrics import scope_sql
from .models import Filters

CORPUS = """SELECT review_id, order_id, concat_ws(E'\\n',
 nullif(trim(title), ''), nullif(trim(message), '')) AS content
 FROM core.order_reviews WHERE coalesce(trim(title), '') <> '' OR coalesce(trim(message), '') <> ''"""
CORPUS_HASH = f"""SELECT md5(coalesce(string_agg(review_id || order_id || md5(content), ''
 ORDER BY review_id, order_id), '')) AS hash, count(*) AS count FROM ({CORPUS}) corpus"""


async def embed(texts: list[str], *, query=False) -> list[list[float]]:
    cfg = settings()
    if not cfg.polza_api_key:
        raise ValueError("Не задан POLZA_API_KEY для поиска отзывов")
    if query:
        texts = ["Instruct: Retrieve marketplace customer reviews relevant to this query.\nQuery: " + t for t in texts]
    async with AsyncOpenAI(api_key=cfg.polza_api_key, base_url=cfg.embedding_base_url,
                           timeout=60, max_retries=2) as client:
        # SDK requests compact base64 on the wire and decodes it back to float lists.
        response = await client.embeddings.create(model=cfg.embedding_model, input=texts)
    data = sorted(response.data, key=lambda x: x.index)
    if [v.index for v in data] != list(range(len(texts))):
        raise ValueError("Провайдер вернул неполный набор эмбеддингов")
    vectors = [v.embedding for v in data]
    for vector in vectors:
        if len(vector) != cfg.embedding_dimensions or not all(math.isfinite(x) for x in vector) or not any(vector):
            raise ValueError("Размерность или значения эмбеддинга не соответствуют индексу")
    return vectors


async def search(query: str, filters: Filters, *, top_k=8, min_score=1, max_score=5, late_only=False):
    if not 1 <= top_k <= 30 or not 1 <= min_score <= max_score <= 5:
        raise ValueError("top_k: 1–30; оценки: 1–5")
    state = await db.query("SELECT * FROM ai.index_state WHERE singleton")
    current = (await db.query(CORPUS_HASH))["rows"][0]
    if not state["rows"] or state["rows"][0]["corpus_hash"] != current["hash"] or state["rows"][0]["model"] != settings().embedding_model:
        raise ValueError("Индекс отзывов отсутствует или устарел. Запусти python -m backend.reviews index")
    vector = (await embed([query], query=True))[0]
    prefix, params = scope_sql(filters)
    params.update(vector=str(vector), model=settings().embedding_model, top_k=top_k,
                  min_score=min_score, max_score=max_score)
    late = "AND o.delivered_at::date > o.estimated_delivery_date" if late_only else ""
    sql = f"""WITH {prefix} SELECT e.review_id, e.order_id, e.content AS original_text,
      r.score, o.customer_state, o.purchased_at,
      (o.delivered_at::date > o.estimated_delivery_date) AS late,
      1 - (e.embedding <=> %(vector)s::public.vector) AS similarity
      FROM ai.review_embeddings e JOIN core.order_reviews r USING(review_id,order_id)
      JOIN orders o USING(order_id)
      WHERE e.model=%(model)s AND r.score BETWEEN %(min_score)s AND %(max_score)s {late}
      ORDER BY e.embedding <=> %(vector)s::public.vector, e.review_id, e.order_id LIMIT %(top_k)s"""
    result = await db.query(sql, params)
    return {"table": result, "filters": filters.model_dump(mode="json"),
            "query": query, "indexed_at": state["rows"][0]["indexed_at"],
            "sources": [{"type": "review", "review_id": r["review_id"], "order_id": r["order_id"]} for r in result["rows"]],
            "limitation": "Ближайшие по смыслу примеры; не статистика распространённости жалоб."}


async def index_reviews(batch_size=32):
    cfg = settings()
    if cfg.embedding_dimensions != 4096:
        raise ValueError("Текущая миграция рассчитана на 4096 измерений")
    async with await psycopg.AsyncConnection.connect(cfg.admin_database_url, row_factory=dict_row) as conn:
        # A single indexer at a time; readers see either complete old state or 'not ready'.
        await conn.execute("SELECT pg_advisory_lock(623816)")
        await conn.execute("DELETE FROM ai.index_state")
        await conn.commit()
        initial_state = await (await conn.execute(CORPUS_HASH)).fetchone()
        rows = await (await conn.execute(CORPUS + " ORDER BY review_id, order_id")).fetchall()
        existing = await (await conn.execute("SELECT review_id, order_id, content_hash, model FROM ai.review_embeddings")).fetchall()
        known = {(r["review_id"], r["order_id"]): (r["content_hash"], r["model"]) for r in existing}
        pending = [r for r in rows if known.get((r["review_id"], r["order_id"])) !=
                   (hashlib.sha256(r["content"].encode()).hexdigest(), cfg.embedding_model)]
        print(f"Reviews: {len(rows)}; to embed: {len(pending)}", flush=True)
        for start in range(0, len(pending), batch_size * 4):
            batch = pending[start:start+batch_size * 4]
            # Deduplicate identical texts within the batch without losing review/order links.
            texts = list(dict.fromkeys(r["content"] for r in batch))
            groups = [texts[n:n+batch_size] for n in range(0,len(texts),batch_size)]
            encoded = await asyncio.gather(*(embed(group) for group in groups))
            vectors = dict(zip(texts, [v for group in encoded for v in group], strict=True))
            async with conn.cursor() as cur:
                await cur.executemany("""INSERT INTO ai.review_embeddings
                  (review_id,order_id,content,content_hash,model,embedding) VALUES(%s,%s,%s,%s,%s,%s::public.vector)
                  ON CONFLICT(review_id,order_id) DO UPDATE SET content=excluded.content,
                  content_hash=excluded.content_hash, model=excluded.model, embedding=excluded.embedding""",
                  [(r["review_id"], r["order_id"], r["content"], hashlib.sha256(r["content"].encode()).hexdigest(),
                    cfg.embedding_model, str(vectors[r["content"]])) for r in batch])
            await conn.commit()
            print(f"Embedded {min(start+len(batch),len(pending))}/{len(pending)}", flush=True)
        await conn.execute(f"""DELETE FROM ai.review_embeddings e WHERE NOT EXISTS
          (SELECT 1 FROM ({CORPUS}) r WHERE r.review_id=e.review_id AND r.order_id=e.order_id)""")
        state = await (await conn.execute(CORPUS_HASH)).fetchone()
        if state != initial_state:
            raise ValueError("Отзывы изменились во время индексации; повторите запуск")
        await conn.execute("""INSERT INTO ai.index_state(singleton,model,dimensions,corpus_hash,review_count)
          VALUES(true,%s,%s,%s,%s)""", (cfg.embedding_model,cfg.embedding_dimensions,state["hash"],state["count"]))
        await conn.commit()
        print("Review index ready.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["index"])
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 128:
        parser.error("batch-size must be 1–128")
    asyncio.run(index_reviews(args.batch_size))
