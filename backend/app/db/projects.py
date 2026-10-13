"""db/projects.py — typed query helpers. Routers call these, never the raw client."""
from app.db._util import stamp_published
from app.services.supabase_client import get_supabase


def list_published(category: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("projects").select("*").eq("status", "published").order("sort_order")
    if category and category != "all":
        q = q.eq("category", category)
    return q.execute().data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("projects").select("*").order("sort_order").execute().data


def get(project_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("projects").select("*").eq("id", project_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("projects").insert(stamp_published(payload)).execute().data[0]


def update(project_id: str, payload: dict) -> dict:
    sb = get_supabase()
    payload = stamp_published(payload, get(project_id))
    return sb.table("projects").update(payload).eq("id", project_id).execute().data[0]


def delete(project_id: str) -> None:
    sb = get_supabase()
    sb.table("projects").delete().eq("id", project_id).execute()
