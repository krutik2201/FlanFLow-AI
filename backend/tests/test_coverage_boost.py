"""
Additional coverage tests to push overall backend coverage to ≥90%.
Covers: GenAI client circuit breaker, ops_advisor, ops router copilot/recommend paths.
"""

import pytest
import time
import httpx
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.genai.client import GenAIClient, CircuitState, CB_FAILURE_THRESHOLD
from app.genai.ops_advisor import generate_recommendation
from app.models.telemetry import (
    TelemetrySnapshot, GateStatus, ZoneDensity, TransitStatus, StaffLevel
)
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_snapshot(overall: float = 45.0) -> TelemetrySnapshot:
    return TelemetrySnapshot(
        timestamp=datetime.now(timezone.utc),
        gates=[GateStatus(gate_id="gate_a", gate_name="Gate A", queue_time_min=3.0, crowd_pct=30.0)],
        zones=[ZoneDensity(zone_id="conc_north", zone_name="North Concourse",
                           density_pct=overall, congestion_multiplier=1.5, status="busy")],
        transit=[TransitStatus(mode="rail", eta_min=8.0, status="on_time", line_name="Metro Line 2")],
        staff=[StaffLevel(gate_id="gate_a", gate_name="Gate A", staff_count=5, capacity=10)],
        overall_venue_density_pct=overall,
    )


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# GenAI Client — circuit breaker paths
# ---------------------------------------------------------------------------

class TestGenAIClientCircuitBreaker:
    def test_no_api_key_returns_none(self):
        c = GenAIClient()
        c._client = None
        result = c.complete("system", "user")
        assert result is None

    def test_circuit_open_returns_none_immediately(self):
        c = GenAIClient()
        c._api_key = "dummy_key"
        c._cb_state = CircuitState.OPEN
        c._cb_opened_at = time.monotonic()  # just opened — not expired
        result = c.complete("system", "user")
        assert result is None

    def test_circuit_half_open_after_timeout(self):
        c = GenAIClient()
        c._cb_state = CircuitState.OPEN
        c._cb_opened_at = time.monotonic() - 61.0  # expired — should go half-open
        # _check_circuit should allow the call (transition to HALF_OPEN)
        result = c._check_circuit()
        assert result is True
        assert c._cb_state == CircuitState.HALF_OPEN

    def test_on_success_resets_failures(self):
        c = GenAIClient()
        c._cb_failures = 5
        c._on_success()
        assert c._cb_failures == 0
        assert c._cb_state == CircuitState.CLOSED

    def test_on_failure_increments_count(self):
        c = GenAIClient()
        c._on_failure()
        assert c._cb_failures == 1
        assert c._cb_state == CircuitState.CLOSED

    def test_on_failure_opens_circuit_at_threshold(self):
        c = GenAIClient()
        for _ in range(CB_FAILURE_THRESHOLD):
            c._on_failure()
        assert c._cb_state == CircuitState.OPEN

    def test_closed_circuit_allows_calls(self):
        c = GenAIClient()
        assert c._check_circuit() is True

    def test_open_unexpired_circuit_blocks(self):
        c = GenAIClient()
        c._cb_state = CircuitState.OPEN
        c._cb_opened_at = time.monotonic()
        assert c._check_circuit() is False

    def test_api_error_triggers_failure(self):
        c = GenAIClient()
        c._api_key = "dummy_key"
        # Mock httpx.Client.post to raise HTTPStatusError
        with patch("httpx.Client.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 500
            mock_post.side_effect = httpx.HTTPStatusError(
                "API Error", request=MagicMock(), response=mock_resp
            )
            result = c.complete("sys", "user")
            assert result is None
            assert c._cb_failures >= 1

    def test_unexpected_exception_triggers_failure(self):
        c = GenAIClient()
        c._api_key = "dummy_key"
        with patch("httpx.Client.post") as mock_post:
            mock_post.side_effect = RuntimeError("unexpected")
            result = c.complete("sys", "user")
            assert result is None
            assert c._cb_failures >= 1

    def test_circuit_half_open_direct_check(self):
        c = GenAIClient()
        c._cb_state = CircuitState.HALF_OPEN
        assert c._check_circuit() is True

    def test_api_success_flow(self):
        c = GenAIClient()
        c._api_key = "dummy_key"
        with patch("httpx.Client.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Mocked successful phrasing text."}]
                        }
                    }
                ]
            }
            mock_post.return_value = mock_resp
            result = c.complete("sys", "user")
            assert result == "Mocked successful phrasing text."
            assert c._cb_failures == 0
            assert c._cb_state == CircuitState.CLOSED

    def test_timeout_retry_exhaustion(self):
        c = GenAIClient()
        c._api_key = "dummy_key"
        with patch("httpx.Client.post") as mock_post, patch("time.sleep") as mock_sleep:
            mock_post.side_effect = httpx.TimeoutException("timeout")
            result = c.complete("sys", "user")
            assert result is None
            assert c._cb_failures >= 1
            # Verify retry logic actually slept
            assert mock_sleep.call_count >= 1


# ---------------------------------------------------------------------------
# Ops Advisor
# ---------------------------------------------------------------------------

