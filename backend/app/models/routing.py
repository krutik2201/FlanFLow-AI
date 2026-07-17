"""Pydantic models for routing requests and responses."""

from __future__ import annotations

from pydantic import BaseModel


class RouteRequest(BaseModel):
    origin: str
    destination: str
    mode: str = "standard"        # "standard" | "accessible"
    congestion_aware: bool = False
    language: str = "en"
    ai_offline: bool = False


class RouteResponse(BaseModel):
    success: bool
    nodes: list[str]
    node_names: list[str]
    total_distance_m: float
    estimated_walk_time_s: int
    accessibility_accommodations: list[str]
    phrased_directions: str
    deterministic_directions: str
    fallback_mode: bool           # True if GenAI was unavailable
    mode: str
    congestion_aware: bool
    error: str | None = None


class NoRouteResponse(BaseModel):
    success: bool = False
    reason: str
    message: str
    mode: str
    congestion_aware: bool
