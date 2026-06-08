"""bei/velocity.py — Redis-backed velocity tracking"""
import os
import redis
import logging

logger = logging.getLogger("nyxara.velocity")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

try:
    r = redis.from_url(REDIS_URL, decode_responses=True)
    r.ping()
    REDIS_AVAILABLE = True
    logger.info("✅ Redis connected")
except Exception as e:
    REDIS_AVAILABLE = False
    logger.warning(f"⚠️  Redis unavailable ({e}). Velocity tracking disabled.")

# Thresholds
DEVICE_ACCOUNT_SOFT  = 5    # > 5 accounts per device in 24h → soft flag
DEVICE_ACCOUNT_HARD  = 10   # > 10 → hard block signal
IP_ACCOUNT_SOFT      = 3    # > 3 accounts per IP in 1h → alert
IP_ACCOUNT_HARD      = 8    # > 8 → block IP signal


def track_device_access(fp32: str, account_id: str) -> dict:
    """Record device→account access. Returns velocity flags."""
    if not REDIS_AVAILABLE:
        return {"device_account_count": 0, "flags": []}

    key = f"device:{fp32}:accounts"
    pipe = r.pipeline()
    pipe.sadd(key, account_id)
    pipe.expire(key, 86400)  # 24h TTL
    pipe.scard(key)
    results = pipe.execute()
    count = results[2]

    flags = []
    if count > DEVICE_ACCOUNT_HARD:
        flags.append(f"DEVICE_CONTROLS_{count}_ACCOUNTS_HARD_BLOCK")
    elif count > DEVICE_ACCOUNT_SOFT:
        flags.append(f"DEVICE_CONTROLS_{count}_ACCOUNTS_SOFT_FLAG")

    return {"device_account_count": count, "flags": flags}


def track_ip_access(ip: str, account_id: str) -> dict:
    """Record IP→account access within 1h window."""
    if not REDIS_AVAILABLE:
        return {"ip_account_count": 0, "flags": []}

    key = f"ip:{ip}:accounts:1h"
    pipe = r.pipeline()
    pipe.sadd(key, account_id)
    pipe.expire(key, 3600)
    pipe.scard(key)
    results = pipe.execute()
    count = results[2]

    flags = []
    if count > IP_ACCOUNT_HARD:
        flags.append(f"IP_ACCESSING_{count}_ACCOUNTS_BLOCK")
    elif count > IP_ACCOUNT_SOFT:
        flags.append(f"IP_ACCESSING_{count}_ACCOUNTS_ALERT")

    return {"ip_account_count": count, "flags": flags}


def is_known_fraud_device(fp32: str) -> bool:
    if not REDIS_AVAILABLE:
        return False
    return r.sismember("fraud_devices", fp32)


def register_fraud_device(fp32: str):
    if REDIS_AVAILABLE:
        r.sadd("fraud_devices", fp32)


def compute_velocity_score(device_count: int, ip_count: int) -> float:
    """Normalize velocity signals to [0, 1] risk score."""
    d_score = min(device_count / DEVICE_ACCOUNT_HARD, 1.0)
    i_score = min(ip_count / IP_ACCOUNT_HARD, 1.0)
    return max(d_score, i_score)