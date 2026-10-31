import asyncio
import json
import sqlite3
from pathlib import Path
from agents import SQLiteSession

LOCAL_DB = Path(".local/agent.sqlite3")


def session(session_id: str):
    LOCAL_DB.parent.mkdir(parents=True, exist_ok=True)
    return SQLiteSession(session_id, db_path=LOCAL_DB)


def _record(run_id: str, session_id: str, event: str, payload: dict):
    LOCAL_DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(LOCAL_DB, timeout=10) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS run_events (
          id INTEGER PRIMARY KEY, run_id TEXT NOT NULL, session_id TEXT NOT NULL,
          event TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
        conn.execute("INSERT INTO run_events(run_id,session_id,event,payload) VALUES(?,?,?,?)",
                     (run_id, session_id, event, json.dumps(payload, ensure_ascii=False)))


async def record(run_id, session_id, event, payload):
    await asyncio.to_thread(_record, run_id, session_id, event, payload)
