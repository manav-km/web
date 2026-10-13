"""api/v1/projects.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import projects as db
from app.models.content import ProjectIn, ProjectOut
from app.services import audit

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(category: str | None = None):
    return db.list_published(category)


@router.get("/admin", response_model=list[ProjectOut])
def list_projects_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.post("/admin", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectIn, request: Request, user: CurrentUser = Depends(require_admin)):
    created = db.create(payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="project_created", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"project_id": created["id"], "name": created["name"]},
    )
    return created


@router.put("/admin/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectIn, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(project_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    updated = db.update(project_id, payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="project_updated", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"project_id": project_id},
    )
    return updated


@router.delete("/admin/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(project_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    db.delete(project_id)
    await audit.log_event(
        category="content", action="project_deleted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"project_id": project_id}, severity="Alert",
    )
