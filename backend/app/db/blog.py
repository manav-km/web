"""db/blog.py"""
from app.db._cache import TTLCache
from app.db._util import stamp_published
from app.services.supabase_client import get_supabase

_cache = TTLCache(ttl_seconds=60.0)


def list_published(category: str | None = None) -> list[dict]:
    cache_key = f"blog_list_{category or 'all'}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    sb = get_supabase()
    q = (
        sb.table("blog_posts")
        .select("id,slug,title,category,excerpt,cover_image_url,published_at,updated_at")
        .eq("status", "published")
        .order("published_at", desc=True)
    )
    if category and category != "all":
        q = q.eq("category", category)
    data = q.execute().data
    _cache.set(cache_key, data)
    return data


def get_by_slug_published(slug: str) -> dict | None:
    cache_key = f"blog_slug_{slug}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    sb = get_supabase()
    res = sb.table("blog_posts").select("*").eq("slug", slug).eq("status", "published").maybe_single().execute()
    data = res.data if res else None
    if data:
        _cache.set(cache_key, data)
    return data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("blog_posts").select("*").order("updated_at", desc=True).execute().data


def get(post_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("blog_posts").select("*").eq("id", post_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    return sb.table("blog_posts").insert(stamp_published(payload)).execute().data[0]


def update(post_id: str, payload: dict) -> dict:
    _cache.invalidate()
    sb = get_supabase()
    payload = stamp_published(payload, get(post_id))
    return sb.table("blog_posts").update(payload).eq("id", post_id).execute().data[0]


def delete(post_id: str) -> None:
    _cache.invalidate()
    sb = get_supabase()
    sb.table("blog_posts").delete().eq("id", post_id).execute()
