"""
Venue Graph Model — FanFlow AI
Defines Node, Edge, and VenueGraph data structures.
No external dependencies. 100% unit-test coverage required.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterator


class NodeType(str, Enum):
    GATE = "gate"
    CONCOURSE = "concourse"
    SECTION = "section"
    AMENITY = "amenity"
    TRANSPORT = "transport"


@dataclass
class Node:
    id: str
    name: str
    node_type: NodeType
    # SVG layout coordinates (0–100 scale, used by frontend map)
    x: float
    y: float


@dataclass
class Edge:
    from_node: str
    to_node: str
    distance_m: float
    has_stairs: bool = False
    has_elevator: bool = False
    # Multiplied into the weight during congestion-aware routing.
    # Updated live by the telemetry simulator.
    congestion_multiplier: float = 1.0

    @property
    def effective_weight(self) -> float:
        """Distance × congestion multiplier — used by Dijkstra."""
        return self.distance_m * self.congestion_multiplier

    @property
    def step_free(self) -> bool:
        """True if the edge can be traversed without climbing stairs."""
        return (not self.has_stairs) or self.has_elevator


class VenueGraph:
    """
    Weighted, undirected venue graph.

    Edges are stored bidirectionally so callers never need to worry
    about direction — the venue is fully navigable in both ways.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, Node] = {}
        # Adjacency: node_id → list of Edge objects (both directions)
        self._adjacency: dict[str, list[Edge]] = {}

    # ------------------------------------------------------------------
    # Mutation API
    # ------------------------------------------------------------------

    def add_node(self, node: Node) -> None:
        self._nodes[node.id] = node
        if node.id not in self._adjacency:
            self._adjacency[node.id] = []

    def add_edge(self, edge: Edge) -> None:
        """Add an undirected edge (stored as two directed half-edges)."""
        if edge.from_node not in self._nodes:
            raise ValueError(f"Unknown node: {edge.from_node!r}")
        if edge.to_node not in self._nodes:
            raise ValueError(f"Unknown node: {edge.to_node!r}")

        # Forward
        self._adjacency[edge.from_node].append(edge)
        # Reverse (same object, swapped endpoints)
        reverse = Edge(
            from_node=edge.to_node,
            to_node=edge.from_node,
            distance_m=edge.distance_m,
            has_stairs=edge.has_stairs,
            has_elevator=edge.has_elevator,
            congestion_multiplier=edge.congestion_multiplier,
        )
        self._adjacency[edge.to_node].append(reverse)

    # ------------------------------------------------------------------
    # Query API
    # ------------------------------------------------------------------

    def get_node(self, node_id: str) -> Node | None:
        return self._nodes.get(node_id)

    def get_all_nodes(self) -> list[Node]:
        return list(self._nodes.values())

    def get_neighbors(self, node_id: str) -> list[Edge]:
        """Return all edges leaving *node_id*."""
        return list(self._adjacency.get(node_id, []))

    def has_node(self, node_id: str) -> bool:
        return node_id in self._nodes

    def node_ids(self) -> Iterator[str]:
        return iter(self._nodes)

    # ------------------------------------------------------------------
    # Congestion update (called by telemetry simulator)
    # ------------------------------------------------------------------

    def apply_congestion(self, zone_multipliers: dict[str, float]) -> None:
        """
        Update congestion_multiplier on all edges leaving each node whose
        id appears in *zone_multipliers*.

        zone_multipliers: { node_id: multiplier }
        """
        for node_id, multiplier in zone_multipliers.items():
            for edge in self._adjacency.get(node_id, []):
                edge.congestion_multiplier = multiplier

    # ------------------------------------------------------------------
    # Accessible subgraph
    # ------------------------------------------------------------------

    def accessible_subgraph(self) -> "VenueGraph":
        """
        Return a new VenueGraph containing only step-free edges
        (edges where has_stairs=False OR has_elevator=True).

        The new graph shares the same Node objects but has independent
        Edge objects, so mutating one graph does not affect the other.
        """
        sub = VenueGraph()
        for node in self._nodes.values():
            sub.add_node(node)

        added: set[tuple[str, str]] = set()
        for node_id, edges in self._adjacency.items():
            for edge in edges:
                # Canonical key (smaller id first) to avoid double-adding
                key = tuple(sorted([edge.from_node, edge.to_node]))
                if key not in added and edge.step_free:
                    added.add(key)
                    sub.add_edge(
                        Edge(
                            from_node=edge.from_node,
                            to_node=edge.to_node,
                            distance_m=edge.distance_m,
                            has_stairs=edge.has_stairs,
                            has_elevator=edge.has_elevator,
                            congestion_multiplier=edge.congestion_multiplier,
                        )
                    )
        return sub
