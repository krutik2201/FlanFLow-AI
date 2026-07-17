"""Transport scoring router — deterministic carbon/ETA comparison."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.genai import client as genai
from app.genai.ops_advisor import _FALLBACK_TEXT

router = APIRouter()

# Emission factors (g CO₂ per passenger km)
_EMISSION_FACTORS = {
    "transit": 41,     # metro/rail average
    "rideshare": 180,  # average rideshare
    "parking":   192,  # personal car
    "walk":        0,
}

# Approximate distance to venue from city centre (km)
_VENUE_DISTANCE_KM = 8.5

# Base ETAs (minutes) — overridden by live telemetry when available
_BASE_ETA = {
    "transit": 22,
    "rideshare": 28,
    "parking": 35,
    "walk": 110,
}

_COST_EST = {
    "transit": 2.50,
    "rideshare": 14.00,
    "parking": 25.00,
    "walk": 0.00,
}

_MODE_LABELS = {
    "transit": "Rail / Metro",
    "rideshare": "Rideshare",
    "parking": "Drive & Park",
    "walk": "Walk / Cycle",
}

_SYSTEM_PROMPT = """\
You are a sustainability advisor for FanFlow AI at a FIFA World Cup venue.

You will receive factual carbon and travel data computed deterministically.
Write ONE friendly sentence (≤ 25 words) comparing the fan's chosen mode
to the next-best sustainable option. Reference the actual numbers provided.
Do not invent any figures. Keep it upbeat and encouraging.
"""


@router.get("/score", summary="Get transport carbon score and ETA")
async def transport_score(
    mode: str = Query(..., description="transit | rideshare | parking | walk"),
    ai_offline: bool = Query(False),
):
    if mode not in _EMISSION_FACTORS:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=422,
            content={"detail": f"Unknown mode. Choose from: {', '.join(_EMISSION_FACTORS)}"},
        )

    # Deterministic computation
    carbon_g = int(_EMISSION_FACTORS[mode] * _VENUE_DISTANCE_KM)
    eta_min = _BASE_ETA[mode]
    cost_usd = _COST_EST[mode]

    # Build comparison to transit (always shown as reference)
    transit_carbon = int(_EMISSION_FACTORS["transit"] * _VENUE_DISTANCE_KM)
    saving_g = carbon_g - transit_carbon
    saving_label = f"{saving_g}g CO₂" if saving_g > 0 else f"{abs(saving_g)}g CO₂ less than driving"

    all_modes = [
        {
            "mode": m,
            "label": _MODE_LABELS[m],
            "carbon_g": int(_EMISSION_FACTORS[m] * _VENUE_DISTANCE_KM),
            "eta_min": _BASE_ETA[m],
            "cost_usd": _COST_EST[m],
        }
        for m in _EMISSION_FACTORS
    ]

    summary_text: str
    fallback_mode: bool

    if ai_offline:
        summary_text = (
            f"Taking {_MODE_LABELS[mode]} produces {carbon_g}g CO₂ for this trip."
            f" Compare: transit={transit_carbon}g."
        )
        fallback_mode = True
    else:
        context = (
            f"Chosen mode: {_MODE_LABELS[mode]}\n"
            f"Carbon: {carbon_g}g CO₂\n"
            f"ETA: {eta_min} minutes\n"
            f"Cost: ${cost_usd:.2f}\n"
            f"Transit alternative: {transit_carbon}g CO₂, {_BASE_ETA['transit']} minutes, ${_COST_EST['transit']:.2f}\n"
            f"Saving vs transit: {saving_label}"
        )
        response = genai.complete(
            system=_SYSTEM_PROMPT, user=context, max_tokens=80
        )
        if response:
            summary_text = response.strip()
            fallback_mode = False
        else:
            summary_text = (
                f"Taking {_MODE_LABELS[mode]} uses {carbon_g}g CO₂ — "
                f"{'switch to transit to save ' + str(saving_g) + 'g CO₂!' if saving_g > 0 else 'great eco choice!'}"
            )
            fallback_mode = True

    return {
        "mode": mode,
        "label": _MODE_LABELS[mode],
        "carbon_g": carbon_g,
        "eta_min": eta_min,
        "cost_usd": cost_usd,
        "summary_text": summary_text,
        "fallback_mode": fallback_mode,
        "all_modes": all_modes,
    }
