"""
Route Phrasing — FanFlow AI
Converts a deterministic RouteResult into natural-language walking directions.

ARCHITECTURAL BOUNDARY:
1. Dijkstra runs first → RouteResult (ground truth).
2. phrasing.py builds a deterministic string-template fallback FIRST.
3. If ai_offline=False and GenAI available: call Gemini API with the
   deterministic result as immutable context.
4. If GenAI fails at any point: return the deterministic fallback.
   fallback_mode=True is set so the UI can show the "Deterministic mode" badge.

The system prompt explicitly forbids the model from altering the route.
"""

from __future__ import annotations

import logging

from app.genai import client as genai
from app.routing.dijkstra import RouteResult
from app.routing.graph import VenueGraph

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "ar": "Arabic",
    "pt": "Portuguese",
    "zh": "Simplified Chinese",
    "de": "German",
}

_SYSTEM_PROMPT = """\
You are a multilingual stadium navigation assistant for FanFlow AI.

STRICT RULES — you must follow these without exception:
1. You will receive a pre-computed walking route. The node sequence, distances,
   and walk times are MATHEMATICAL FACTS computed by a deterministic routing
   engine. You must NOT alter, reorder, skip, or add any steps.
2. Your only job is to rephrase these steps as friendly, clear walking
   directions in {language}. Use short sentences appropriate for someone
   walking through a busy stadium.
3. Do NOT invent distances, directions, or landmarks not present in the route.
4. Do NOT mention that you are an AI or reference Claude.
5. Format: a numbered list of short steps, nothing else.
"""

_STEP_TEMPLATE = "Head to {name} ({dist}m away)."
_FINAL_TEMPLATE = "You have arrived at {name}."


def build_deterministic_directions(route: RouteResult, graph: VenueGraph) -> str:
    """
    Build a plain-English step-by-step direction string from the route.
    This is always computed and returned regardless of GenAI availability.
    """
    if len(route.nodes) == 1:
        node = graph.get_node(route.nodes[0])
        name = node.name if node else route.nodes[0]
        return f"You are already at {name}."

    steps: list[str] = []
    # Approximate per-step distances by splitting total evenly
    segment_count = max(1, len(route.nodes) - 1)
    approx_per_step = route.total_distance_m / segment_count

    for i, node_id in enumerate(route.nodes):
        node = graph.get_node(node_id)
        name = node.name if node else node_id
        if i < len(route.nodes) - 1:
            dist = round(approx_per_step)
            steps.append(f"{i + 1}. {_STEP_TEMPLATE.format(name=name, dist=dist)}")
        else:
            steps.append(f"{i + 1}. {_FINAL_TEMPLATE.format(name=name)}")

    return "\n".join(steps)


def phrase_route(
    route: RouteResult,
    graph: VenueGraph,
    language: str = "en",
    ai_offline: bool = False,
) -> tuple[str, bool]:
    """
    Return (phrased_directions, fallback_mode).

    phrased_directions: the directions string (AI-phrased or deterministic)
    fallback_mode: True when the deterministic template was used
    """
    deterministic = build_deterministic_directions(route, graph)

    if ai_offline:
        logger.info("AI offline flag set — returning deterministic directions")
        return deterministic, True

    lang_name = SUPPORTED_LANGUAGES.get(language, "English")

    # Build the route context to send to the model
    node_names = [
        (graph.get_node(nid).name if graph.get_node(nid) else nid)
        for nid in route.nodes
    ]
    route_context = (
        f"ROUTE (do not alter):\n"
        f"Steps: {' → '.join(node_names)}\n"
        f"Total distance: {route.total_distance_m}m\n"
        f"Estimated walk time: {route.estimated_walk_time_s} seconds\n"
        f"Accessibility notes: {', '.join(route.accessibility_accommodations) or 'None'}\n\n"
        f"Please phrase these as walking directions in {lang_name}."
    )

    system = _SYSTEM_PROMPT.format(language=lang_name)
    try:
        ai_response = genai.complete(system=system, user=route_context, max_tokens=512)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GenAI exception in phrasing: %s — using deterministic fallback", exc)
        return deterministic, True

    if ai_response is None:
        logger.info("GenAI unavailable — using deterministic directions")
        return deterministic, True

    return ai_response.strip(), False
