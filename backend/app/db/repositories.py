"""db/repositories.py"""
from app.services.supabase_client import get_supabase


def list_visible() -> list[dict]:
    sb = get_supabase()
    return sb.table("repositories").select("*").eq("is_visible", True).order("stars", desc=True).execute().data


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("repositories").select("*").order("source").order("repo_name").execute().data


def set_visibility(repo_id: str, is_visible: bool) -> dict:
    sb = get_supabase()
    return sb.table("repositories").update({"is_visible": is_visible}).eq("id", repo_id).execute().data[0]
