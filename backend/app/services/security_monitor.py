"""
services/security_monitor.py — rate limiting + temporary IP blocking (§39).

Used as a FastAPI dependency on abuse-sensitive routes (signup/login,
/connect, messaging). Thresholds are per-endpoint and configurable via
Settings, not a single blanket number — a shared office IP hammering the
public blog isn't the same risk profile as one hammering /auth/login.
"""
import hashlib
import hmac

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.core.request_utils import get_client_ip
from app.services import audit
from app.services.supabase_client import get_supabase

# Endpoint-specific overrides. Falls back to the global Settings defaults
# for anything not listed here.
_ENDPOINT_LIMITS = {
    "/api/v1/auth/login": {"window": 60, "max": 8, "block": 900},
    "/api/v1/connect": {"window": 300, "max": 3, "block": 1800},
    "/api/v1/messages": {"window": 60, "max": 30, "block": 300},
}


def _hash_ip(ip: str) -> str:
    """HMAC-SHA256 hash of the IP using IP_HASH_SALT. Stored instead of plaintext IP in rate_limit_blocks."""
    settings = get_settings()
    salt = (settings.ip_hash_salt or "").encode()
    return hmac.new(salt, ip.encode(), hashlib.sha256).hexdigest()


async def enforce_rate_limit(request: Request) -> None:
    settings = get_settings()
    endpoint = request.url.path
    limits = _ENDPOINT_LIMITS.get(
        endpoint,
        {
            "window": settings.security_rate_limit_window_seconds,
            "max": settings.security_rate_limit_max_requests,
            "block": settings.security_block_duration_seconds,
        },
    )
    ip = get_client_ip(request)

    sb = get_supabase()
    result = sb.rpc(
        "check_and_increment_rate_limit",
        {
            "p_ip": _hash_ip(ip),
            "p_endpoint": endpoint,
            "p_window_seconds": limits["window"],
            "p_max_requests": limits["max"],
            "p_block_seconds": limits["block"],
        },
    ).execute()

    row = result.data[0] if result.data else {"blocked": False, "blocked_until": None}
    if row["blocked"]:
        await audit.log_security_event(
            action="rate_limit_exceeded",
            category="rate_limit",
            ip_address=ip,
            source=endpoint,
            reason=f"Exceeded {limits['max']} requests / {limits['window']}s",
            severity="Alert",
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many requests. Try again after {row['blocked_until']}.",
        )
