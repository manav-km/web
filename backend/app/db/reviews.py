"""db/reviews.py"""
from app.services.supabase_client import get_supabase


def create(request_id: str, client_uid: str, payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("reviews").insert({**payload, "request_id": request_id, "client_uid": client_uid}).execute().data[0]


def get_for_request(request_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("reviews").select("*").eq("request_id", request_id).maybe_single().execute()
    return res.data if res else None


def list_all_admin() -> list[dict]:
    sb = get_supabase()
    return sb.table("reviews").select("*").order("created_at", desc=True).execute().data


def averages() -> dict:
    sb = get_supabase()
    rows = sb.table("reviews").select("*").execute().data
    if not rows:
        return {"count": 0}
    fields = [
        "overall_rating", "professionalism_rating", "satisfaction_rating",
        "expectations_rating", "usability_rating", "pricing_rating", "sufficiency_rating",
    ]
    return {
        "count": len(rows),
        **{f: round(sum(r[f] for r in rows) / len(rows), 2) for f in fields},
    }
