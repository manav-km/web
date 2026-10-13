"""db/uploads.py"""
from app.services.supabase_client import get_supabase


def list_published(category: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("uploads").select("*").eq("status", "published").order("uploaded_on", desc=True)
    if category and category != "all":
        q = q.eq("category", category)
    return q.execute().data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("uploads").select("*").order("uploaded_on", desc=True).execute().data


def get(upload_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("uploads").select("*").eq("id", upload_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("uploads").insert(payload).execute().data[0]


def update(upload_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("uploads").update(payload).eq("id", upload_id).execute().data[0]


def delete(upload_id: str) -> None:
    sb = get_supabase()
    sb.table("uploads").delete().eq("id", upload_id).execute()
