"""db/repositories.py"""
from app.db._cache import TTLCache
from app.services.supabase_client import get_supabase

_cache = TTLCache(ttl_seconds=60.0)


def invalidate_cache() -> None:
    _cache.invalidate()


def _sanitize(rows: list[dict]) -> list[dict]:
    for r in rows:
        if r.get("languages") is None:
            r["languages"] = []
    return rows


def list_visible() -> list[dict]:
    cached = _cache.get("visible")
    if cached is not None:
        return cached

    sb = get_supabase()
    data = sb.table("repositories").select("*").eq("is_visible", True).neq("source", "trd-dnmx").order("stars", desc=True).execute().data
    sanitized = _sanitize(data)
    _cache.set("visible", sanitized)
    return sanitized


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    data = sb.table("repositories").select("*").neq("source", "trd-dnmx").order("source").order("repo_name").execute().data
    return _sanitize(data)


def set_visibility(repo_id: str, is_visible: bool) -> dict:
    invalidate_cache()
    sb = get_supabase()
    return sb.table("repositories").update({"is_visible": is_visible}).eq("id", repo_id).execute().data[0]
