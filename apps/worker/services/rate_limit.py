"""Request rate limiting with Redis, falling back to in-memory.

The worker may run as multiple replicas behind a load balancer, so an
in-process counter under-counts. When Redis is reachable we use an atomic
INCR+EXPIRE sliding-window-ish counter shared across replicas; if Redis is
unavailable we degrade to a per-process in-memory window so the endpoint keeps
working (single-replica dev, or Redis outage).
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict

from config import settings

log = logging.getLogger("fgp.ratelimit")

RATE_LIMIT = 10
RATE_WINDOW = 60  # seconds

_memory_log: dict[str, list[float]] = defaultdict(list)
_redis_client = None
_redis_unavailable = False


def _get_redis():
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is None:
        try:
            import redis

            client = redis.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            client.ping()
            _redis_client = client
        except Exception as e:  # noqa: BLE001 — any failure -> memory fallback
            log.warning("redis unavailable, using in-memory rate limiting: %s", e)
            _redis_unavailable = True
            return None
    return _redis_client


def _memory_is_limited(key: str, limit: int, window: int) -> bool:
    now = time.time()
    window_start = now - window
    _memory_log[key] = [t for t in _memory_log[key] if t > window_start]
    if len(_memory_log[key]) >= limit:
        return True
    _memory_log[key].append(now)
    return False


def is_rate_limited(key: str, limit: int = RATE_LIMIT, window: int = RATE_WINDOW) -> bool:
    """Return True if `key` has exceeded `limit` requests within `window` seconds."""
    client = _get_redis()
    if client is not None:
        try:
            redis_key = f"ratelimit:{key}"
            count = client.incr(redis_key)
            if count == 1:
                client.expire(redis_key, window)
            return count > limit
        except Exception as e:  # noqa: BLE001 — degrade to memory on op failure
            log.warning("redis rate-limit op failed, using memory: %s", e)
    return _memory_is_limited(key, limit, window)
