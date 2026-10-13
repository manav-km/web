"""db/notifications.py"""
from app.services.supabase_client import get_supabase


def list_for_uid(uid: str, unread_only: bool = False) -> list[dict]:
    sb = get_supabase()
    q = sb.table("notifications").select("*").eq("recipient_uid", uid).order("created_at", desc=True)
    if unread_only:
        q = q.eq("is_read", False)
    return q.execute().data


def create(recipient_uid: str, notif_type: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("notifications")
        .insert({"recipient_uid": recipient_uid, "type": notif_type, "payload": payload})
        .execute()
        .data[0]
    )


def mark_read(notification_id: str, uid: str) -> None:
    sb = get_supabase()
    sb.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("recipient_uid", uid).execute()
