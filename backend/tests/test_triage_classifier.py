"""
Tests for app/genai/triage.py — 100% branch coverage required.

Validates:
- Deterministic escalation keyword detection (all three keyword sets)
- Valid GenAI output parses to correct TriageResult
- Invalid category/severity → fallback
- Malformed JSON → fallback
- AI offline path
- GenAI unavailable (None response) → fallback
"""

import pytest
from unittest.mock import patch, MagicMock

from app.genai.triage import (
    IncidentCategory,
    IncidentSeverity,
    TriageResult,
    _check_escalation,
    classify_incident,
)


# ---------------------------------------------------------------------------
# Deterministic escalation keyword tests
# ---------------------------------------------------------------------------

class TestEscalationKeywords:
    def test_medical_keyword_cardiac(self):
        assert _check_escalation("fan had a cardiac arrest near section 5") is True

    def test_medical_keyword_collapsed(self):
        assert _check_escalation("fan collapsed near Gate B") is True

    def test_medical_keyword_seizure(self):
        assert _check_escalation("person having a seizure in concourse east") is True

    def test_medical_keyword_bleeding(self):
        assert _check_escalation("there is bleeding near section 103") is True

    def test_security_keyword_weapon(self):
        assert _check_escalation("someone spotted with a weapon near Gate D") is True

    def test_security_keyword_bomb(self):
        assert _check_escalation("suspicious package looks like a bomb near exit") is True

    def test_security_keyword_fight(self):
        assert _check_escalation("fight breaking out between fans in section 108") is True

    def test_security_keyword_fire(self):
        assert _check_escalation("smoke and fire reported near food court") is True

    def test_child_safety_keyword_lost_child(self):
        assert _check_escalation("lost child at north concourse, approximately 6 years old") is True

    def test_child_safety_keyword_missing_child(self):
        assert _check_escalation("missing child reported at Gate A") is True

    def test_no_escalation_keywords(self):
        assert _check_escalation("restroom on level 2 is out of paper towels") is False

    def test_no_escalation_crowding(self):
        assert _check_escalation("section 102 is getting a bit congested") is False

    def test_case_insensitive(self):
        assert _check_escalation("FAN HAD A SEIZURE") is True


# ---------------------------------------------------------------------------
# AI offline path
# ---------------------------------------------------------------------------

class TestAiOfflinePath:
    def test_ai_offline_returns_fallback(self):
        result = classify_incident("fan collapsed", ai_offline=True)
        assert isinstance(result, TriageResult)
        assert result.fallback_mode is True
        assert result.needs_human_review is True

    def test_ai_offline_preserves_escalation(self):
        result = classify_incident("fan collapsed near Gate A", ai_offline=True)
        assert result.escalation_required is True

    def test_ai_offline_no_escalation_keywords(self):
        result = classify_incident("broken water fountain", ai_offline=True)
        assert result.escalation_required is False
        assert result.fallback_mode is True


# ---------------------------------------------------------------------------
# GenAI unavailable (None response) → fallback
# ---------------------------------------------------------------------------

class TestGenAIUnavailable:
    def test_none_response_returns_fallback(self):
        with patch("app.genai.triage.genai.complete", return_value=None):
            result = classify_incident("queue at Gate B very long")
            assert result.fallback_mode is True
            assert result.needs_human_review is True
            assert result.category == IncidentCategory.Other
            assert result.severity == IncidentSeverity.Medium

    def test_none_response_escalation_still_set(self):
        with patch("app.genai.triage.genai.complete", return_value=None):
            result = classify_incident("fan collapsed near entrance")
            assert result.escalation_required is True
            assert result.fallback_mode is True


# ---------------------------------------------------------------------------
# Valid GenAI JSON output
# ---------------------------------------------------------------------------

class TestValidGenAIOutput:
    def _mock_response(self, category: str, severity: str, action: str) -> str:
        import json
        return json.dumps({
            "category": category,
            "severity": severity,
            "recommended_action": action,
        })

    def test_valid_medical_high(self):
        response = self._mock_response("Medical", "High", "Dispatch medical team immediately.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("fan collapsed")
            assert result.category == IncidentCategory.Medical
            assert result.severity == IncidentSeverity.High
            assert result.needs_human_review is False
            assert result.fallback_mode is False

    def test_valid_security_medium(self):
        response = self._mock_response("Security", "Medium", "Alert security patrol to section 5.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("suspicious person near Gate C")
            assert result.category == IncidentCategory.Security
            assert result.severity == IncidentSeverity.Medium

    def test_valid_lost_person_low(self):
        response = self._mock_response("LostPerson", "Low", "Direct to information desk.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("fan looking for their group")
            assert result.category == IncidentCategory.LostPerson
            assert result.severity == IncidentSeverity.Low

    def test_valid_facilities(self):
        response = self._mock_response("Facilities", "Low", "Contact maintenance team.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("restroom flooding")
            assert result.category == IncidentCategory.Facilities

    def test_valid_crowd_congestion(self):
        response = self._mock_response("CrowdCongestion", "High", "Open Gate D2 immediately.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("massive queue at Gate D")
            assert result.category == IncidentCategory.CrowdCongestion

    def test_escalation_set_despite_valid_ai_output(self):
        """escalation_required comes from keyword check, not model output."""
        response = self._mock_response("Medical", "High", "Dispatch medics.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("cardiac arrest in section 101")
            assert result.escalation_required is True  # keyword check, not model

    def test_no_escalation_with_valid_ai_output(self):
        response = self._mock_response("Facilities", "Low", "Contact maintenance.")
        with patch("app.genai.triage.genai.complete", return_value=response):
            result = classify_incident("broken seat armrest")
            assert result.escalation_required is False


# ---------------------------------------------------------------------------
# Invalid / malformed GenAI output → fallback
# ---------------------------------------------------------------------------

class TestInvalidGenAIOutput:
    def test_invalid_category_falls_back(self):
        import json
        bad = json.dumps({"category": "Earthquake", "severity": "High", "recommended_action": "Run."})
        with patch("app.genai.triage.genai.complete", return_value=bad):
            result = classify_incident("some incident")
            assert result.fallback_mode is True
            assert result.needs_human_review is True
            assert result.category == IncidentCategory.Other

    def test_invalid_severity_falls_back(self):
        import json
        bad = json.dumps({"category": "Medical", "severity": "Critical", "recommended_action": "Act."})
        with patch("app.genai.triage.genai.complete", return_value=bad):
            result = classify_incident("some incident")
            assert result.fallback_mode is True

    def test_malformed_json_falls_back(self):
        with patch("app.genai.triage.genai.complete", return_value="not json at all"):
            result = classify_incident("some incident")
            assert result.fallback_mode is True
            assert result.needs_human_review is True

    def test_missing_fields_falls_back(self):
        import json
        incomplete = json.dumps({"category": "Medical"})
        with patch("app.genai.triage.genai.complete", return_value=incomplete):
            result = classify_incident("some incident")
            assert result.fallback_mode is True

    def test_markdown_fenced_json_parses(self):
        """Model sometimes wraps JSON in markdown fences — must strip them."""
        import json
        valid = json.dumps({
            "category": "Medical",
            "severity": "High",
            "recommended_action": "Send medics.",
        })
        fenced = f"```json\n{valid}\n```"
        with patch("app.genai.triage.genai.complete", return_value=fenced):
            result = classify_incident("person down")
            assert result.category == IncidentCategory.Medical
            assert result.fallback_mode is False
