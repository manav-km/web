"""db/projects.py — typed query helpers. Routers call these, never the raw client."""
from app.db._cache import TTLCache
from app.db._util import stamp_published
from app.services.supabase_client import get_supabase

_cache = TTLCache(ttl_seconds=60.0)


def list_published(category: str | None = None) -> list[dict]:
    cache_key = f"pub_{category or 'all'}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    sb = get_supabase()
    q = sb.table("projects").select("*").eq("status", "published").order("sort_order")
    if category and category != "all":
        q = q.eq("category", category)
    data = q.execute().data
    _cache.set(cache_key, data)
    return data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("projects").select("*").order("sort_order").execute().data


def get(project_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("projects").select("*").eq("id", project_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    return sb.table("projects").insert(stamp_published(payload)).execute().data[0]


def update(project_id: str, payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    payload = stamp_published(payload, get(project_id))
    return sb.table("projects").update(payload).eq("id", project_id).execute().data[0]


def delete(project_id: str) -> None:
    _cache.invalidate()
    sb = get_supabase()
    sb.table("projects").delete().eq("id", project_id).execute()
