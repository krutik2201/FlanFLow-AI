"""
Tests for app/routing/dijkstra.py — 100% branch coverage required.

All graphs here are minimal, hand-crafted with known correct answers
so assertions are verifiable by inspection.
"""

import pytest
from app.routing.dijkstra import NoRouteResult, RouteResult, shortest_path, WALK_SPEED_MS
from app.routing.graph import Edge, Node, NodeType, VenueGraph


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _node(nid: str) -> Node:
    return Node(id=nid, name=nid, node_type=NodeType.CONCOURSE, x=0.0, y=0.0)


def _edge(frm: str, to: str, dist: float = 100.0, stairs: bool = False, elev: bool = False) -> Edge:
    return Edge(from_node=frm, to_node=to, distance_m=dist, has_stairs=stairs, has_elevator=elev)


def _linear_graph(*node_ids: str, dist: float = 100.0, stairs: bool = False, elev: bool = False) -> VenueGraph:
    """Build a linear graph: a—b—c—..."""
    g = VenueGraph()
    for nid in node_ids:
        g.add_node(_node(nid))
    ids = list(node_ids)
    for i in range(len(ids) - 1):
        g.add_edge(_edge(ids[i], ids[i + 1], dist=dist, stairs=stairs, elev=elev))
    return g


# ---------------------------------------------------------------------------
# Basic shortest path
# ---------------------------------------------------------------------------

class TestShortestPathStandard:
    def test_direct_edge(self):
        g = _linear_graph("a", "b", dist=200.0)
        result = shortest_path(g, "a", "b")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "b"]
        assert result.total_distance_m == 200.0
        assert result.estimated_walk_time_s == int(200.0 / WALK_SPEED_MS)

    def test_two_hop_path(self):
        g = _linear_graph("a", "b", "c", dist=100.0)
        result = shortest_path(g, "a", "c")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "b", "c"]
        assert result.total_distance_m == 200.0

    def test_prefers_shorter_path(self):
        """With two paths a→c, prefer the shorter one."""
        g = VenueGraph()
        for nid in ("a", "b", "c"):
            g.add_node(_node(nid))
        # a→b→c costs 150 total
        g.add_edge(_edge("a", "b", 50.0))
        g.add_edge(_edge("b", "c", 100.0))
        # a→c direct costs 300
        g.add_edge(_edge("a", "c", 300.0))

        result = shortest_path(g, "a", "c")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "b", "c"]
        assert result.total_distance_m == 150.0

    def test_same_node_returns_zero_distance(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "a", "a")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a"]
        assert result.total_distance_m == 0.0
        assert result.estimated_walk_time_s == 0

    def test_result_mode_and_congestion_flag(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "a", "b", mode="standard", congestion_aware=False)
        assert isinstance(result, RouteResult)
        assert result.mode == "standard"
        assert result.congestion_aware is False


# ---------------------------------------------------------------------------
# Error / edge cases
# ---------------------------------------------------------------------------

class TestShortestPathErrors:
    def test_unknown_start_node(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "unknown", "b")
        assert isinstance(result, NoRouteResult)
        assert result.reason == "unknown_start"

    def test_unknown_end_node(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "a", "unknown")
        assert isinstance(result, NoRouteResult)
        assert result.reason == "unknown_end"

    def test_disconnected_graph_no_path(self):
        g = VenueGraph()
        g.add_node(_node("a"))
        g.add_node(_node("b"))
        # No edge between a and b
        result = shortest_path(g, "a", "b")
        assert isinstance(result, NoRouteResult)
        assert result.reason == "no_path"

    def test_disconnected_graph_message_not_empty(self):
        g = VenueGraph()
        g.add_node(_node("x"))
        g.add_node(_node("y"))
        result = shortest_path(g, "x", "y")
        assert isinstance(result, NoRouteResult)
        assert len(result.message) > 0


# ---------------------------------------------------------------------------
# Accessible mode
# ---------------------------------------------------------------------------

