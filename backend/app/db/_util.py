"""db/_util.py — small shared helpers for the content query modules."""
from datetime import datetime, timezone


def stamp_published(payload: dict, existing: dict | None = None) -> dict:
    """
    Manage `published_at`: keep an explicitly supplied value, otherwise stamp
    "now" the first time an item becomes published, and never wipe an existing
    value just because a PUT omitted it.
    """
    payload = dict(payload)
    if payload.get("published_at") is None:
        payload.pop("published_at", None)
        already = existing.get("published_at") if existing else None
        if payload.get("status") == "published" and not already:
            payload["published_at"] = datetime.now(timezone.utc).isoformat()
    return payload
