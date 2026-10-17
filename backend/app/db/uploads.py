"""db/uploads.py"""
from app.db._cache import TTLCache
from app.services.supabase_client import get_supabase

_cache = TTLCache(ttl_seconds=60.0)


def list_published(category: str | None = None) -> list[dict]:
    cache_key = f"up_{category or 'all'}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    sb = get_supabase()
    q = sb.table("uploads").select("*").eq("status", "published").order("uploaded_on", desc=True)
    if category and category != "all":
        q = q.eq("category", category)
    data = q.execute().data
    _cache.set(cache_key, data)
    return data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("uploads").select("*").order("uploaded_on", desc=True).execute().data


def get(upload_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("uploads").select("*").eq("id", upload_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    return sb.table("uploads").insert(payload).execute().data[0]


def update(upload_id: str, payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    return sb.table("uploads").update(payload).eq("id", upload_id).execute().data[0]


def delete(upload_id: str) -> None:
    _cache.invalidate()
    sb = get_supabase()
    sb.table("uploads").delete().eq("id", upload_id).execute()
