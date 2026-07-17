"""
Incident Triage Classifier — FanFlow AI

ARCHITECTURAL BOUNDARY:
- Deterministic keyword scan runs BEFORE any GenAI call.
- GenAI output is validated against Pydantic enums server-side.
- If validation fails → fallback to Other/Medium + needs_human_review=True.
- escalation_required is set deterministically, never by the LLM alone.

100% branch-coverage tests required (see tests/test_triage_classifier.py).
"""

from __future__ import annotations

import json
import logging
import re
from enum import Enum

from pydantic import BaseModel, ValidationError

from app.genai import client as genai

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums (server-enforced)
# ---------------------------------------------------------------------------

class IncidentCategory(str, Enum):
    Medical = "Medical"
    Security = "Security"
    LostPerson = "LostPerson"
    CrowdCongestion = "CrowdCongestion"
    Facilities = "Facilities"
    Other = "Other"


class IncidentSeverity(str, Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------

class TriageResult(BaseModel):
    category: IncidentCategory
    severity: IncidentSeverity
    recommended_action: str
    needs_human_review: bool
    escalation_required: bool
    fallback_mode: bool = False


# ---------------------------------------------------------------------------
# Deterministic escalation keywords (checked BEFORE GenAI call)
# ---------------------------------------------------------------------------

_MEDICAL_KEYWORDS = re.compile(
    r"\b(cardiac|heart attack|unconscious|not breathing|collapsed|seizure|"
    r"bleeding|injury|injured|ambulance|cpr|aed|defibrillator|overdose|"
    r"allergic reaction|anaphylaxis|stroke|choking)\b",
    re.IGNORECASE,
)

_SECURITY_KEYWORDS = re.compile(
    r"\b(weapon|gun|knife|bomb|threat|explosive|terror|suspicious package|"
    r"fight|assault|violence|evacuation|fire|smoke|suspicious person)\b",
    re.IGNORECASE,
)

_CHILD_SAFETY_KEYWORDS = re.compile(
    r"\b(lost child|missing child|unaccompanied minor|child alone|child safety|"
    r"amber alert|abduction|kidnap)\b",
    re.IGNORECASE,
)


def _check_escalation(transcript: str) -> bool:
    """
    Deterministic escalation check — independent of GenAI.
    Returns True if the transcript contains any high-risk keyword.
    """
    return bool(
        _MEDICAL_KEYWORDS.search(transcript)
        or _SECURITY_KEYWORDS.search(transcript)
        or _CHILD_SAFETY_KEYWORDS.search(transcript)
    )


# ---------------------------------------------------------------------------
# Fallback result
# ---------------------------------------------------------------------------

_FALLBACK_RESULT = TriageResult(
    category=IncidentCategory.Other,
    severity=IncidentSeverity.Medium,
    recommended_action="Needs human review — automated classification unavailable.",
    needs_human_review=True,
    escalation_required=False,
    fallback_mode=True,
)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are an incident triage assistant for a FIFA World Cup stadium operations center.

Classify the following radio transcript into EXACTLY this JSON format — no extra text:
{
  "category": "<one of: Medical, Security, LostPerson, CrowdCongestion, Facilities, Other>",
  "severity": "<one of: Low, Medium, High>",
  "recommended_action": "<one sentence, ≤ 25 words, imperative form>"
}

RULES:
- Output only valid JSON. No markdown, no explanation, no commentary.
- Choose the single most appropriate category and severity.
- The recommended_action must be short, clear, and actionable.
- Do NOT recommend taking actions yourself — you are advisory only.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_incident(
    transcript: str,
    ai_offline: bool = False,
) -> TriageResult:
    """
    Classify a radio transcript into a structured TriageResult.

    Steps:
    1. Deterministic escalation keyword check (always runs).
    2. If ai_offline or GenAI unavailable → return fallback with escalation flag.
    3. Call GenAI, parse and validate JSON response against Pydantic enums.
    4. If parse fails → fallback with needs_human_review=True.
    """
    escalation_required = _check_escalation(transcript)

    if ai_offline:
        result = _FALLBACK_RESULT.model_copy()
        result.escalation_required = escalation_required
        result.fallback_mode = True
        return result

    response_text = genai.complete(
        system=_SYSTEM_PROMPT,
        user=f"Transcript: {transcript}",
        max_tokens=256,
    )

    if response_text is None:
        result = _FALLBACK_RESULT.model_copy()
        result.escalation_required = escalation_required
        return result

    # Strip markdown code fences if present
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)

    try:
        data = json.loads(cleaned)
        triage = TriageResult(
            category=IncidentCategory(data["category"]),
            severity=IncidentSeverity(data["severity"]),
            recommended_action=str(data.get("recommended_action", ""))[:200],
            needs_human_review=False,
            escalation_required=escalation_required,
            fallback_mode=False,
        )
        return triage

    except (json.JSONDecodeError, KeyError, ValueError, ValidationError) as exc:
        logger.warning("Triage parse failed (%s) — using fallback", exc)
        result = _FALLBACK_RESULT.model_copy()
        result.escalation_required = escalation_required
        return result
