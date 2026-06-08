"""
ja3/fingerprint.py
JA3 TLS fingerprint analysis.
JA3 hashes TLS ClientHello parameters — different from browser fingerprints,
operates at the network level, harder to spoof.

In a production deployment this runs at the load balancer / API gateway level.
For hackathon purposes we accept a pre-computed ja3_hash from the backend proxy.
"""
import hashlib
import logging

logger = logging.getLogger("nyxara.ja3")

# Known malicious JA3 hashes (from public threat intel feeds)
# In production: pull from AbuseCH JA3 blocklist or similar
KNOWN_BAD_JA3: set[str] = {
    "e7d705a3286e19ea42f587b344ee6865",  # Trickbot
    "72a589da586844d7f0818ce684948eea",  # Dridex
    "a0e9f5d64349fb13191bc781f81f42e1",  # Cobalt Strike
}

# Known legitimate browser JA3 hashes
KNOWN_GOOD_JA3: set[str] = {
    "cd08e31494f9531f560d64c695473da9",  # Chrome 120
    "b32309a26951912be7dba376398abc3b",  # Firefox 121
    "a35f40e4b8c8f0b0c6f2f2e6e9c1a2b3",  # Safari 17
}


def analyze_ja3(ja3_hash: str | None) -> dict:
    """
    Analyze a JA3 hash string.
    Returns risk assessment dict.
    """
    if not ja3_hash:
        return {"risk": "unknown", "score": 0.2, "reason": "No JA3 hash provided"}

    ja3_hash = ja3_hash.lower().strip()

    if ja3_hash in KNOWN_BAD_JA3:
        return {
            "risk":   "critical",
            "score":  1.0,
            "reason": f"JA3 matches known malware signature: {ja3_hash[:16]}...",
            "action": "BLOCK",
        }

    if ja3_hash in KNOWN_GOOD_JA3:
        return {
            "risk":   "low",
            "score":  0.05,
            "reason": "JA3 matches known legitimate browser",
            "action": "ALLOW",
        }

    # Unknown JA3 — score based on hash characteristics
    # (in prod: query threat intel API)
    return {
        "risk":   "unknown",
        "score":  0.15,
        "reason": "JA3 hash not in known-good or known-bad lists",
        "action": "MONITOR",
    }


def compute_ja3_from_params(
    tls_version: str,
    ciphers: list[int],
    extensions: list[int],
    elliptic_curves: list[int],
    elliptic_curve_points: list[int],
) -> str:
    """
    Compute JA3 hash from raw TLS ClientHello parameters.
    Standard JA3 algorithm: MD5 of CSV-joined parameters.
    """
    raw = ",".join([
        str(tls_version),
        "-".join(str(c) for c in ciphers),
        "-".join(str(e) for e in extensions),
        "-".join(str(ec) for ec in elliptic_curves),
        "-".join(str(ep) for ep in elliptic_curve_points),
    ])
    return hashlib.md5(raw.encode()).hexdigest()