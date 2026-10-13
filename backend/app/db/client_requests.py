"""db/client_requests.py"""
from app.services.supabase_client import get_supabase


def create(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("client_requests").insert(payload).execute().data[0]


def get(request_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("client_requests").select("*").eq("id", request_id).maybe_single().execute()
    return res.data if res else None


def get_for_uid(request_id: str, firebase_uid: str) -> dict | None:
    sb = get_supabase()
    res = (
        sb.table("client_requests")
        .select("*")
        .eq("id", request_id)
        .eq("firebase_uid", firebase_uid)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def list_for_uid(firebase_uid: str) -> list[dict]:
    sb = get_supabase()
    return sb.table("client_requests").select("*").eq("firebase_uid", firebase_uid).execute().data


def list_all_admin(status: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("client_requests").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.execute().data


def update_ai_overview(request_id: str, ai_overview: dict | None, ai_status: str) -> dict:
    sb = get_supabase()
    return (
        sb.table("client_requests")
        .update({"ai_overview": ai_overview, "ai_status": ai_status})
        .eq("id", request_id)
        .execute()
        .data[0]
    )


def update_checklist_status(request_id: str, checklist_status: str) -> None:
    sb = get_supabase()
    sb.table("client_requests").update({"checklist_status": checklist_status}).eq("id", request_id).execute()


def set_rtdb_conversation(request_id: str, conversation_id: str) -> None:
    sb = get_supabase()
    sb.table("client_requests").update({"rtdb_conversation_id": conversation_id}).eq("id", request_id).execute()


def change_status(request_id: str, new_status: str, changed_by: str, note: str | None) -> dict:
    sb = get_supabase()
    current = get(request_id)
    old_status = current["status"] if current else None

    updated = sb.table("client_requests").update({"status": new_status}).eq("id", request_id).execute().data[0]
    sb.table("request_status_history").insert(
        {
            "request_id": request_id,
            "old_status": old_status,
            "new_status": new_status,
            "changed_by": changed_by,
            "note": note,
        }
    ).execute()
    return updated
