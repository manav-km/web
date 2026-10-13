"""db/audit.py — read-side helpers for the Audit Log admin view. Writes go through services/audit.py."""
from app.services.supabase_client import get_supabase


def list_filtered(
    category: str | None = None,
    severity: str | None = None,
    performer_uid: str | None = None,
    ip_address: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    sb = get_supabase()
    q = sb.table("audit_logs").select("*").order("occurred_at", desc=True)
    if category:
        q = q.eq("category", category)
    if severity:
        q = q.eq("severity", severity)
    if performer_uid:
        q = q.eq("performer_uid", performer_uid)
    if ip_address:
        q = q.eq("ip_address", ip_address)
    if date_from:
        q = q.gte("occurred_at", date_from)
    if date_to:
        q = q.lte("occurred_at", date_to)
    return q.range(offset, offset + limit - 1).execute().data
