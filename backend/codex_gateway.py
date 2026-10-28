"""Local Responses adapter using Codex authentication; business tools stay in the backend."""
import asyncio
import json
import os
import time
import uuid
from pathlib import Path
from contextlib import suppress
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from openai_codex.async_client import AsyncCodexClient
from openai_codex.client import CodexConfig
from pydantic import RootModel
from dotenv import load_dotenv
from .config import settings

app = FastAPI(title="Local Codex Responses gateway")
load_dotenv()
MODEL = settings().llm_model
WORK = Path(os.environ.get("GATEWAY_WORKSPACE", ".local/codex_workspace")).resolve()
WORK.mkdir(parents=True, exist_ok=True)


def event(kind, **fields):
    return {"type":kind,**fields}


@app.get("/health")
async def health():
    return {"status":"ok","model":MODEL,"transport":"Codex Python SDK / app-server"}


async def generate(body):
    loop = asyncio.get_running_loop()
    calls = asyncio.Queue()
    config = CodexConfig(codex_bin=os.environ.get("GATEWAY_CODEX_BIN") or None,
        cwd=str(WORK), config_overrides=(
            'features.shell_tool=false', 'features.unified_exec=false',
            'features.apply_patch_freeform=false', 'features.multi_agent=false',
            'features.code_mode=false', 'features.apps=false', 'mcp_servers={}',
            'web_search="disabled"', 'analytics.enabled=false',
        ), client_name="capibara_local_gateway")
    client = AsyncCodexClient(config)

    def handle(method, params):
        if method == "item/tool/call":
            loop.call_soon_threadsafe(calls.put_nowait, params)
            return {"contentItems":[{"type":"inputText","text":"Control returned to host tool runner; stop this model step."}],"success":False}
        # SDK default accepts approvals. This gateway explicitly denies every approval.
        return {"decision":"decline"}

    client._sync._approval_handler = handle
    response_id = "resp_" + uuid.uuid4().hex
    response = {"id":response_id,"object":"response","created_at":int(time.time()),
        "status":"in_progress","model":body["model"],"output":[],"error":None,
        "incomplete_details":None,"instructions":None,"metadata":{},"parallel_tool_calls":False,
        "temperature":1.0,"top_p":1.0,"tool_choice":"auto","tools":body.get("tools",[]),"usage":None}
    seq = 0
    def wrap(kind, **data):
        nonlocal seq
        seq += 1
        return event(kind,sequence_number=seq,**data)

    thread_id = turn_id = None
    try:
        await client.start()
        await client.initialize()
        tools = [{"name":t["name"],"description":t.get("description",""),"inputSchema":t["parameters"]}
                 for t in body.get("tools",[]) if t.get("type")=="function"]
        started = await client.request("thread/start", {
            "model":body["model"],"cwd":str(WORK),"sandbox":"read-only","approvalPolicy":"never",
            "ephemeral":True,"baseInstructions":"You are a dataset assistant. Use only the supplied dynamic tools. Do not inspect files, execute commands or browse. Do not narrate before tool calls. Return final output in the requested schema.",
            "developerInstructions":body.get("instructions", ""),"dynamicTools":tools,
        }, response_model=RootModel[dict])
        thread_id = started.root["thread"]["id"]
        items = body.get("input",[])
        if isinstance(items,str):
            items=[{"role":"user","content":items}]
        # Preserve actual message roles and function-call outputs; never stringify a transcript.
        replay = [{k:v for k,v in item.items() if k not in {"provider_data","id"}} for item in items]
        for item in replay:
            if "role" in item:
                item.setdefault("type", "message")
                if isinstance(item.get("content"), str):
                    item["content"] = [{"type":"input_text", "text":item["content"]}]
        prompt = "Continue the latest user request using the tool results already in history."
        if replay and replay[-1].get("role") == "user":
            last = replay.pop()
            prompt = "\n".join(p.get("text", "") for p in last.get("content", []) if p.get("type") == "input_text")
        if replay:
            await client.request("thread/inject_items", {"threadId":thread_id,"items":replay},response_model=RootModel[dict])
        params = {"effort":body.get("reasoning",{}).get("effort","medium")}
        fmt = (body.get("text") or {}).get("format") or {}
        if fmt.get("type")=="json_schema":
            params["outputSchema"] = fmt["schema"]
        turn = await client.turn_start(thread_id, prompt,params)
        turn_id = turn.turn.id
        yield wrap("response.created",response=response.copy())
        message_id = "msg_" + uuid.uuid4().hex
        message = {"id":message_id,"type":"message","role":"assistant","status":"in_progress","content":[]}
        text = ""
        text_started = False
        notify = asyncio.create_task(client.next_turn_notification(turn_id))
        tool_wait = asyncio.create_task(calls.get())
        try:
            while True:
                done,_ = await asyncio.wait([notify,tool_wait],return_when=asyncio.FIRST_COMPLETED)
                if tool_wait in done:
                    tool = tool_wait.result()
                    output_index = len(response["output"]) + int(text_started)
                    call = {"id":"fc_"+uuid.uuid4().hex,"type":"function_call", "status":"completed",
                        "call_id":tool["callId"],"name":tool["tool"],"arguments":json.dumps(tool["arguments"],ensure_ascii=False)}
                    yield wrap("response.output_item.added",output_index=output_index,item={**call,"arguments":"","status":"in_progress"})
                    yield wrap("response.function_call_arguments.delta",item_id=call["id"],output_index=output_index,delta=call["arguments"])
                    yield wrap("response.function_call_arguments.done",item_id=call["id"],output_index=output_index,arguments=call["arguments"])
                    yield wrap("response.output_item.done",output_index=output_index,item=call)
                    response["output"].append(call)
                    break
                notification = notify.result()
                method = notification.method
                data = notification.payload
                data = data.model_dump(mode="json",by_alias=True) if hasattr(data,"model_dump") else data
                if method == "item/agentMessage/delta":
                    delta = data["delta"]
                    if not text_started:
                        yield wrap("response.output_item.added",output_index=0,item=message.copy())
                        yield wrap("response.content_part.added",item_id=message_id,output_index=0,content_index=0,
                                   part={"type":"output_text","text":"","annotations":[]})
                        text_started=True
                    text += delta
                    yield wrap("response.output_text.delta",item_id=message_id,output_index=0,content_index=0,delta=delta)
                if method == "turn/completed":
                    if data.get("turn",{}).get("status") != "completed":
                        raise RuntimeError("Codex turn failed: " + str(data.get("turn", {}).get("error")))
                    if not text_started:
                        raise RuntimeError("Codex returned no text and no function call")
                    break
                if method == "error":
                    raise RuntimeError("Codex reported a model error: " + str(data))
                notify = asyncio.create_task(client.next_turn_notification(turn_id))
            if text_started:
                part = {"type":"output_text","text":text,"annotations":[]}
                yield wrap("response.output_text.done",item_id=message_id,output_index=0,content_index=0,text=text)
                yield wrap("response.content_part.done",item_id=message_id,output_index=0,content_index=0,part=part)
                message.update(status="completed",content=[part])
                yield wrap("response.output_item.done",output_index=0,item=message)
                response["output"].insert(0,message)
            response["status"]="completed"
            yield wrap("response.completed",response=response)
        finally:
            notify.cancel()
            tool_wait.cancel()
    finally:
        if thread_id and turn_id:
            with suppress(Exception):
                await client.turn_interrupt(thread_id,turn_id)
        await client.close()


@app.post("/v1/responses")
async def responses(request: Request):
    body = await request.json()
    if body.get("model") != MODEL:
        raise HTTPException(400,f"This local gateway is configured for {MODEL}")
    if body.get("previous_response_id") or body.get("conversation"):
        raise HTTPException(400,"Send full input history; server-side conversations are unsupported")
    if any(t.get("type")!="function" for t in body.get("tools",[])):
        raise HTTPException(400,"Only function tools are supported")
    async def stream():
        try:
            async with asyncio.timeout(300):
                async for item in generate(body):
                    yield "event: "+item["type"]+"\ndata: "+json.dumps(item,ensure_ascii=False)+"\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Local debugging: class only, no credentials or raw request contents.
            yield "event: error\ndata: "+json.dumps({"type":"error","code":type(exc).__name__,"message":"Codex gateway failed","param":None})+"\n\n"
    if body.get("stream"):
        return StreamingResponse(stream(),media_type="text/event-stream")
    try:
        async for item in generate(body):
            if item["type"]=="response.completed":
                return item["response"]
    except Exception as exc:
        raise HTTPException(502,"Codex gateway failed: "+type(exc).__name__) from exc
