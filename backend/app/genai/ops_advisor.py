"""
Ops Advisor — FanFlow AI
Takes a live TelemetrySnapshot and generates an advisory recommendation.

ARCHITECTURAL BOUNDARY:
- All numbers in the system prompt come from the TelemetrySnapshot (deterministic).
- The model is explicitly forbidden from inventing statistics.
- Model output is advisory only; it cannot claim to take actions.
"""

from __future__ import annotations

import logging

from app.genai import client as genai
from app.models.telemetry import TelemetrySnapshot

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an operations advisor for FanFlow AI at a FIFA World Cup stadium.

You will receive a real-time telemetry snapshot. Your task:
1. Analyze the data provided.
2. Produce ONE prioritized recommendation with a brief rationale (≤ 3 sentences).
3. Reference exact zone names and numbers from the data — do not invent statistics.
4. Use imperative advisory language: "Direct staff to...", "Open gate...", etc.
5. End with: "Action required by: Operations Supervisor."
6. Do NOT claim to have taken any action yourself. You are advisory only.
7. Do NOT invent any numbers not present in the snapshot.
"""

_FALLBACK_TEXT = (
    "Unable to generate AI recommendation — AI service unavailable. "
    "Please review telemetry data manually and consult your operations supervisor."
)


def generate_recommendation(
    snapshot: TelemetrySnapshot,
    ai_offline: bool = False,
) -> tuple[str, bool]:
    """
    Return (recommendation_text, fallback_mode).
    """
    if ai_offline:
        return _FALLBACK_TEXT, True

    # Build telemetry context — numbers come from the snapshot, not the model
    congested_zones = [z for z in snapshot.zones if z.density_pct >= 75]
    busy_gates = [g for g in snapshot.gates if g.queue_time_min >= 5]

    context_lines = [
        f"Timestamp: {snapshot.timestamp.isoformat()}",
        f"Overall venue density: {snapshot.overall_venue_density_pct}%",
        "",
        "Zone densities:",
        *[f"  - {z.zone_name}: {z.density_pct}% ({z.status})" for z in snapshot.zones],
        "",
        "Gate queue times (minutes):",
        *[f"  - {g.gate_name}: {g.queue_time_min} min ({g.crowd_pct}% capacity)" for g in snapshot.gates],
        "",
        "Transit status:",
        *[f"  - {t.line_name}: ETA {t.eta_min} min ({t.status})" for t in snapshot.transit],
        "",
        f"Congested zones (≥75%): {', '.join(z.zone_name for z in congested_zones) or 'None'}",
        f"High queue gates (≥5 min): {', '.join(g.gate_name for g in busy_gates) or 'None'}",
    ]

    context = "\n".join(context_lines)
    response = genai.complete(
        system=_SYSTEM_PROMPT,
        user=f"Current telemetry snapshot:\n\n{context}\n\nProvide your recommendation.",
        max_tokens=300,
    )

    if response is None:
        return _FALLBACK_TEXT, True

    return response.strip(), False
