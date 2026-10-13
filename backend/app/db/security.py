"""db/security.py — read-side helpers for the Security View admin tab."""
from app.services.supabase_client import get_supabase


def list_filtered(
    severity: str | None = None,
    action: str | None = None,
    ip_address: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    sb = get_supabase()
    q = sb.table("security_events").select("*").order("occurred_at", desc=True)
    if severity:
        q = q.eq("severity", severity)
    if action:
        q = q.eq("action", action)
    if ip_address:
        q = q.eq("ip_address", ip_address)
    if date_from:
        q = q.gte("occurred_at", date_from)
    if date_to:
        q = q.lte("occurred_at", date_to)
    return q.range(offset, offset + limit - 1).execute().data
