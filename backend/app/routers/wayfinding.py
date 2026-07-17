"""Wayfinding router — the primary navigation endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from app.genai.phrasing import phrase_route
from app.models.routing import NoRouteResponse, RouteResponse
from app.routing.dijkstra import NoRouteResult, RouteResult, shortest_path
from app.routing.venue_data import VENUE_GRAPH

router = APIRouter()


def _node_names(nodes: list[str]) -> list[str]:
    return [
        (VENUE_GRAPH.get_node(n).name if VENUE_GRAPH.get_node(n) else n)
        for n in nodes
    ]


@router.get("/route", summary="Compute venue wayfinding route")
async def get_route(
    request: Request,
    origin: str = Query(..., description="Origin node ID"),
    destination: str = Query(..., description="Destination node ID"),
    mode: str = Query("standard", description="'standard' or 'accessible'"),
    congestion_aware: bool = Query(False, description="Use live congestion weights"),
    lang: str = Query("en", description="Language code for phrased directions"),
    ai_offline: bool = Query(False, description="Skip GenAI, return deterministic directions"),
):
    """
    Compute the shortest path between origin and destination.

    Physical computation (Dijkstra) always runs first.
    GenAI phrasing is optional and degrades gracefully.
    """
    if mode not in ("standard", "accessible"):
        return JSONResponse(
            status_code=422,
            content={"detail": "mode must be 'standard' or 'accessible'"},
        )

    result = shortest_path(
        graph=VENUE_GRAPH,
        start=origin,
        end=destination,
        mode=mode,  # type: ignore[arg-type]
        congestion_aware=congestion_aware,
    )

    if isinstance(result, NoRouteResult):
        return JSONResponse(
            status_code=404,
            content=NoRouteResponse(
                reason=result.reason,
                message=result.message,
                mode=result.mode,
                congestion_aware=result.congestion_aware,
            ).model_dump(),
        )

    # GenAI phrasing — deterministic fallback built inside phrase_route
    phrased, fallback_mode = phrase_route(
        route=result,
        graph=VENUE_GRAPH,
        language=lang,
        ai_offline=ai_offline,
    )

    from app.genai.phrasing import build_deterministic_directions
    deterministic = build_deterministic_directions(result, VENUE_GRAPH)

    return RouteResponse(
        success=True,
        nodes=result.nodes,
        node_names=_node_names(result.nodes),
        total_distance_m=result.total_distance_m,
        estimated_walk_time_s=result.estimated_walk_time_s,
        accessibility_accommodations=result.accessibility_accommodations,
        phrased_directions=phrased,
        deterministic_directions=deterministic,
        fallback_mode=fallback_mode,
        mode=result.mode,
        congestion_aware=result.congestion_aware,
    )


@router.get("/nodes", summary="List all venue nodes")
async def list_nodes():
    """Return all navigable venue nodes and edges for the frontend selectors."""
    nodes = [
        {
            "id": n.id,
            "name": n.name,
            "type": n.node_type.value,
            "x": n.x,
            "y": n.y,
        }
        for n in VENUE_GRAPH.get_all_nodes()
    ]
    edges_list = []
    seen = set()
    for node in VENUE_GRAPH.get_all_nodes():
        for edge in VENUE_GRAPH.get_neighbors(node.id):
            pair = tuple(sorted([edge.from_node, edge.to_node]))
            if pair not in seen:
                seen.add(pair)
                edges_list.append({
                    "from": edge.from_node,
                    "to": edge.to_node,
                    "distance_m": edge.distance_m,
                    "has_stairs": edge.has_stairs,
                    "has_elevator": edge.has_elevator,
                })
    return {"nodes": nodes, "edges": edges_list}

