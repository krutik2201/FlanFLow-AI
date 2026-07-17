"""
Tests for app/routing/graph.py — 100% branch coverage required.
"""

import pytest
from app.routing.graph import Edge, Node, NodeType, VenueGraph


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_node(nid: str, x: float = 0.0, y: float = 0.0) -> Node:
    return Node(id=nid, name=nid.capitalize(), node_type=NodeType.CONCOURSE, x=x, y=y)


def make_edge(frm: str, to: str, dist: float = 100.0, stairs: bool = False, elev: bool = False) -> Edge:
    return Edge(from_node=frm, to_node=to, distance_m=dist, has_stairs=stairs, has_elevator=elev)


# ---------------------------------------------------------------------------
# Node tests
# ---------------------------------------------------------------------------

class TestNode:
    def test_node_fields(self):
        n = Node("gate_a", "Gate A", NodeType.GATE, x=10.0, y=20.0)
        assert n.id == "gate_a"
        assert n.name == "Gate A"
        assert n.node_type == NodeType.GATE
        assert n.x == 10.0
        assert n.y == 20.0


# ---------------------------------------------------------------------------
# Edge tests
# ---------------------------------------------------------------------------

class TestEdge:
    def test_effective_weight_no_congestion(self):
        e = make_edge("a", "b", dist=200.0)
        assert e.effective_weight == 200.0

    def test_effective_weight_with_congestion(self):
        e = make_edge("a", "b", dist=100.0)
        e.congestion_multiplier = 2.5
        assert e.effective_weight == 250.0

    def test_step_free_no_stairs(self):
        e = make_edge("a", "b", stairs=False, elev=False)
        assert e.step_free is True

    def test_step_free_stairs_no_elevator(self):
        e = make_edge("a", "b", stairs=True, elev=False)
        assert e.step_free is False

    def test_step_free_stairs_with_elevator(self):
        """Stairs exist but elevator alternative makes it step-free."""
        e = make_edge("a", "b", stairs=True, elev=True)
        assert e.step_free is True


# ---------------------------------------------------------------------------
# VenueGraph tests
# ---------------------------------------------------------------------------

class TestVenueGraph:
    def _two_node_graph(self) -> VenueGraph:
        g = VenueGraph()
        g.add_node(make_node("a"))
        g.add_node(make_node("b"))
        g.add_edge(make_edge("a", "b", dist=150.0))
        return g

    def test_add_and_get_node(self):
        g = VenueGraph()
        n = make_node("x")
        g.add_node(n)
        assert g.get_node("x") is n

    def test_get_node_missing(self):
        g = VenueGraph()
        assert g.get_node("missing") is None

    def test_has_node_true(self):
        g = VenueGraph()
        g.add_node(make_node("a"))
        assert g.has_node("a") is True

    def test_has_node_false(self):
        g = VenueGraph()
        assert g.has_node("z") is False

    def test_get_all_nodes(self):
        g = VenueGraph()
        g.add_node(make_node("a"))
        g.add_node(make_node("b"))
        ids = {n.id for n in g.get_all_nodes()}
        assert ids == {"a", "b"}

    def test_node_ids(self):
        g = VenueGraph()
        g.add_node(make_node("p"))
        g.add_node(make_node("q"))
        assert set(g.node_ids()) == {"p", "q"}

    def test_add_edge_stores_both_directions(self):
        g = self._two_node_graph()
        neighbors_a = {e.to_node for e in g.get_neighbors("a")}
        neighbors_b = {e.to_node for e in g.get_neighbors("b")}
        assert "b" in neighbors_a
        assert "a" in neighbors_b

    def test_add_edge_unknown_from_node_raises(self):
        g = VenueGraph()
        g.add_node(make_node("b"))
        with pytest.raises(ValueError, match="Unknown node"):
            g.add_edge(make_edge("missing", "b"))

    def test_add_edge_unknown_to_node_raises(self):
        g = VenueGraph()
        g.add_node(make_node("a"))
        with pytest.raises(ValueError, match="Unknown node"):
            g.add_edge(make_edge("a", "missing"))

    def test_get_neighbors_unknown_node_returns_empty(self):
        g = VenueGraph()
        assert g.get_neighbors("nonexistent") == []

    def test_edge_distance_preserved(self):
        g = self._two_node_graph()
        edge = g.get_neighbors("a")[0]
        assert edge.distance_m == 150.0

    def test_apply_congestion_updates_multiplier(self):
        g = self._two_node_graph()
        g.apply_congestion({"a": 3.0})
        edge = g.get_neighbors("a")[0]
        assert edge.congestion_multiplier == 3.0

    def test_apply_congestion_unknown_node_ignored(self):
        """Applying congestion to a node not in the graph must not raise."""
        g = self._two_node_graph()
        g.apply_congestion({"nonexistent": 5.0})  # should not raise

    def test_accessible_subgraph_excludes_stair_only_edges(self):
        g = VenueGraph()
        for nid in ("a", "b", "c"):
            g.add_node(make_node(nid))
        # a→b has stairs, no elevator (should be pruned)
        g.add_edge(Edge("a", "b", 100, has_stairs=True, has_elevator=False))
        # b→c is step-free
        g.add_edge(Edge("b", "c", 100, has_stairs=False, has_elevator=False))

        sub = g.accessible_subgraph()
        # a→b should be pruned
        assert not any(e.to_node == "b" for e in sub.get_neighbors("a"))
        # b→c should survive
        assert any(e.to_node == "c" for e in sub.get_neighbors("b"))

    def test_accessible_subgraph_keeps_elevator_edges(self):
        g = VenueGraph()
        for nid in ("a", "b"):
            g.add_node(make_node(nid))
        # Stairs but elevator available
        g.add_edge(Edge("a", "b", 100, has_stairs=True, has_elevator=True))

        sub = g.accessible_subgraph()
        assert any(e.to_node == "b" for e in sub.get_neighbors("a"))

    def test_accessible_subgraph_independent_from_original(self):
        """Mutating congestion on subgraph should not affect original."""
        g = VenueGraph()
        for nid in ("a", "b"):
            g.add_node(make_node(nid))
        g.add_edge(Edge("a", "b", 100, has_stairs=False, has_elevator=False))

        sub = g.accessible_subgraph()
        sub.apply_congestion({"a": 9.9})

        original_edge = g.get_neighbors("a")[0]
        assert original_edge.congestion_multiplier == 1.0  # unchanged

    def test_accessible_subgraph_preserves_all_nodes(self):
        g = VenueGraph()
        for nid in ("a", "b", "c"):
            g.add_node(make_node(nid))
        g.add_edge(Edge("a", "b", 100, has_stairs=True, has_elevator=False))

        sub = g.accessible_subgraph()
        # All nodes present even if edges were pruned
        assert sub.has_node("a")
        assert sub.has_node("b")
        assert sub.has_node("c")
