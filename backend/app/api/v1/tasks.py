"""
api/v1/tasks.py — the checklist/completion system (§17-35 of the RTDB
architecture doc). Admin routes manage the checklist; the one client-facing
route returns only the safe subset (§34).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user, require_admin
from app.db import client_requests as requests_db
from app.db import tasks as tasks_db
from app.models.common import TaskOwnerType
from app.models.tasks import ChecklistApply, ChecklistPreview, CompletionOut, TaskIn, TaskOut
from app.services import audit, checklist

router = APIRouter(tags=["tasks"])


def _assert_valid_owner(owner_type: str) -> None:
    if owner_type not in (TaskOwnerType.request.value, TaskOwnerType.project.value):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "owner_type must be 'request' or 'project'")


# ---------------------------------------------------------------- admin: checklist CRUD
@router.get("/api/v1/admin/{owner_type}/{owner_id}/tasks", response_model=list[TaskOut])
def list_tasks(owner_type: str, owner_id: str, _: CurrentUser = Depends(require_admin)):
    _assert_valid_owner(owner_type)
    return tasks_db.list_for_owner(owner_type, owner_id)


@router.get("/api/v1/admin/{owner_type}/{owner_id}/completion", response_model=CompletionOut)
def get_completion(owner_type: str, owner_id: str, _: CurrentUser = Depends(require_admin)):
    _assert_valid_owner(owner_type)
    return tasks_db.completion(owner_type, owner_id)


@router.post("/api/v1/admin/{owner_type}/{owner_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(owner_type: str, owner_id: str, payload: TaskIn, request: Request, user: CurrentUser = Depends(require_admin)):
    _assert_valid_owner(owner_type)
    created = tasks_db.create(owner_type, owner_id, payload.model_dump(mode="json"), source="admin")
    await audit.log_event(
        category="content", action="task_created", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"owner_type": owner_type, "owner_id": owner_id, "task_id": created["id"], "title": created["title"]},
        generate_ai_note=False,
    )
    return created


@router.put("/api/v1/admin/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskIn, request: Request, user: CurrentUser = Depends(require_admin)):
    existing = tasks_db.get(task_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    updated = tasks_db.update(task_id, payload.model_dump(mode="json"))
    changed_status = existing["status"] != payload.status.value
    await audit.log_event(
        category="content", action="task_status_changed" if changed_status else "task_edited",
        ip_address=get_client_ip(request), performer_uid=user.uid,
        metadata={"task_id": task_id, "title": payload.title, "from": existing["status"], "to": payload.status.value} if changed_status
                  else {"task_id": task_id, "title": payload.title},
        generate_ai_note=False,
    )
    return updated


@router.delete("/api/v1/admin/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    if not tasks_db.get(task_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    tasks_db.delete(task_id)
    await audit.log_event(
        category="content", action="task_deleted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"task_id": task_id}, generate_ai_note=False,
    )


# ---------------------------------------------------------------- admin: AI regenerate (preview -> confirm -> apply)
@router.post("/api/v1/admin/{owner_type}/{owner_id}/checklist/regenerate-preview", response_model=ChecklistPreview)
async def regenerate_preview(owner_type: str, owner_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    """§29 — writes nothing. Returns what WOULD change so the admin can review before anything is touched."""
    _assert_valid_owner(owner_type)
    description, category = _owner_description(owner_type, owner_id)
    result = await checklist.regenerate_preview(owner_type, owner_id, category, description)
    await audit.log_event(
        category="content", action="checklist_regeneration_previewed", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"owner_type": owner_type, "owner_id": owner_id, "to_add": len(result["to_add"]), "to_obsolete": len(result["to_obsolete"])},
        generate_ai_note=False,
    )
    return result


@router.post("/api/v1/admin/{owner_type}/{owner_id}/checklist/regenerate-apply", response_model=list[TaskOut])
async def regenerate_apply(owner_type: str, owner_id: str, payload: ChecklistApply, request: Request, user: CurrentUser = Depends(require_admin)):
    """§29 — only runs once the admin has reviewed a preview and explicitly confirmed what to apply."""
    _assert_valid_owner(owner_type)
    added = checklist.apply_checklist_change(owner_type, owner_id, payload.add, payload.obsolete_task_ids, user.uid)
    await audit.log_event(
        category="content", action="checklist_regenerated", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"owner_type": owner_type, "owner_id": owner_id, "added": len(added), "obsoleted": len(payload.obsolete_task_ids)},
        generate_ai_note=False,
    )
    return added


def _owner_description(owner_type: str, owner_id: str) -> tuple[str, str]:
    if owner_type == TaskOwnerType.request.value:
        req = requests_db.get(owner_id)
        if not req:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
        return req["project_description"], req["category"]
    from app.db import projects as projects_db

    proj = projects_db.get(owner_id)
    if not proj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return proj["description"], proj["category"]


# ---------------------------------------------------------------- client: safe progress view (§34)
@router.get("/api/v1/requests/{request_id}/progress")
def client_progress(request_id: str, user: CurrentUser = Depends(get_current_user)):
    req = requests_db.get_for_uid(request_id, user.uid)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    completion = tasks_db.completion("request", request_id)
    stage = tasks_db.stage_label("request", request_id)
    # Deliberately NOT returning: task titles/descriptions, blocked_reason, internal notes,
    # who did what, AI prompts — only the three fields the spec says a client may see (§34).
    return {
        "completion_percent": completion["completion_percent"],
        "current_stage": stage,
        "next": "Testing & Final Review" if "Complete" not in stage else "Delivered",
    }
