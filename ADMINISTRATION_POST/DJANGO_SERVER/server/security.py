from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone


def _attempt_key(username, ip_address):
    return f"auth_login_attempts:{(username or '').lower()}:{ip_address or 'unknown'}"


def check_login_locked(username, ip_address):
    key = _attempt_key(username, ip_address)
    state = cache.get(key)
    if not state:
        return False, 0

    locked_until = state.get("locked_until")
    if not locked_until:
        return False, 0

    now = timezone.now()
    if locked_until <= now:
        cache.delete(key)
        return False, 0

    remaining_seconds = int((locked_until - now).total_seconds())
    return True, max(remaining_seconds, 1)


def record_login_failure(username, ip_address, max_attempts, lock_minutes):
    key = _attempt_key(username, ip_address)
    state = cache.get(key) or {"count": 0, "locked_until": None}

    state["count"] = int(state.get("count", 0)) + 1
    if state["count"] >= max_attempts:
        state["locked_until"] = timezone.now() + timedelta(minutes=lock_minutes)

    ttl = max(lock_minutes * 60, 300)
    cache.set(key, state, ttl)

    return {
        "count": state["count"],
        "locked_until": state.get("locked_until"),
        "remaining_attempts": max(max_attempts - state["count"], 0),
    }


def clear_login_failures(username, ip_address):
    cache.delete(_attempt_key(username, ip_address))
