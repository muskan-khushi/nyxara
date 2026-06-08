"""
bei/biometrics.py
Session behavioral biometrics — typing rhythm, mouse entropy, session velocity.
All signals are statistical aggregates — no raw keystrokes stored (GDPR-compliant).

Key insight from BioCatch research:
A mule controller accessing 15 accounts will have statistically identical
typing rhythm across all sessions. P(same human) drops exponentially with count.
"""
import logging
import math
import statistics

logger = logging.getLogger("nyxara.biometrics")


def analyze_typing_rhythm(keystroke_intervals_ms: list[float]) -> dict:
    """
    Analyze inter-keystroke timing intervals.
    Input: list of millisecond gaps between keystrokes (from frontend JS).

    Returns consistency score — same controller = very consistent rhythm.
    """
    if len(keystroke_intervals_ms) < 5:
        return {"consistency_score": 0.5, "mean_interval": 0.0, "cv": 0.0, "sample_size": len(keystroke_intervals_ms)}

    intervals = [max(i, 1) for i in keystroke_intervals_ms]
    mean_ms   = statistics.mean(intervals)
    std_ms    = statistics.stdev(intervals) if len(intervals) > 1 else 0.0
    cv        = std_ms / mean_ms if mean_ms > 0 else 0.0  # Coefficient of variation

    # Low CV = very consistent = likely bot or single controller
    # Human CV typically 0.3–0.8; bot/scripted < 0.1; very distracted > 1.0
    if cv < 0.05:
        consistency_score = 0.95   # Almost certainly automated
    elif cv < 0.15:
        consistency_score = 0.75   # Suspiciously consistent
    elif cv < 0.30:
        consistency_score = 0.50   # Borderline
    else:
        consistency_score = 0.20   # Normal human variation

    return {
        "consistency_score": round(consistency_score, 3),
        "mean_interval_ms":  round(mean_ms, 1),
        "std_interval_ms":   round(std_ms, 1),
        "cv":                round(cv, 3),
        "sample_size":       len(intervals),
    }


def analyze_mouse_entropy(mouse_coordinates: list[tuple[float, float]]) -> dict:
    """
    Compute entropy of mouse movement path.
    Bots move in straight lines (low entropy); humans are chaotic (high entropy).

    Input: list of (x, y) coordinates sampled during session.
    """
    if len(mouse_coordinates) < 10:
        return {"entropy_score": 0.5, "is_bot_like": False}

    # Compute direction changes
    directions = []
    for i in range(1, len(mouse_coordinates)):
        dx = mouse_coordinates[i][0] - mouse_coordinates[i-1][0]
        dy = mouse_coordinates[i][1] - mouse_coordinates[i-1][1]
        if dx == 0 and dy == 0:
            continue
        angle = math.atan2(dy, dx)
        directions.append(angle)

    if len(directions) < 3:
        return {"entropy_score": 0.5, "is_bot_like": False}

    # Shannon entropy of quantized directions
    buckets = [0] * 16
    for angle in directions:
        bucket = int((angle + math.pi) / (2 * math.pi) * 16) % 16
        buckets[bucket] += 1

    total = sum(buckets)
    entropy = 0.0
    for count in buckets:
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)

    # Max entropy for 16 buckets = 4.0 bits
    normalized = entropy / 4.0

    # Low entropy = straight-line bot movement
    is_bot_like = normalized < 0.3

    return {
        "entropy_score":  round(normalized, 3),
        "raw_entropy":    round(entropy, 3),
        "is_bot_like":    is_bot_like,
        "n_movements":    len(directions),
    }


def compute_session_velocity(
    event_count: int,
    session_duration_seconds: float,
    form_fill_seconds: float | None = None,
) -> dict:
    """
    Events-per-second and form fill speed anomaly detection.
    A human fills out a banking form in 30–120s; a bot in < 2s.
    """
    if session_duration_seconds <= 0:
        return {"velocity_score": 0.0, "events_per_second": 0.0, "bot_fill_detected": False}

    eps = event_count / session_duration_seconds

    # > 10 events/second = suspicious; > 50 = definitely automated
    if eps > 50:
        vel_score = 1.0
    elif eps > 10:
        vel_score = 0.7
    elif eps > 5:
        vel_score = 0.4
    else:
        vel_score = 0.1

    bot_fill = False
    if form_fill_seconds is not None and form_fill_seconds < 3.0:
        bot_fill  = True
        vel_score = max(vel_score, 0.8)

    return {
        "velocity_score":      round(vel_score, 3),
        "events_per_second":   round(eps, 2),
        "session_duration_s":  round(session_duration_seconds, 1),
        "bot_fill_detected":   bot_fill,
    }


def aggregate_biometric_score(
    typing: dict,
    mouse: dict,
    velocity: dict,
) -> float:
    """
    Aggregate all biometric signals into a single BEI contribution score [0,1].
    Weighted: typing consistency 40%, mouse entropy 30%, velocity 30%.
    """
    t_score = typing.get("consistency_score", 0.5)
    m_score = 1.0 - mouse.get("entropy_score", 0.5)   # Low entropy = high risk
    v_score = velocity.get("velocity_score", 0.0)

    # Bot fill is an immediate strong signal
    if mouse.get("is_bot_like") and velocity.get("bot_fill_detected"):
        return 0.95

    return round(0.4 * t_score + 0.3 * m_score + 0.3 * v_score, 3)