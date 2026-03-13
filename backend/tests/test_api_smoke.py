from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
import main as backend_main


class DummyCursor:
    def __init__(self):
        self.last_query = ""

    def execute(self, query, params=None):
        self.last_query = query

    def fetchone(self):
        if "COUNT(*)" in self.last_query.upper():
            return (0,)
        return (1,)

    def fetchall(self):
        return []

    def close(self):
        return None


class DummyConnection:
    def __init__(self):
        self._cursor = DummyCursor()

    def cursor(self):
        return self._cursor

    def commit(self):
        return None

    def rollback(self):
        return None

    def close(self):
        return None


def test_root_endpoint(monkeypatch):
    monkeypatch.setattr(backend_main, "ENABLE_SENSOR_COLLECTOR", False)
    monkeypatch.setattr(backend_main, "MODEL_PRELOAD_ON_STARTUP", False)
    monkeypatch.setattr(backend_main, "get_connection", lambda: DummyConnection())

    with TestClient(backend_main.app) as client:
        response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "water-level-monitoring-api"
    assert payload["status"] == "ok"


def test_health_endpoint(monkeypatch):
    monkeypatch.setattr(backend_main, "ENABLE_SENSOR_COLLECTOR", False)
    monkeypatch.setattr(backend_main, "MODEL_PRELOAD_ON_STARTUP", False)
    monkeypatch.setattr(backend_main, "get_connection", lambda: DummyConnection())

    with TestClient(backend_main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["database"] == "configured"
    assert "model_loaded" in payload