class TestAccessibleMode:
    def test_accessible_uses_elevator_route(self):
        """
        Graph: gate → conc →(stairs)→ sec
                    ↘ elevator →(elev)→ sec
        Accessible mode must choose the elevator path.
        """
        g = VenueGraph()
        for nid in ("gate", "conc", "elevator", "sec"):
            g.add_node(_node(nid))
        # Stair path (shorter in distance)
        g.add_edge(Edge("conc", "sec", distance_m=30.0, has_stairs=True, has_elevator=False))
        # Elevator path (longer but step-free)
        g.add_edge(Edge("gate", "conc", distance_m=50.0, has_stairs=False, has_elevator=False))
        g.add_edge(Edge("conc", "elevator", distance_m=20.0, has_stairs=False, has_elevator=False))
        g.add_edge(Edge("elevator", "sec", distance_m=40.0, has_stairs=False, has_elevator=True))

        result = shortest_path(g, "gate", "sec", mode="accessible")
        assert isinstance(result, RouteResult)
        assert "elevator" in result.nodes
        assert "Elevator" in " ".join(result.accessibility_accommodations)

    def test_accessible_no_route_when_only_stairs(self):
        """When the only path requires stairs and no elevator, return NoRouteResult."""
        g = VenueGraph()
        for nid in ("a", "b"):
            g.add_node(_node(nid))
        g.add_edge(Edge("a", "b", distance_m=100.0, has_stairs=True, has_elevator=False))

        result = shortest_path(g, "a", "b", mode="accessible")
        assert isinstance(result, NoRouteResult)
        assert result.reason == "no_accessible_route"
        assert "staff" in result.message.lower() or "accessible" in result.message.lower()

    def test_accessible_same_node(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "a", "a", mode="accessible")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a"]

    def test_accessible_mode_flag_in_result(self):
        g = _linear_graph("a", "b", stairs=False)
        result = shortest_path(g, "a", "b", mode="accessible")
        assert isinstance(result, RouteResult)
        assert result.mode == "accessible"

    def test_accessible_no_accommodations_on_step_free_path(self):
        """Step-free path with no elevator should report empty accommodations."""
        g = _linear_graph("a", "b", stairs=False, elev=False)
        result = shortest_path(g, "a", "b", mode="accessible")
        assert isinstance(result, RouteResult)
        assert result.accessibility_accommodations == []


# ---------------------------------------------------------------------------
# Congestion-aware mode
# ---------------------------------------------------------------------------

class TestCongestionAwareMode:
    def test_congestion_changes_preferred_path(self):
        """
        Two paths from a to c:
          a→b→c: total dist 200 but b has congestion × 5 → effective 600
          a→d→c: total dist 400 but no congestion → effective 400
        Congestion-aware should prefer a→d→c.
        """
        g = VenueGraph()
        for nid in ("a", "b", "c", "d"):
            g.add_node(_node(nid))
        g.add_edge(_edge("a", "b", dist=100.0))
        g.add_edge(_edge("b", "c", dist=100.0))
        g.add_edge(_edge("a", "d", dist=200.0))
        g.add_edge(_edge("d", "c", dist=200.0))

        # Apply congestion to node b
        g.apply_congestion({"b": 5.0})

        result = shortest_path(g, "a", "c", mode="standard", congestion_aware=True)
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "d", "c"]

    def test_no_congestion_prefers_shorter_distance(self):
        """Without congestion, standard shortest path wins."""
        g = VenueGraph()
        for nid in ("a", "b", "c", "d"):
            g.add_node(_node(nid))
        g.add_edge(_edge("a", "b", dist=100.0))
        g.add_edge(_edge("b", "c", dist=100.0))
        g.add_edge(_edge("a", "d", dist=200.0))
        g.add_edge(_edge("d", "c", dist=200.0))

        result = shortest_path(g, "a", "c", mode="standard", congestion_aware=False)
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "b", "c"]

    def test_congestion_aware_flag_in_result(self):
        g = _linear_graph("a", "b")
        result = shortest_path(g, "a", "b", congestion_aware=True)
        assert isinstance(result, RouteResult)
        assert result.congestion_aware is True


# ---------------------------------------------------------------------------
# Venue data integration smoke test
# ---------------------------------------------------------------------------

class TestVenueDataIntegration:
    def test_route_gate_a_to_sec_101_standard(self):
        from app.routing.venue_data import VENUE_GRAPH
        result = shortest_path(VENUE_GRAPH, "gate_a", "sec_101", mode="standard")
        assert isinstance(result, RouteResult)
        assert result.nodes[0] == "gate_a"
        assert result.nodes[-1] == "sec_101"
        assert result.total_distance_m > 0

    def test_route_gate_a_to_sec_101_accessible(self):
        from app.routing.venue_data import VENUE_GRAPH
        result = shortest_path(VENUE_GRAPH, "gate_a", "sec_101", mode="accessible")
        # Should succeed via elevator_north
        assert isinstance(result, RouteResult)
        assert "elevator_north" in result.nodes

    def test_same_node_venue_graph(self):
        from app.routing.venue_data import VENUE_GRAPH
        result = shortest_path(VENUE_GRAPH, "gate_a", "gate_a")
        assert isinstance(result, RouteResult)
        assert result.total_distance_m == 0.0

    def test_stale_node_popped_from_pq(self):
        g = VenueGraph()
        for nid in ("a", "b", "c", "d"):
            g.add_node(_node(nid))
        g.add_edge(_edge("a", "b", dist=10.0))
        g.add_edge(_edge("a", "c", dist=1.0))
        g.add_edge(_edge("c", "b", dist=1.0))
        g.add_edge(_edge("b", "d", dist=20.0))

        result = shortest_path(g, "a", "d")
        assert isinstance(result, RouteResult)
        assert result.nodes == ["a", "c", "b", "d"]
        assert result.total_distance_m == 22.0

