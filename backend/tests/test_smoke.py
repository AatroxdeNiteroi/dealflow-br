"""Smoke tests do backend — confirma que app sobe + endpoints funcionam contra parquet real."""

from __future__ import annotations

from fastapi.testclient import TestClient

from dealflow_api.main import app

client = TestClient(app)


def test_root_responds() -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert "dealflow-api" in r.json()["app"]


def test_health_ok() -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_filtros_domains() -> None:
    r = client.get("/api/v1/filtros")
    assert r.status_code == 200
    body = r.json()
    assert "RJ" in body["ufs"] and "SP" in body["ufs"]
    assert "alta" in body["confidences"]
    assert "family_mature_sweet_spot" in body["archetypes"]
    assert body["total_empresas"] > 50_000


def test_empresas_basic() -> None:
    r = client.get("/api/v1/empresas?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 5
    assert body["total"] > 50_000
    assert "cnpj" in body["items"][0]
    assert "receita_point_brl" in body["items"][0]


def test_empresas_filters() -> None:
    r = client.get(
        "/api/v1/empresas?uf=RJ&confidence=alta&archetype=family_mature_sweet_spot&limit=10"
    )
    assert r.status_code == 200
    body = r.json()
    for item in body["items"]:
        assert item["sigla_uf"] == "RJ"
        assert item["confidence"] == "alta"
        assert item["archetype"] == "family_mature_sweet_spot"


def test_empresas_search() -> None:
    r = client.get("/api/v1/empresas?search=VIDROPORTO")
    body = r.json()
    assert body["total"] >= 1
    assert "VIDROPORTO" in body["items"][0]["razao_social"]


def test_empresas_receita_range() -> None:
    r = client.get("/api/v1/empresas?receita_min_brl=5000000&receita_max_brl=50000000&limit=20")
    body = r.json()
    for item in body["items"]:
        rec = item["receita_point_brl"]
        if rec is not None:
            assert 5_000_000 <= rec <= 50_000_000
