"""
db/tasks.py — CRUD for the checklist, plus the completion % calculation.

§21: completion is calculated from task state, never asserted by the AI.
AI only ever creates/suggests tasks; this module is where "done" actually
turns into a percentage.
"""
from app.services.supabase_client import get_supabase


def list_for_owner(owner_type: str, owner_id: str) -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("tasks")
        .select("*")
        .eq("owner_type", owner_type)
        .eq("owner_id", owner_id)
        .order("sort_order")
        .execute()
        .data
    )


def get(task_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("tasks").select("*").eq("id", task_id).maybe_single().execute()
    return res.data if res else None


def create(owner_type: str, owner_id: str, payload: dict, source: str) -> dict:
    sb = get_supabase()
    row = {**payload, "owner_type": owner_type, "owner_id": owner_id, "source": source}
    return sb.table("tasks").insert(row).execute().data[0]


def bulk_create(owner_type: str, owner_id: str, items: list[dict], source: str) -> list[dict]:
    if not items:
        return []
    sb = get_supabase()
    rows = [{**item, "owner_type": owner_type, "owner_id": owner_id, "source": source} for item in items]
    return sb.table("tasks").insert(rows).execute().data


def update(task_id: str, payload: dict, mark_manual: bool = True) -> dict:
    sb = get_supabase()
    body = dict(payload)
    if mark_manual:
        body["is_manual_override"] = True
    return sb.table("tasks").update(body).eq("id", task_id).execute().data[0]


def set_obsolete(task_ids: list[str]) -> None:
    """§29 — obsolete AI tasks are flagged SKIPPED, never deleted, so history survives."""
    if not task_ids:
        return
    sb = get_supabase()
    sb.table("tasks").update({"status": "skipped"}).in_("id", task_ids).execute()


def reparent(owner_type: str, owner_id: str, new_owner_type: str, new_owner_id: str) -> None:
    """§23 — moves a checklist from one owner to another (request -> project on conversion). Never duplicates."""
    sb = get_supabase()
    sb.table("tasks").update({"owner_type": new_owner_type, "owner_id": new_owner_id}).eq("owner_type", owner_type).eq("owner_id", owner_id).execute()


def delete(task_id: str) -> None:
    sb = get_supabase()
    sb.table("tasks").delete().eq("id", task_id).execute()


def completion(owner_type: str, owner_id: str) -> dict:
    """
    §21: completion % = (sum of completed task weights) / (sum of ACTIVE task
    weights) × 100. "Active" excludes skipped tasks (obsoleted checklist items
    shouldn't drag a project's percentage down) but includes blocked ones
    (blocked work is still owed, just stuck) — see docs/architecture.md.
    """
    tasks = list_for_owner(owner_type, owner_id)
    active = [t for t in tasks if t["status"] != "skipped"]
    total_weight = sum(t["weight"] for t in active) or 1  # avoid /0 on an empty checklist
    completed_weight = sum(t["weight"] for t in active if t["status"] == "completed")
    return {
        "completion_percent": round(completed_weight / total_weight * 100, 1) if active else 0.0,
        "total_weight": total_weight if active else 0,
        "completed_weight": completed_weight,
        "task_count": len(active),
        "completed_count": sum(1 for t in active if t["status"] == "completed"),
        "blocked_count": sum(1 for t in active if t["status"] == "blocked"),
    }


def stage_label(owner_type: str, owner_id: str, dev_status: str | None = None) -> str:
    """
    Client-safe "Current Stage" text (§34) — derived from real state, never
    an admin-only status label leaking through (e.g. never "Blocked: client
    hasn't sent the logo yet" — that internal reason stays admin-only).
    """
    tasks = [t for t in list_for_owner(owner_type, owner_id) if t["status"] != "skipped"]
    if not tasks:
        return "Planning"
    if all(t["status"] == "completed" for t in tasks):
        return "Complete"
    in_progress = [t for t in tasks if t["status"] == "in_progress"]
    if in_progress:
        return f"Development — {in_progress[0]['title']}"
    todo = [t for t in tasks if t["status"] == "todo"]
    return f"Up next — {todo[0]['title']}" if todo else (dev_status or "In progress").replace("_", " ").title()
