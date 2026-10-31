import pytest
from fastapi.testclient import TestClient
from backend import storage
from backend import widgets
from backend.app import app
from backend.widgets import WidgetColumn, WidgetPlan


class FakeDB:
    def __init__(self):
        self.calls = []

    async def query(self, sql, params=None, *, limit=None):
        self.calls.append((sql, params, limit))
        if "information_schema" in sql:
            return {"columns": [], "rows": [
                {"table_schema": "core", "table_name": "orders", "column_name": "customer_state", "data_type": "text"}],
                "truncated": False}
        return {"columns": [{"name": "state"}, {"name": "orders"}],
                "rows": [{"state": "SP", "orders": 41746}, {"state": "RJ", "orders": 12852}], "truncated": False}


PLAN = WidgetPlan(title="Заказы по штатам", description="Число заказов по штату покупателя.", kind="hbar",
    sql="SELECT customer_state AS state, count(*) AS orders FROM core.orders GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
    x="state", y=["orders"],
    columns=[WidgetColumn(name="state", label="Штат", type="text"),
             WidgetColumn(name="orders", label="Заказы", type="number")])


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "LOCAL_DB", tmp_path / "agent.sqlite3")
    fake = FakeDB()
    monkeypatch.setattr(widgets, "db", fake)
    with TestClient(app) as test_client:
        test_client.fake = fake
        yield test_client


def draft(**overrides):
    return {"title": "KPI", "description": "", "kind": "kpi", "sql": "SELECT count(*) AS n FROM core.orders",
            "columns": [{"name": "n", "label": "Заказы", "type": "number"}], "rows": [{"n": 99441}],
            "x": None, "y": ["n"], "source": "chat", "prompt": None, "filters": None, **overrides}


def test_widget_and_dashboard_crud_roundtrip(client):
    first = client.post("/api/widgets", json=draft()).json()
    second = client.post("/api/widgets", json=draft(title="Второй")).json()
    assert first["id"] and first["created_at"]
    assert [w["id"] for w in client.get("/api/widgets").json()["items"]] == [second["id"], first["id"]]

    board = client.post("/api/dashboards", json={"title": "Мой"}).json()
    assert board["items"] == []
    board["items"] = [{"widget_id": first["id"], "size": "m"}, {"widget_id": second["id"], "size": "xl"},
                      {"widget_id": "missing", "size": "s"}]
    updated = client.put(f"/api/dashboards/{board['id']}", json=board).json()
    assert [i["widget_id"] for i in updated["items"]] == [first["id"], second["id"]]

    assert client.delete(f"/api/widgets/{first['id']}").status_code == 204
    assert [w["id"] for w in client.get("/api/widgets").json()["items"]] == [second["id"]]
    stored = client.get("/api/dashboards").json()["items"][0]
    assert [i["widget_id"] for i in stored["items"]] == [second["id"]]

    assert client.delete(f"/api/dashboards/{board['id']}").status_code == 204
    assert client.get("/api/dashboards").json()["items"] == []
    missing = client.delete("/api/widgets/unknown")
    assert missing.status_code == 404 and missing.json()["code"] == "not_found"


def test_refresh_reruns_guarded_sql_with_filters(client):
    widget = client.post("/api/widgets", json=draft(kind="bar", x="state", y=["orders"], columns=[],
        sql="SELECT customer_state AS state, count(*) AS orders FROM core.orders GROUP BY 1")).json()
    refreshed = client.post(f"/api/widgets/{widget['id']}/refresh", json={"filters": {"states": ["SP"]}}).json()
    sql, params, limit = client.fake.calls[-1]
    assert "_agent_orders" in sql and params == {"states": ["SP"]} and limit == 500
    assert refreshed["rows"][0] == {"state": "SP", "orders": 41746}
    assert refreshed["filters"]["states"] == ["SP"]


def test_generate_uses_db_rows_not_model_numbers(client, monkeypatch):
    seen = {}

    async def fake_plan(prompt, filters, schema):
        seen.update(prompt=prompt, filters=filters, schema=schema)
        return PLAN
    monkeypatch.setattr(widgets, "plan_widget", fake_plan)
    response = client.post("/api/widgets/generate", json={"prompt": "Топ штатов", "filters": {"states": ["SP", "RJ"]}})
    assert response.status_code == 200
    body = response.json()
    widget = body["widget"]
    assert widget["source"] == "agent" and widget["prompt"] == "Топ штатов"
    assert widget["rows"] == [{"state": "SP", "orders": 41746}, {"state": "RJ", "orders": 12852}]
    assert widget["x"] == "state" and widget["y"] == ["orders"] and widget["kind"] == "hbar"
    assert widget["filters"]["states"] == ["SP", "RJ"]
    assert "core.orders(customer_state text)" in seen["schema"]
    sql, params, limit = client.fake.calls[-1]
    assert sql.endswith("LIMIT 501") and params == {"states": ["SP", "RJ"]} and limit == 500
    assert body["answer"] and "id" not in widget
    assert client.get("/api/widgets").json()["items"] == []


def test_generate_rejected_sql_returns_error(client, monkeypatch):
    async def fake_plan(*args):
        return PLAN.model_copy(update={"sql": "DELETE FROM core.orders"})
    monkeypatch.setattr(widgets, "plan_widget", fake_plan)
    response = client.post("/api/widgets/generate", json={"prompt": "Удали", "filters": {}})
    assert response.status_code == 422
    assert response.json()["code"] == "sql_rejected"
    assert all("DELETE" not in sql for sql, _, _ in client.fake.calls)


def test_generate_llm_failure_returns_502(client, monkeypatch):
    async def broken(*args):
        raise RuntimeError("secret")
    monkeypatch.setattr(widgets, "plan_widget", broken)
    response = client.post("/api/widgets/generate", json={"prompt": "Что-нибудь", "filters": {}})
    assert response.status_code == 502
    assert response.json()["code"] == "llm_unavailable" and "secret" not in response.json()["message"]


def test_generate_missing_column_is_rejected(client, monkeypatch):
    async def fake_plan(*args):
        return PLAN.model_copy(update={"y": ["revenue"]})
    monkeypatch.setattr(widgets, "plan_widget", fake_plan)
    response = client.post("/api/widgets/generate", json={"prompt": "Выручка", "filters": {}})
    assert response.status_code == 422 and response.json()["code"] == "widget_invalid"
