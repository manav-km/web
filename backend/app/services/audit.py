"""
services/audit.py — every important event goes through log_event() or
log_security_event(). The raw event is written FIRST and is authoritative;
the AI note is a best-effort addition that never blocks or overwrites it.
"""
import logging
from datetime import datetime, timezone
from typing import Literal

from app.services.ai import service as ai_service
from app.services.supabase_client import get_supabase

Severity = Literal["Low", "Alert", "Critical"]
logger = logging.getLogger("audit")


async def log_event(
    *,
    category: str,
    action: str,
    ip_address: str,
    performer_uid: str | None = None,
    performer_name: str | None = None,
    severity: Severity = "Low",
    metadata: dict | None = None,
    generate_ai_note: bool = True,
) -> dict:
    sb = get_supabase()
    metadata = metadata or {}

    note = None
    if generate_ai_note:
        note = await ai_service.audit_log_note(category, action, performer_uid, metadata)
        # None here just means AI note generation failed — the event below
        # is written regardless, per §71.5. `note` stays null; an admin can
        # add one manually later.

    row = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "category": category,
        "action": action,
        "performer_uid": performer_uid,
        "performer_name": performer_name,
        "ip_address": ip_address,
        "note": note,
        "severity": severity,
        "metadata": metadata,
    }
    try:
        result = sb.table("audit_logs").insert(row).execute()
        return result.data[0]
    except Exception:  # noqa: BLE001
        # A logging failure must never turn a correct 401/403 (or a completed action) into a 500.
        # The event is preserved in the server logs instead.
        logger.exception("Failed to persist audit event: %s", row)
        return {"id": None, **row}


async def edit_note(original_event_id: str, new_note: str, edited_by: str) -> dict:
    """
    §37: editing a note never mutates history. Fetch the original, insert a
    NEW audit_logs row with the edited note, and point the original at it
    via `superseded_by` — old row stays exactly as it was.
    """
    sb = get_supabase()
    original = sb.table("audit_logs").select("*").eq("id", original_event_id).single().execute().data

    new_row = {**original, "note": new_note, "occurred_at": datetime.now(timezone.utc).isoformat()}
    new_row.pop("id", None)
    new_row.pop("superseded_by", None)
    new_row["metadata"] = {**(original.get("metadata") or {}), "edited_by": edited_by, "original_event_id": original_event_id}

    inserted = sb.table("audit_logs").insert(new_row).execute().data[0]
    sb.table("audit_logs").update({"superseded_by": inserted["id"]}).eq("id", original_event_id).execute()
    return inserted


async def log_security_event(
    *,
    action: str,
    category: str,
    ip_address: str,
    performer_uid: str | None = None,
    source: str | None = None,
    reason: str | None = None,
    severity: Severity = "Low",
    metadata: dict | None = None,
) -> dict:
    """
    Writes to security_events AND mirrors into audit_logs (§38 — a security
    event may intentionally appear in both).
    """
    sb = get_supabase()
    metadata = metadata or {}

    audit_row = await log_event(
        category="security",
        action=action,
        ip_address=ip_address,
        performer_uid=performer_uid,
        severity=severity,
        metadata={**metadata, "reason": reason, "source": source},
    )

    row = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "category": category,
        "ip_address": ip_address,
        "performer_uid": performer_uid,
        "source": source,
        "reason": reason,
        "severity": severity,
        "related_audit_log": audit_row.get("id"),
        "metadata": metadata,
    }
    try:
        result = sb.table("security_events").insert(row).execute()
        return result.data[0]
    except Exception:  # noqa: BLE001
        logger.exception("Failed to persist security event: %s", row)
        return row
