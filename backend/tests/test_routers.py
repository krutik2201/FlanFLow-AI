"""Router integration tests."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestWayfindingNodes:
    def test_nodes_endpoint_returns_all_nodes(self, client):
        resp = client.get("/wayfinding/nodes")
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert len(data["nodes"]) >= 30

    def test_nodes_have_required_fields(self, client):
        resp = client.get("/wayfinding/nodes")
        nodes = resp.json()["nodes"]
        for node in nodes[:5]:
            assert "id" in node
            assert "name" in node
            assert "type" in node
            assert "x" in node
            assert "y" in node


class TestWayfindingRoute:
    def test_standard_route_returns_200(self, client):
        with patch("app.genai.phrasing.genai.complete", return_value=None):
            resp = client.get(
                "/wayfinding/route",
                params={"origin": "gate_a", "destination": "sec_101"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"][0] == "gate_a"
        assert data["nodes"][-1] == "sec_101"

    def test_accessible_route_avoids_stairs(self, client):
        with patch("app.genai.phrasing.genai.complete", return_value=None):
            resp = client.get(
                "/wayfinding/route",
                params={"origin": "gate_a", "destination": "sec_101", "mode": "accessible"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "elevator_north" in data["nodes"]

    def test_invalid_mode_returns_422(self, client):
        resp = client.get(
            "/wayfinding/route",
            params={"origin": "gate_a", "destination": "sec_101", "mode": "flying"},
        )
        assert resp.status_code == 422

    def test_same_node_returns_zero_distance(self, client):
        with patch("app.genai.phrasing.genai.complete", return_value=None):
            resp = client.get(
                "/wayfinding/route",
                params={"origin": "gate_a", "destination": "gate_a"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_distance_m"] == 0.0


class TestTransportScore:
    def test_transit_score(self, client):
        with patch("app.genai.client._client.complete", return_value=None):
            resp = client.get("/transport/score?mode=transit")
        assert resp.status_code == 200
        data = resp.json()
        assert data["carbon_g"] > 0
        assert "all_modes" in data
        assert len(data["all_modes"]) == 4

    def test_walk_zero_carbon(self, client):
        with patch("app.genai.client._client.complete", return_value=None):
            resp = client.get("/transport/score?mode=walk")
        data = resp.json()
        assert data["carbon_g"] == 0


class TestOpsEndpoints:
    def test_triage_endpoint_exists(self, client):
        with patch("app.genai.triage.genai.complete", return_value=None):
            resp = client.post("/ops/triage", json={"transcript": "broken seat in section 5"})
        assert resp.status_code == 200

    def test_copilot_offline(self, client):
        resp = client.post(
            "/ops/staff/copilot",
            json={"question": "Where is the medical station?", "ai_offline": True},
        )
        assert resp.status_code == 200
        assert resp.json()["fallback_mode"] is True

    def test_latest_telemetry(self, client):
        resp = client.get("/ops/telemetry/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert "gates" in data
        assert "zones" in data
        assert "transit" in data
