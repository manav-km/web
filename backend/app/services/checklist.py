"""
services/checklist.py — bridges the AI checklist output (services/ai) and the
tasks table (db/tasks). This is where "AI suggests, admin decides" (§22) is
actually enforced: AI output only ever becomes `source='ai'` tasks; nothing
here ever sets a task to `completed` or writes a completion percentage —
that's still entirely db.tasks.completion(), computed from real task state.
"""
import logging

from app.db import tasks as tasks_db
from app.models.common import TaskCategory
from app.services.ai import service as ai_service

logger = logging.getLogger("checklist")

VALID_CATEGORIES = {c.value for c in TaskCategory}


def _sanitize(items) -> list[dict]:
    """AI output is untrusted generated content (§71.7) — never insert it as-is."""
    out = []
    for i, t in enumerate(items):
        out.append({
            "title": t.title.strip()[:200],
            "description": (t.description or None),
            "category": t.category if t.category in VALID_CATEGORIES else "other",
            "weight": max(1.0, min(10.0, float(t.weight or 5))),
            "sort_order": i,
            "_depends_on_titles": t.depends_on_titles,  # resolved to IDs after insert, then stripped
        })
    return out


async def generate_initial(owner_type: str, owner_id: str, category: str, description: str, budget: str, deadline: str) -> str:
    """Called right after a client request is created (§18). Returns 'completed' or 'failed' — never raises."""
    result = await ai_service.generate_checklist(category, description, budget, deadline)
    if not result or not result.tasks:
        return "failed"
    _insert_with_dependencies(owner_type, owner_id, result.tasks, source="ai")
    return "completed"


def _insert_with_dependencies(owner_type: str, owner_id: str, ai_tasks, source: str) -> list[dict]:
    items = _sanitize(ai_tasks)
    title_to_deps = {item["title"]: item.pop("_depends_on_titles") for item in items}
    inserted = tasks_db.bulk_create(owner_type, owner_id, items, source=source)

    title_to_id = {row["title"]: row["id"] for row in inserted}
    for row in inserted:
        dep_titles = title_to_deps.get(row["title"], [])
        dep_ids = [title_to_id[t] for t in dep_titles if t in title_to_id and title_to_id[t] != row["id"]]
        if dep_ids:
            tasks_db.update(row["id"], {"depends_on": dep_ids}, mark_manual=False)
    return inserted


async def regenerate_preview(owner_type: str, owner_id: str, category: str, description: str) -> dict:
    """
    §29 — preview only, writes nothing. Splits the CURRENT checklist into
    `to_keep` (completed or manually-overridden — never touched) and
    everything else (AI-sourced, untouched, not done — eligible to be
    flagged obsolete if the new AI pass doesn't suggest it again).
    """
    current = tasks_db.list_for_owner(owner_type, owner_id)
    protected = [t for t in current if t["status"] == "completed" or t["is_manual_override"]]
    replaceable = [t for t in current if t not in protected]

    result = await ai_service.regenerate_checklist([t["title"] for t in current], category, description)
    if not result:
        return {"to_add": [], "to_obsolete": [], "to_keep": protected, "summary": "AI checklist review is temporarily unavailable — nothing changed. Try again shortly, or add tasks manually."}

    new_titles = {t.title.strip() for t in result.tasks}
    to_obsolete = [t for t in replaceable if t["title"] not in new_titles]
    to_add = _sanitize(result.tasks)
    for item in to_add:
        item.pop("_depends_on_titles", None)  # titles shown to the admin as plain text in the preview; resolved again on apply

    summary = f"{len(to_add)} new task(s) suggested, {len(to_obsolete)} existing task(s) no longer appear relevant, {len(protected)} task(s) protected (completed or manually edited) and left untouched."
    return {"to_add": to_add, "to_obsolete": to_obsolete, "to_keep": protected, "summary": summary}


def apply_checklist_change(owner_type: str, owner_id: str, add: list, obsolete_task_ids: list[str], performer_uid: str) -> list[dict]:
    """What actually runs once the admin confirms a regenerate preview (§29 — never automatic). `add` is the admin-approved subset of a ChecklistPreview.to_add list, as ChecklistDiffItem models."""
    tasks_db.set_obsolete(obsolete_task_ids)
    if not add:
        return []
    existing_max = max((t["sort_order"] for t in tasks_db.list_for_owner(owner_type, owner_id)), default=-1)
    rows = [
        {"title": item.title, "description": item.description, "category": item.category, "weight": item.weight, "sort_order": existing_max + 1 + i}
        for i, item in enumerate(add)
    ]
    return tasks_db.bulk_create(owner_type, owner_id, rows, source="ai")
