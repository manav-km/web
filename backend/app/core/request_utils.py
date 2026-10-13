"""core/request_utils.py — one implementation of "what's the client's real IP", used everywhere."""
import ipaddress

from fastapi import Request


def get_client_ip(request: Request) -> str:
    # Cloud Run (and most reverse proxies) set X-Forwarded-For: client, proxy1, proxy2 —
    # the first entry is the original client. Never fall back to a value
    # like 192.168.x.x as if it were the public IP (§37).
    forwarded = request.headers.get("x-forwarded-for")
    raw = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    # Validate it's actually an IP address
    try:
        ipaddress.ip_address(raw)
        return raw
    except ValueError:
        return "invalid"
