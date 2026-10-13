"""
services/turnstile.py — verifies a Cloudflare Turnstile token server-side
(§40 bot protection). If the secret key isn't configured yet, verification
is skipped (returns True) so local dev isn't blocked — but once configured,
a missing/invalid token is always rejected, never silently waved through.
"""
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("turnstile")
_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify(token: str | None, remote_ip: str) -> bool:
    settings = get_settings()
    if not settings.turnstile_secret_key:
        return True  # not configured yet — see docs/security.md "Known gaps"
    if not token:
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_VERIFY_URL, data={
                "secret": settings.turnstile_secret_key, "response": token, "remoteip": remote_ip,
            })
        return bool(resp.json().get("success"))
    except httpx.HTTPError:
        logger.warning("Turnstile verification request failed — treating as unverified")
        return False
