"""api/routes.py — Cybersec Engine API (with biometrics)"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from bei.fingerprint  import compute_fingerprint, is_headless_browser, timezone_mismatch
from bei.velocity     import track_device_access, track_ip_access, is_known_fraud_device, compute_velocity_score
from bei.device_graph import record_access, get_controller_risk_score
from bei.biometrics   import analyze_typing_rhythm, analyze_mouse_entropy, compute_session_velocity, aggregate_biometric_score
from ja3.fingerprint  import analyze_ja3

router = APIRouter()


class DeviceSignal(BaseModel):
    account_id:              Optional[str]        = "unknown"
    canvas_hash:             Optional[str]        = ""
    webgl:                   Optional[str]        = ""
    screen:                  Optional[dict]       = {}
    timezone:                Optional[str]        = ""
    language:                Optional[str]        = ""
    audio_hash:              Optional[str]        = ""
    ip:                      Optional[str]        = "0.0.0.0"
    user_agent:              Optional[str]        = ""
    ja3_hash:                Optional[str]        = None
    # Behavioral biometrics (from frontend JS collectors)
    keystroke_intervals_ms:  Optional[list[float]] = []
    mouse_coordinates:       Optional[list[list]]  = []
    event_count:             Optional[int]         = 0
    session_duration_seconds: Optional[float]      = 0.0
    form_fill_seconds:       Optional[float]       = None


@router.post("/v1/bei")
async def score_device(payload: DeviceSignal):
    """Score device risk from all BEI signals."""
    signals = {
        "canvas_hash": payload.canvas_hash,
        "webgl":       payload.webgl,
        "screen":      payload.screen,
        "timezone":    payload.timezone,
        "language":    payload.language,
        "audio_hash":  payload.audio_hash,
        "user_agent":  payload.user_agent,
    }
    fp32  = compute_fingerprint(signals)
    flags = []

    # Known fraud device — immediate block
    if is_known_fraud_device(fp32):
        return {"bei_risk_score": 1.0, "flags": ["KNOWN_FRAUD_DEVICE"], "fingerprint": fp32}

    # Headless browser
    if is_headless_browser(signals):
        flags.append("HEADLESS_BROWSER_DETECTED")

    # Timezone mismatch
    if timezone_mismatch(signals):
        flags.append("TIMEZONE_MISMATCH_NON_INDIAN")

    # JA3 TLS fingerprint
    ja3_result = analyze_ja3(payload.ja3_hash)
    if ja3_result["risk"] == "critical":
        flags.append("MALWARE_JA3_SIGNATURE")

    # Velocity
    dev_vel = track_device_access(fp32, payload.account_id)
    ip_vel  = track_ip_access(payload.ip, payload.account_id)
    flags  += dev_vel["flags"] + ip_vel["flags"]

    # Device graph
    record_access(fp32, payload.account_id)
    controller_score = get_controller_risk_score(fp32)

    # Behavioral biometrics
    typing   = analyze_typing_rhythm(payload.keystroke_intervals_ms or [])
    mouse    = analyze_mouse_entropy([tuple(c) for c in (payload.mouse_coordinates or [])])
    velocity = compute_session_velocity(
        payload.event_count or 0,
        payload.session_duration_seconds or 1.0,
        payload.form_fill_seconds,
    )
    bio_score = aggregate_biometric_score(typing, mouse, velocity)

    if velocity.get("bot_fill_detected"):
        flags.append("BOT_FORM_FILL_DETECTED")
    if mouse.get("is_bot_like"):
        flags.append("BOT_MOUSE_MOVEMENT")
    if typing.get("consistency_score", 0) > 0.85:
        flags.append("SCRIPTED_TYPING_RHYTHM")

    # Final BEI score
    vel_score = compute_velocity_score(dev_vel["device_account_count"], ip_vel["ip_account_count"])
    bei_score = max(vel_score, controller_score, bio_score, ja3_result["score"])
    if "HEADLESS_BROWSER_DETECTED" in flags:
        bei_score = max(bei_score, 0.6)
    if "TIMEZONE_MISMATCH_NON_INDIAN" in flags:
        bei_score = max(bei_score, 0.3)

    return {
        "bei_risk_score":        round(bei_score, 4),
        "flags":                 flags,
        "fingerprint":           fp32,
        "device_account_count":  dev_vel["device_account_count"],
        "ip_account_count":      ip_vel["ip_account_count"],
        "biometrics": {
            "typing":   typing,
            "mouse":    mouse,
            "velocity": velocity,
        },
    }


@router.get("/v1/known-fraud-devices")
async def list_fraud_devices():
    return {"message": "Query Redis fraud_devices SET directly via redis-cli smembers fraud_devices"}


@router.post("/v1/report-fraud-device")
async def report_fraud_device(fp32: str):
    from bei.velocity import register_fraud_device
    register_fraud_device(fp32)
    return {"registered": fp32}


@router.get("/health")
async def health():
    return {"status": "ok", "service": "nyxara-cybersec"}