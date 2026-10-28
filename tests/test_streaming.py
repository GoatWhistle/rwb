import json
import asyncio
import pytest
from fastapi.testclient import TestClient
from backend.agent import TextFieldStream
from backend.models import AgentAnswer
from backend import storage
from backend.app import app
import backend.app as api


def test_structured_text_stream_handles_escapes():
    text = 'Сумма: 159,88.\n"Заказ" и символ 😀'
    payload = json.dumps({"text":text,"charts":[]},ensure_ascii=True)
    decoder = TextFieldStream()
    visible = ''.join(decoder.feed(c) for c in payload)
    assert visible == text


def test_structured_text_stream_keeps_details_out_of_visible_answer():
    answer = AgentAnswer(text="Найден пример, не общая статистика.",
                         details='Цитата: "original". review_id: review-1')
    decoder = TextFieldStream()
    visible = ''.join(decoder.feed(char) for char in answer.model_dump_json())
    assert visible == answer.text
    assert "review-1" not in visible


def test_sse_contract_and_sqlite_history(monkeypatch,tmp_path):
    monkeypatch.setattr(storage,"LOCAL_DB",tmp_path/"chat.sqlite3")
    async def fake_run(message,context,session):
        await session.add_items([{"role":"user","content":message}])
        await context.emit("tool_started",{"call_id":"c1","name":"query_metrics"})
        await context.emit("table",{"table_id":"t1","columns":[{"name":"revenue"}],"rows":[{"revenue":"12.34"}],"truncated":False})
        await context.emit("text_delta",{"delta":"Проверено"})
        await context.emit("sources",{"items":[{"type":"sql","id":"c1"}]})
        return AgentAnswer(text="Проверено")
    monkeypatch.setattr(api,"run_agent",fake_run)
    with TestClient(app) as client:
        response=client.post('/api/chat/stream',json={"session_id":"demo","message":"Покажи выручку"})
    assert response.status_code==200
    assert response.headers['content-type'].startswith('text/event-stream')
    events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    assert all(e['session_id']=='demo' and e['run_id']==events[0]['run_id'] for e in events)
    assert 'event: done' in response.text and 'event: table' in response.text
    import sqlite3
    with sqlite3.connect(storage.LOCAL_DB) as conn:
        assert conn.execute("SELECT count(*) FROM agent_messages").fetchone()[0]==1
        assert conn.execute("SELECT count(*) FROM run_events").fetchone()[0]>=6
    assert 'demo' not in api.active_sessions


def test_sse_error_is_terminal_and_redacted(monkeypatch,tmp_path):
    monkeypatch.setattr(storage,"LOCAL_DB",tmp_path/"chat.sqlite3")
    async def failed(*args):
        raise RuntimeError('secret-key-must-not-appear')
    monkeypatch.setattr(api,"run_agent",failed)
    with TestClient(app) as client:
        response=client.post('/api/chat/stream',json={"message":"Привет"})
    assert 'event: error' in response.text
    assert 'secret-key' not in response.text
    assert 'event: done' not in response.text


def test_validation():
    with TestClient(app) as client:
        assert client.post('/api/chat/stream',json={"message":""}).status_code==422
        assert client.post('/api/metrics/query',json={"metric_id":"block_a.1","filters":{"unsupported":1}}).status_code==422


async def test_disconnect_cancels_worker_and_releases_session(monkeypatch,tmp_path):
    monkeypatch.setattr(storage,"LOCAL_DB",tmp_path/"chat.sqlite3")
    stopped=asyncio.Event()
    disconnected=asyncio.Event()
    async def busy(message,context,session):
        try:
            for _ in range(1000):
                await context.emit('text_delta',{'delta':'a'})
            await asyncio.sleep(60)
        finally:
            stopped.set()
    monkeypatch.setattr(api,'run_agent',busy)
    first=True
    sent=[]
    async def receive():
        nonlocal first
        if first:
            first=False
            return {'type':'http.request','body':json.dumps({'session_id':'cancel-test','message':'hello'}).encode(),'more_body':False}
        await disconnected.wait()
        return {'type':'http.disconnect'}
    async def send(message):
        sent.append(message)
        if message['type']=='http.response.body' and b'event: text_delta' in message.get('body',b''):
            disconnected.set()
            await asyncio.sleep(0)
    scope={'type':'http','asgi':{'version':'3.0','spec_version':'2.0'},'http_version':'1.1',
        'method':'POST','scheme':'http','path':'/api/chat/stream','query_string':b'',
        'headers':[(b'content-type',b'application/json')],'server':('test',80),'client':('test',1),'root_path':''}
    await asyncio.wait_for(app(scope,receive,send),timeout=3)
    assert stopped.is_set(), sent
    assert 'cancel-test' not in api.active_sessions
