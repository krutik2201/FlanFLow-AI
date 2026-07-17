"""
Dijkstra's Shortest-Path Engine — FanFlow AI
Pure Python implementation. No external graph library dependency.
100% branch-coverage test suite required (see tests/test_dijkstra.py).

ARCHITECTURAL BOUNDARY: This module computes physical facts (paths,
distances, walk times). GenAI never calls into this module — it only
receives the *output* as context for natural-language phrasing.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Literal

from app.routing.graph import VenueGraph

# Average walking speed in m/s (3.6 km/h — slightly slower for stadium crowds)
WALK_SPEED_MS = 1.0


@dataclass
class RouteResult:
    """Successful routing outcome — all values are deterministic."""

    nodes: list[str]
    total_distance_m: float
    estimated_walk_time_s: int
    accessibility_accommodations: list[str]
    # Which mode was used (informational, not a navigation instruction)
    mode: str
    congestion_aware: bool


@dataclass
class NoRouteResult:
    """Returned when no valid path exists between start and end."""

    reason: Literal[
        "same_node",
        "unknown_start",
        "unknown_end",
        "no_path",
        "no_accessible_route",
    ]
    message: str
    mode: str
    congestion_aware: bool


def shortest_path(
    graph: VenueGraph,
    start: str,
    end: str,
    mode: Literal["standard", "accessible"] = "standard",
    congestion_aware: bool = False,
) -> RouteResult | NoRouteResult:
    """
    Compute the shortest (or accessible) path between *start* and *end*.

    Parameters
    ----------
    graph:
        The venue graph. In accessible mode a step-free subgraph is derived
        before running Dijkstra, so the original graph is never mutated.
    start / end:
        Node IDs.
    mode:
        'standard' — shortest weighted path.
        'accessible' — prune stair-only edges first, then shortest path.
    congestion_aware:
        If True, use edge.effective_weight (distance × congestion_multiplier)
        instead of raw distance_m as the edge cost.

    Returns
    -------
    RouteResult on success, NoRouteResult on any failure.
    """
    # --- Validate inputs ---------------------------------------------------
    if not graph.has_node(start):
        return NoRouteResult(
            reason="unknown_start",
            message=f"Origin node {start!r} does not exist in the venue graph.",
            mode=mode,
            congestion_aware=congestion_aware,
        )
    if not graph.has_node(end):
        return NoRouteResult(
            reason="unknown_end",
            message=f"Destination node {end!r} does not exist in the venue graph.",
            mode=mode,
            congestion_aware=congestion_aware,
        )
    if start == end:
        return RouteResult(
            nodes=[start],
            total_distance_m=0.0,
            estimated_walk_time_s=0,
            accessibility_accommodations=[],
            mode=mode,
            congestion_aware=congestion_aware,
        )

    # --- Choose the working graph ------------------------------------------
    if mode == "accessible":
        working_graph = graph.accessible_subgraph()
    else:
        working_graph = graph

    # --- Dijkstra ----------------------------------------------------------
    # Priority queue: (cost, node_id)
    pq: list[tuple[float, str]] = [(0.0, start)]
    dist: dict[str, float] = {start: 0.0}
    prev: dict[str, str | None] = {start: None}

    while pq:
        current_cost, current = heapq.heappop(pq)

        # Early exit
        if current == end:
            break

        # Skip stale entries
        if current_cost > dist.get(current, float("inf")):
            continue

        for edge in working_graph.get_neighbors(current):
            weight = edge.effective_weight if congestion_aware else edge.distance_m
            new_cost = current_cost + weight

            if new_cost < dist.get(edge.to_node, float("inf")):
                dist[edge.to_node] = new_cost
                prev[edge.to_node] = current
                heapq.heappush(pq, (new_cost, edge.to_node))

    # --- Check reachability ------------------------------------------------
    if end not in dist:
        reason = "no_accessible_route" if mode == "accessible" else "no_path"
        msg = (
            "No step-free route available between the selected points. "
            "Please ask a staff member for assisted navigation."
            if reason == "no_accessible_route"
            else f"No path found between {start!r} and {end!r}."
        )
        return NoRouteResult(
            reason=reason,
            message=msg,
            mode=mode,
            congestion_aware=congestion_aware,
        )

    # --- Reconstruct path --------------------------------------------------
    path: list[str] = []
    node: str | None = end
    while node is not None:
        path.append(node)
        node = prev.get(node)
    path.reverse()

    # --- Collect accessibility accommodations used -------------------------
    accommodations: list[str] = []
    if mode == "accessible":
        for i in range(len(path) - 1):
            for edge in working_graph.get_neighbors(path[i]):
                if edge.to_node == path[i + 1] and edge.has_elevator:
                    node_name = (
                        working_graph.get_node(path[i + 1]).name
                        if working_graph.get_node(path[i + 1])
                        else path[i + 1]
                    )
                    accommodations.append(f"Elevator used near {node_name}")
                    break

    total_distance = dist[end]
    walk_time = int(total_distance / WALK_SPEED_MS)

    return RouteResult(
        nodes=path,
        total_distance_m=round(total_distance, 1),
        estimated_walk_time_s=walk_time,
        accessibility_accommodations=accommodations,
        mode=mode,
        congestion_aware=congestion_aware,
    )
