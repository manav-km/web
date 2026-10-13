"""db/blog.py"""
from app.db._util import stamp_published
from app.services.supabase_client import get_supabase


def list_published(category: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = (
        sb.table("blog_posts")
        .select("id,slug,title,category,excerpt,cover_image_url,published_at,updated_at")
        .eq("status", "published")
        .order("published_at", desc=True)
    )
    if category and category != "all":
        q = q.eq("category", category)
    return q.execute().data


def get_by_slug_published(slug: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("blog_posts").select("*").eq("slug", slug).eq("status", "published").maybe_single().execute()
    return res.data if res else None


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("blog_posts").select("*").order("updated_at", desc=True).execute().data


def get(post_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("blog_posts").select("*").eq("id", post_id).maybe_single().execute()
    return res.data if res else None


def create(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("blog_posts").insert(stamp_published(payload)).execute().data[0]


def update(post_id: str, payload: dict) -> dict:
    sb = get_supabase()
    payload = stamp_published(payload, get(post_id))
    return sb.table("blog_posts").update(payload).eq("id", post_id).execute().data[0]


def delete(post_id: str) -> None:
    sb = get_supabase()
    sb.table("blog_posts").delete().eq("id", post_id).execute()
