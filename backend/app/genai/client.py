"""
Google Gemini API Client — FanFlow AI
Calls the Gemini API (Google AI Studio) via httpx with timeout, retry, and circuit-breaker logic.

ARCHITECTURAL BOUNDARY: This module is the *only* place in the codebase
that calls out to the GenAI API. All callers must pass already-computed
physical facts as context. The client never computes routes or distances.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from enum import Enum

import httpx

logger = logging.getLogger(__name__)

MODEL = "gemini-1.5-flash"
TIMEOUT_S = 15.0
MAX_RETRIES = 2
RETRY_BASE_DELAY = 1.0

# Circuit breaker config
CB_FAILURE_THRESHOLD = 3   # open after this many consecutive failures
CB_RESET_TIMEOUT_S = 60.0  # try again after this many seconds


class CircuitState(str, Enum):
    CLOSED = "closed"      # normal operation
    OPEN = "open"          # failing, reject immediately
    HALF_OPEN = "half_open"  # testing if service recovered


class GenAIClient:
    """
    Thread-safe(ish) Gemini API wrapper.

    The circuit breaker prevents cascading failures: after CB_FAILURE_THRESHOLD
    consecutive errors the circuit opens and calls fail immediately (returning
    None) until CB_RESET_TIMEOUT_S seconds have elapsed.
    """

    def __init__(self) -> None:
        self._api_key = os.getenv("GEMINI_API_KEY", "")
        self._cb_state = CircuitState.CLOSED
        self._cb_failures = 0
        self._cb_opened_at: float = 0.0

    def _check_circuit(self) -> bool:
        """Return True if we should attempt a call, False if circuit is open."""
        if self._cb_state == CircuitState.CLOSED:
            return True
        if self._cb_state == CircuitState.OPEN:
            if time.monotonic() - self._cb_opened_at >= CB_RESET_TIMEOUT_S:
                self._cb_state = CircuitState.HALF_OPEN
                return True
            return False
        # HALF_OPEN — allow one attempt
        return True

    def _on_success(self) -> None:
        self._cb_failures = 0
        self._cb_state = CircuitState.CLOSED

    def _on_failure(self) -> None:
        self._cb_failures += 1
        if self._cb_failures >= CB_FAILURE_THRESHOLD:
            self._cb_state = CircuitState.OPEN
            self._cb_opened_at = time.monotonic()
            logger.warning("GenAI circuit breaker OPENED after %d failures", self._cb_failures)

    def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 1024,
    ) -> str | None:
        """
        Synchronous call to the Google Gemini API.

        Returns the response text, or None on any failure (timeout, API error,
        missing key, circuit open). Callers must handle None gracefully.

        ai_offline shortcut: if the GEMINI_API_KEY is absent, always
        returns None — enabling fully offline deterministic operation.
        """
        if not self._api_key:
            logger.info("No Gemini API key configured — deterministic mode active")
            return None

        if not self._check_circuit():
            logger.info("GenAI circuit OPEN — skipping API call")
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={self._api_key}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system}]
            },
            "generationConfig": {
                "maxOutputTokens": max_tokens
            }
        }

        delay = RETRY_BASE_DELAY
        for attempt in range(MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=TIMEOUT_S) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    res_json = response.json()
                    text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                self._on_success()
                return text

            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                logger.warning("GenAI timeout/connect error (attempt %d): %s", attempt + 1, exc)
                self._on_failure()
                if attempt < MAX_RETRIES:
                    time.sleep(delay)
                    delay *= 2

            except httpx.HTTPStatusError as exc:
                logger.warning("Gemini API error status %d (attempt %d): %s", exc.response.status_code, attempt + 1, exc)
                self._on_failure()
                if attempt < MAX_RETRIES:
                    time.sleep(delay)
                    delay *= 2

            except Exception as exc:  # noqa: BLE001
                logger.error("Unexpected GenAI error: %s", exc)
                self._on_failure()
                break

        return None  # exhausted retries


# Module-level singleton — import this in other genai modules
_client = GenAIClient()


def complete(system: str, user: str, max_tokens: int = 1024) -> str | None:
    """Convenience function wrapping the singleton client."""
    return _client.complete(system=system, user=user, max_tokens=max_tokens)