class TestOpsAdvisor:
    def test_ai_offline_returns_fallback_text(self):
        snap = make_snapshot()
        text, fallback = generate_recommendation(snap, ai_offline=True)
        assert fallback is True
        assert len(text) > 10

    def test_genai_none_returns_fallback(self):
        snap = make_snapshot()
        with patch("app.genai.ops_advisor.genai.complete", return_value=None):
            text, fallback = generate_recommendation(snap, ai_offline=False)
        assert fallback is True

    def test_genai_response_returned(self):
        snap = make_snapshot()
        with patch("app.genai.ops_advisor.genai.complete", return_value="Open Gate D2 immediately."):
            text, fallback = generate_recommendation(snap, ai_offline=False)
        assert fallback is False
        assert "Gate D2" in text

    def test_congested_zones_highlighted(self):
        snap = make_snapshot(overall=80.0)
        snap.zones[0].density_pct = 80.0
        snap.zones[0].status = "congested"
        with patch("app.genai.ops_advisor.genai.complete", return_value="Direct staff now.") as mock:
            generate_recommendation(snap, ai_offline=False)
            call_args = mock.call_args[1]["user"]
            assert "North Concourse" in call_args


# ---------------------------------------------------------------------------
# Ops router additional paths
# ---------------------------------------------------------------------------

class TestOpsRouterAdditional:
    def test_recommend_with_genai(self, client):
        snap = make_snapshot()
        with patch("app.genai.ops_advisor.genai.complete", return_value="Redirect fans to Gate B."):
            resp = client.post("/ops/recommend", content=snap.model_dump_json(),
                               headers={"Content-Type": "application/json"})
        assert resp.status_code == 200
        data = resp.json()
        assert "recommendation" in data
        assert data["fallback_mode"] is False

    def test_recommend_ai_offline(self, client):
        snap = make_snapshot()
        resp = client.post(
            "/ops/recommend?ai_offline=true",
            content=snap.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["fallback_mode"] is True

    def test_copilot_with_genai(self, client):
        with patch("app.genai.client._client.complete", return_value="The medical station is near Gate A."):
            resp = client.post(
                "/ops/staff/copilot",
                json={"question": "Where is the medical station?", "ai_offline": False},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fallback_mode"] is False

    def test_copilot_genai_unavailable(self, client):
        with patch("app.genai.client._client.complete", return_value=None):
            resp = client.post(
                "/ops/staff/copilot",
                json={"question": "Where is the medical station?", "ai_offline": False},
            )
        assert resp.status_code == 200
        assert resp.json()["fallback_mode"] is True

    def test_latest_telemetry_none_triggers_tick(self, client):
        sim = app.state.simulator
        old_latest = sim._latest
        try:
            sim._latest = None
            resp = client.get("/ops/telemetry/latest")
            assert resp.status_code == 200
            assert resp.json() is not None
        finally:
            sim._latest = old_latest


# ---------------------------------------------------------------------------
# Transport router additional paths
# ---------------------------------------------------------------------------

class TestTransportRouterAdditional:
    def test_transit_score_with_ai(self, client):
        with patch("app.genai.client._client.complete", return_value="Great choice! Using Metro Line 2 saves carbon."):
            resp = client.get("/transport/score?mode=transit")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary_text"] == "Great choice! Using Metro Line 2 saves carbon."
        assert data["fallback_mode"] is False


# ---------------------------------------------------------------------------
# Wayfinding phrasing additional paths
# ---------------------------------------------------------------------------

class TestWayfindingPhrasingAdditional:
    def test_route_phrasing_success(self, client):
        with patch("app.genai.phrasing.genai.complete", return_value="Head towards Concourse 101 directly."):
            resp = client.get(
                "/wayfinding/route",
                params={"origin": "gate_a", "destination": "sec_101"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["phrased_directions"] == "Head towards Concourse 101 directly."
        assert data["fallback_mode"] is False


# ---------------------------------------------------------------------------
# WebSocket router
# ---------------------------------------------------------------------------

class TestWebSocketRouter:
    @pytest.mark.asyncio
    async def test_telemetry_ws_lifecycle_direct(self):
        from app.routers.ws import telemetry_ws, _connections
        from fastapi import WebSocketDisconnect
        import asyncio

        mock_ws = MagicMock()
        async def mock_accept():
            pass
        mock_ws.accept = mock_accept

        first_call = True
        async def mock_sleep(delay):
            nonlocal first_call
            if first_call:
                first_call = False
                raise WebSocketDisconnect()
            raise RuntimeError("Should not sleep again")

        initial_len = len(_connections)
        with patch("asyncio.sleep", mock_sleep):
            await telemetry_ws(mock_ws)

        assert len(_connections) == initial_len

    @pytest.mark.asyncio
    async def test_broadcast_snapshot_success(self):
        from app.routers.ws import _connections, broadcast_snapshot
        mock_ws = MagicMock()
        async def mock_send(text):
            mock_ws.sent_text = text
        mock_ws.send_text = mock_send
        _connections.append(mock_ws)
        try:
            await broadcast_snapshot('{"test": "val"}')
            assert mock_ws.sent_text == '{"test": "val"}'
        finally:
            _connections.remove(mock_ws)

    @pytest.mark.asyncio
    async def test_broadcast_snapshot_dead_cleanup(self):
        from app.routers.ws import _connections, broadcast_snapshot
        mock_ws = MagicMock()
        async def mock_send_fail(text):
            raise RuntimeError("disconnected")
        mock_ws.send_text = mock_send_fail
        _connections.append(mock_ws)
        try:
            await broadcast_snapshot('{"test": "val"}')
            assert mock_ws not in _connections
        finally:
            if mock_ws in _connections:
                _connections.remove(mock_ws)

    @pytest.mark.asyncio
    async def test_simulator_run_handles_broadcast_error(self):
        import asyncio
        from app.telemetry.simulator import TelemetrySimulator
        sim = TelemetrySimulator(seed=100)
        with patch("app.routers.ws.broadcast_snapshot", side_effect=RuntimeError("broadcast failed")), \
             patch("asyncio.sleep", side_effect=asyncio.CancelledError()):
            try:
                await sim.run()
            except asyncio.CancelledError:
                pass


