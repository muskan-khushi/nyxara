"""
inference/alert_narrator.py
Generate plain-English compliance alerts from ML output.
Uses Groq API. Falls back to rule-based template if no API key.
"""
import logging
import os
from typing import Optional

logger = logging.getLogger("nyxara.narrator")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Risk level labels for prompt
DECISION_LABELS = {
    "APPROVE": "LOW",
    "REVIEW":  "MEDIUM",
    "FLAG":    "HIGH",
    "BLOCK":   "CRITICAL",
}


def _build_prompt(
    account_id: str,
    decision: str,
    final_risk: float,
    occupation: str,
    top_factors: list[dict],
    ring_membership: bool,
    community_fraud_rate: float,
) -> str:
    risk_label = DECISION_LABELS.get(decision, "HIGH")
    top3 = top_factors[:3]
    factors_text = "; ".join(
        f"{f['feature']} (impact: {f['shap_value']:+.3f})" for f in top3
    )

    ring_text = ""
    if ring_membership:
        ring_text = (
            f" Account is a member of a suspicious transaction ring "
            f"(community fraud rate: {community_fraud_rate:.1%})."
        )

    return f"""You are a bank compliance officer assistant generating a Suspicious Transaction Report (STR) alert.
Write a 3-sentence plain English alert for the following account analysis.

IMPORTANT RULES:
- Use legally appropriate language: "exhibits behaviors consistent with indicators of" — never "this person is a criminal"
- Every claim must trace back to the provided data — no hallucination
- Output must map to FIU-IND STR format fields
- Be factual, precise, and professional

Account ID: {account_id}
Occupation: {occupation}
Risk Score: {final_risk:.2f} ({risk_label} RISK)
Recommended Action: {decision}
Top Risk Factors: {factors_text}{ring_text}

Write exactly 3 sentences. Sentence 1: overall risk assessment. Sentence 2: primary behavioral indicators. Sentence 3: recommended compliance action."""


def _rule_based_alert(
    account_id: str,
    decision: str,
    final_risk: float,
    occupation: str,
    top_factors: list[dict],
    ring_membership: bool,
) -> str:
    """Fallback alert when no Groq API key is configured."""
    risk_label = DECISION_LABELS.get(decision, "HIGH")
    top_feature = top_factors[0]["feature"] if top_factors else "transaction velocity"

    ring_text = " Account is identified as a member of a suspicious transaction ring." if ring_membership else ""

    action_map = {
        "APPROVE": "No immediate action required; continue standard monitoring.",
        "REVIEW":  "Initiate enhanced due diligence review within 24 hours.",
        "FLAG":    "Escalate to senior compliance officer; consider account restriction.",
        "BLOCK":   "Recommend immediate account freeze and initiate STR filing with FIU-IND.",
    }

    return (
        f"Account {account_id} ({occupation}) exhibits behaviors consistent with indicators of "
        f"financial fraud, receiving a {risk_label} risk score of {final_risk:.2f}. "
        f"Primary behavioral indicators include anomalous {top_feature} relative to occupation peer group, "
        f"with additional signals from transaction pattern analysis.{ring_text} "
        f"{action_map.get(decision, 'Escalate for manual review.')}"
    )


async def generate_alert(
    account_id: str,
    decision: str,
    final_risk: float,
    occupation: str,
    top_factors: list[dict],
    ring_membership: bool = False,
    community_fraud_rate: float = 0.0,
) -> str:
    """
    Generate compliance alert text.
    Uses Groq API if key configured, otherwise rule-based fallback.
    """
    if not GROQ_API_KEY:
        logger.debug("No Groq API key — using rule-based alert narrator.")
        return _rule_based_alert(
            account_id, decision, final_risk, occupation, top_factors, ring_membership
        )

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=GROQ_API_KEY)

        prompt = _build_prompt(
            account_id, decision, final_risk, occupation,
            top_factors, ring_membership, community_fraud_rate
        )

        chat_completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            max_tokens=300,
        )

        return chat_completion.choices[0].message.content.strip()

    except Exception as e:
        logger.warning(f"Groq API call failed ({e}) — falling back to rule-based alert.")
        return _rule_based_alert(
            account_id, decision, final_risk, occupation, top_factors, ring_membership
        )