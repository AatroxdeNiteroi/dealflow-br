"""Smoke test do backend — confirma que a app sobe + endpoints existem."""

from __future__ import annotations

from fastapi.testclient import TestClient

from dealflow_api.main import app


def test_root_responds():
    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    assert "dealflow-api" in r.json()["app"]


def test_health_ok():
    client = TestClient(app)
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
