"""Pydantic models for the telemetry system."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class GateStatus(BaseModel):
    gate_id: str
    gate_name: str
    queue_time_min: float = Field(ge=0)
    crowd_pct: float = Field(ge=0, le=100)


class ZoneDensity(BaseModel):
    zone_id: str
    zone_name: str
    density_pct: float = Field(ge=0, le=100)
    congestion_multiplier: float = Field(ge=1.0)
    status: str  # "clear", "busy", "congested"


class TransitStatus(BaseModel):
    mode: str           # "rail", "bus"
    eta_min: float
    status: str         # "on_time", "delayed", "suspended"
    line_name: str


class StaffLevel(BaseModel):
    gate_id: str
    gate_name: str
    staff_count: int
    capacity: int


class TelemetrySnapshot(BaseModel):
    timestamp: datetime
    gates: list[GateStatus]
    zones: list[ZoneDensity]
    transit: list[TransitStatus]
    staff: list[StaffLevel]
    overall_venue_density_pct: float
