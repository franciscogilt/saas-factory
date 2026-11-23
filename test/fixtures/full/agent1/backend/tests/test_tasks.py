from fastapi.testclient import TestClient
from app.main import app


def test_list_tasks():
    r = TestClient(app).get("/api/tasks")
    assert r.status_code == 200
    assert r.json()[0]["title"] == "Primera tarea"
