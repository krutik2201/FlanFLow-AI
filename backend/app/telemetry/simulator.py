"""
Telemetry Simulator — FanFlow AI
Generates realistic, slowly-evolving venue data using a seeded random walk.
Deterministic with a fixed seed, so demo runs are reproducible.

Outputs TelemetrySnapshot every 4 seconds via the shared `latest` property.
The WebSocket router reads `latest` and broadcasts it to all connected clients.
Also updates the VENUE_GRAPH's congestion_multipliers so wayfinding responds
to "live" conditions.

ARCHITECTURAL NOTE: All values here are computed deterministically.
GenAI only receives this data as context — it never invents numbers.
"""

from __future__ import annotations

import asyncio
import math
import random
from datetime import datetime, timezone

from app.models.telemetry import (
    GateStatus,
    StaffLevel,
    TelemetrySnapshot,
    TransitStatus,
    ZoneDensity,
)
from app.routing.venue_data import VENUE_GRAPH

# Gates and zones to simulate
_GATES = [
    ("gate_a",  "Gate A (Main Entry)"),
    ("gate_b",  "Gate B (West Entry)"),
    ("gate_c",  "Gate C (East Entry)"),
    ("gate_d",  "Gate D (South Entry)"),
    ("gate_d2", "Gate D2 (South Overflow)"),
]

_ZONES = [
    ("conc_north", "North Concourse"),
    ("conc_south", "South Concourse"),
    ("conc_east",  "East Concourse"),
    ("conc_west",  "West Concourse"),
    ("conc_ne",    "NE Concourse"),
    ("conc_nw",    "NW Concourse"),
    ("conc_se",    "SE Concourse"),
    ("conc_sw",    "SW Concourse"),
]

_TRANSIT = [
    ("rail", "Metro Line 2 (Stadium Express)"),
    ("bus",  "Bus Route 26 (Stadium Shuttle)"),
]


def _density_to_status(d: float) -> str:
    if d < 40:
        return "clear"
    if d < 75:
        return "busy"
    return "congested"


def _density_to_multiplier(d: float) -> float:
    """Map density 0–100 → congestion multiplier 1.0–4.0."""
    return 1.0 + (d / 100.0) * 3.0


class TelemetrySimulator:
    """
    Seeded random-walk telemetry generator.

    Each tick advances the internal state by a small random delta,
    with a sinusoidal "tide" component to simulate pre-match / half-time surges.
    """

    TICK_INTERVAL = 4.0  # seconds

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._tick = 0

        # Internal state: density per zone (0–100)
        self._zone_density: dict[str, float] = {
            zid: self._rng.uniform(20, 60) for zid, _ in _ZONES
        }
        # Internal state: queue per gate (minutes)
        self._gate_queue: dict[str, float] = {
            gid: self._rng.uniform(1, 8) for gid, _ in _GATES
        }
        # Transit base ETAs
        self._transit_eta: dict[str, float] = {
            "rail": self._rng.uniform(3, 12),
            "bus":  self._rng.uniform(5, 20),
        }

        self._latest: TelemetrySnapshot | None = None

    @property
    def latest(self) -> TelemetrySnapshot | None:
        return self._latest

    def _sinusoidal_surge(self) -> float:
        """Periodic density surge simulating match events (0–30 additional %)."""
        return 15.0 * (1 + math.sin(self._tick * 0.15))

    def _clamp(self, val: float, lo: float = 0.0, hi: float = 100.0) -> float:
        return max(lo, min(hi, val))

    def tick(self) -> TelemetrySnapshot:
        """Advance state by one tick and return a new TelemetrySnapshot."""
        self._tick += 1
        surge = self._sinusoidal_surge()

        # ---- Update zone densities ----------------------------------------
        for zid in self._zone_density:
            delta = self._rng.gauss(0, 3)
            self._zone_density[zid] = self._clamp(
                self._zone_density[zid] + delta + surge * 0.05
            )

        # ---- Update gate queues -------------------------------------------
        for gid in self._gate_queue:
            delta = self._rng.gauss(0, 0.5)
            self._gate_queue[gid] = self._clamp(
                self._gate_queue[gid] + delta, lo=0.0, hi=30.0
            )

        # ---- Update transit ETAs -----------------------------------------
        for mode in self._transit_eta:
            delta = self._rng.gauss(0, 1)
            self._transit_eta[mode] = self._clamp(
                self._transit_eta[mode] + delta, lo=1.0, hi=40.0
            )

        # ---- Push congestion to the venue graph --------------------------
        zone_multipliers = {
            zid: _density_to_multiplier(self._zone_density[zid])
            for zid in self._zone_density
        }
        VENUE_GRAPH.apply_congestion(zone_multipliers)

        # ---- Build snapshot ----------------------------------------------
        gates = [
            GateStatus(
                gate_id=gid,
                gate_name=gname,
                queue_time_min=round(self._gate_queue[gid], 1),
                crowd_pct=round(
                    self._clamp(self._gate_queue[gid] * 5 + surge), 1
                ),
            )
            for gid, gname in _GATES
        ]

        zones = [
            ZoneDensity(
                zone_id=zid,
                zone_name=zname,
                density_pct=round(self._zone_density[zid], 1),
                congestion_multiplier=round(
                    _density_to_multiplier(self._zone_density[zid]), 2
                ),
                status=_density_to_status(self._zone_density[zid]),
            )
            for zid, zname in _ZONES
        ]

        transit = [
            TransitStatus(
                mode=mode,
                eta_min=round(self._transit_eta[mode], 1),
                status=(
                    "on_time" if self._transit_eta[mode] < 15 else "delayed"
                ),
                line_name=line_name,
            )
            for mode, line_name in _TRANSIT
        ]

        staff = [
            StaffLevel(
                gate_id=gid,
                gate_name=gname,
                staff_count=max(2, int(6 - self._gate_queue[gid] * 0.1)),
                capacity=10,
            )
            for gid, gname in _GATES
        ]

        overall = round(
            sum(self._zone_density.values()) / len(self._zone_density), 1
        )

        snapshot = TelemetrySnapshot(
            timestamp=datetime.now(timezone.utc),
            gates=gates,
            zones=zones,
            transit=transit,
            staff=staff,
            overall_venue_density_pct=overall,
        )
        self._latest = snapshot
        return snapshot

    async def run(self) -> None:
        """Background task — tick forever, pausing between ticks."""
        from app.routers.ws import broadcast_snapshot
        while True:
            snapshot = self.tick()
            try:
                await broadcast_snapshot(snapshot.model_dump_json())
            except Exception:
                pass
            await asyncio.sleep(self.TICK_INTERVAL)
