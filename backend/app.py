import asyncio
import json
import uuid
import anyio
from contextlib import suppress
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .config import settings
from .database import db
from .metrics import catalog, query_metric, METRICS_VERSION
from .models import ChatRequest, MetricQuery
from .storage import session, record
from .tools import ToolContext
from .agent import run_agent

app = FastAPI(title="Capibara metrics and AI",version="0.1.0")
app.add_middleware(CORSMiddleware,allow_origins=settings().cors_origins,
                   allow_methods=["GET","POST"],allow_headers=["Content-Type"])
active_sessions: set[str] = set()


class ManagedStreamingResponse(StreamingResponse):
    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # async-for does not guarantee closing an async generator on a send-side
            # disconnect. Close it explicitly to release the SDK run and SQLite session.
            with anyio.CancelScope(shield=True):
                close = getattr(self.body_iterator, "aclose", None)
                if close:
                    await close()


@app.get("/api/metrics")
async def metrics():
    return catalog()


@app.post("/api/metrics/query")
async def metric_query(request: MetricQuery):
    try:
        return await query_metric(request.metric_id, request.filters)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503,"Расчёт недоступен; проверьте PostgreSQL и сборку core") from exc


@app.get("/api/health")
async def health():
    try:
        version = await db.version()
        state = await db.query("SELECT model,indexed_at,review_count FROM ai.index_state WHERE singleton")
        return {"status":"ok","database":"ok","data_version":version,"metrics_version":METRICS_VERSION,
                "review_index":state["rows"] or "not_ready"}
    except Exception:
        raise HTTPException(503,"PostgreSQL/core/ai недоступны; выполните настройку из README")


@app.post("/api/chat/stream")
async def chat(request: ChatRequest):
    session_id = request.session_id or uuid.uuid4().hex
    if session_id in active_sessions:
        raise HTTPException(409,"В этом диалоге уже выполняется запрос")
    active_sessions.add(session_id)
    run_id = uuid.uuid4().hex

    async def stream():
        queue = asyncio.Queue(maxsize=100)
        saved_session = session(session_id)

        async def emit(event, payload):
            payload = {"run_id":run_id,"session_id":session_id,**payload}
            # Persist final messages and tool evidence, rather than one SQLite write per token.
            if event != "text_delta":
                await record(run_id,session_id,event,payload)
            await queue.put((event,payload))

        async def worker():
            try:
                await emit("run_started", {"metrics_version":METRICS_VERSION})
                await record(run_id,session_id,"user_message",request.model_dump(mode="json"))
                context = ToolContext(request.dashboard_context,emit)
                async with asyncio.timeout(settings().run_timeout_seconds):
                    answer = await run_agent(request.message,context,saved_session)
                await emit("done", {"text":answer.text})
            except asyncio.CancelledError:
                await record(run_id,session_id,"cancelled",{})
                raise
            except Exception as exc:
                await emit("error", {"code":type(exc).__name__,"message":"Запрос не завершён. Проверьте доступность модели и БД; результаты выполненных инструментов сохранены."})
            finally:
                # A disconnected client no longer drains the queue. Never block cancellation
                # trying to enqueue the terminal sentinel into a full queue.
                if not asyncio.current_task().cancelling():
                    await queue.put(None)

        task = asyncio.create_task(worker())
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(),timeout=15)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                if item is None:
                    break
                event,payload = item
                yield f"event: {event}\ndata: {json.dumps(payload,ensure_ascii=False)}\n\n"
        finally:
            # Starlette cancels its AnyIO scope on disconnect; shield resource cleanup.
            with anyio.CancelScope(shield=True):
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
                saved_session.close()
                active_sessions.discard(session_id)

    return ManagedStreamingResponse(stream(),media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})
