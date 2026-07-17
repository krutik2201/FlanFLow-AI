"""WebSocket router — broadcasts live telemetry snapshots."""

from __future__ import annotations

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Active WebSocket connections
_connections: list[WebSocket] = []


@router.websocket("/ws/telemetry")
async def telemetry_ws(websocket: WebSocket):
    await websocket.accept()
    _connections.append(websocket)
    try:
        while True:
            # Keep connection alive; telemetry is pushed by the simulator broadcast
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        _connections.remove(websocket)


async def broadcast_snapshot(snapshot_json: str) -> None:
    """Called by the simulator to push snapshots to all clients."""
    dead: list[WebSocket] = []
    for ws in list(_connections):
        try:
            await ws.send_text(snapshot_json)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _connections:
            _connections.remove(ws)
