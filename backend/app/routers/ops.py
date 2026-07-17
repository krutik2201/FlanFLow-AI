"""Operations router — staff copilot, incident triage, ops recommendation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.genai import client as genai
from app.genai.ops_advisor import generate_recommendation
from app.genai.triage import TriageResult, classify_incident
from app.models.telemetry import TelemetrySnapshot

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hardcoded policy knowledge base (production: replace with vector-store RAG)
# ---------------------------------------------------------------------------

_POLICY_KB = """
FanFlow AI Venue Policy — Quick Reference (FIFA World Cup 2026)

ENTRY & ACCESS:
- Gates A, B, C, D open 3 hours before kickoff. Gate D2 opens 90 minutes before.
- All ticket holders must pass through security screening at entry gates.
- Prohibited items: weapons, large bags (>30×20cm), glass containers, laser pointers.
- Accessible entry via Gate A (level-access) and Gate B (dedicated accessible lane).

MEDICAL:
- Medical station located near Gate A (north side). First aid kits at each concourse junction.
- For emergencies: call stadium operations on radio channel 3 or dial extension 911.
- AED devices located at: North Concourse, South Concourse, Gate B, Gate C.

LOST PERSONS:
- Lost child protocol: escort to Family Reunification Point at Gate A foyer.
- Adults: direct to Information Desk (North Concourse, near food court).

CROWD SAFETY:
- If zone density exceeds 85%, activate Gate D2 for additional entry capacity.
- Do not allow fans to congregate in stairwells or emergency exit corridors.

SUSTAINABILITY:
- Encourage fans to use Metro Line 2 (Stadium Express) — priority boarding for accessible patrons.
- Single-use plastics are not permitted for stadium vendors.
"""

_COPILOT_SYSTEM = """\
You are a volunteer copilot assistant for FanFlow AI stadium staff.

Answer questions using the venue policy knowledge base provided.
Be concise (≤ 4 sentences), professional, and helpful.
If the answer is not in the knowledge base, say so — do not guess.
Do NOT recommend medical treatment or security actions — always escalate those to supervisors.
"""

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class TriageRequest(BaseModel):
    transcript: str


class CopilotRequest(BaseModel):
    question: str
    ai_offline: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/triage", response_model=TriageResult, summary="Classify an incident transcript")
async def triage_incident(body: TriageRequest, ai_offline: bool = Query(False)):
    return classify_incident(transcript=body.transcript, ai_offline=ai_offline)


@router.post("/staff/copilot", summary="Staff Q&A copilot")
async def staff_copilot(body: CopilotRequest):
    if body.ai_offline:
        return {
            "answer": "AI copilot offline. Please consult your printed policy guide or supervisor.",
            "fallback_mode": True,
        }

    user_msg = f"Policy Knowledge Base:\n{_POLICY_KB}\n\nStaff question: {body.question}"
    response = genai.complete(system=_COPILOT_SYSTEM, user=user_msg, max_tokens=300)

    if response is None:
        return {
            "answer": "AI copilot temporarily unavailable. Please consult your printed policy guide or supervisor.",
            "fallback_mode": True,
        }

    return {"answer": response.strip(), "fallback_mode": False}


@router.post("/recommend", summary="Generate ops recommendation from telemetry")
async def ops_recommend(snapshot: TelemetrySnapshot, ai_offline: bool = Query(False)):
    recommendation, fallback_mode = generate_recommendation(snapshot, ai_offline=ai_offline)
    return {"recommendation": recommendation, "fallback_mode": fallback_mode}


@router.get("/telemetry/latest", summary="Get latest telemetry snapshot")
async def get_latest_telemetry(request: Request):
    simulator = request.app.state.simulator
    snapshot = simulator.latest
    if snapshot is None:
        # Force first tick
        snapshot = simulator.tick()
    return snapshot
