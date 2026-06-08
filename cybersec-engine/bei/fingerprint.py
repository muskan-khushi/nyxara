"""bei/fingerprint.py — Compute device fingerprint from browser signals"""
import hashlib
import json


def compute_fingerprint(signals: dict) -> str:
    """
    SHA-256 hash of browser signals. First 32 chars used as fp32.
    Signals: canvas, webgl, screen, timezone, language, fonts, audio
    """
    canonical = json.dumps(signals, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:32]


def is_headless_browser(signals: dict) -> bool:
    """Detect headless Chrome / Puppeteer by known signatures."""
    screen = signals.get("screen", {})
    w, h = screen.get("width", 1920), screen.get("height", 1080)
    # Headless Chrome default viewport
    if w == 800 and h == 600:
        return True
    if signals.get("webgl", "") in ("", "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero))):"):
        return True
    return False


def timezone_mismatch(signals: dict, registered_state: str = None) -> bool:
    """Flag if device timezone doesn't match expected Indian timezone."""
    tz = signals.get("timezone", "")
    indian_timezones = {"Asia/Kolkata", "Asia/Calcutta"}
    return bool(tz and tz not in indian_timezones)