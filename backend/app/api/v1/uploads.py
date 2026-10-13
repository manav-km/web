"""api/v1/uploads.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import uploads as db
from app.models.content import UploadIn, UploadOut
from app.services import audit

router = APIRouter(prefix="/api/v1/uploads", tags=["uploads"])


@router.get("", response_model=list[UploadOut])
def list_uploads(category: str | None = None):
    return db.list_published(category)


@router.get("/admin", response_model=list[UploadOut])
def list_uploads_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.post("/admin", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def create_upload(payload: UploadIn, request: Request, user: CurrentUser = Depends(require_admin)):
    created = db.create(payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="upload_created", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"upload_id": created["id"]},
    )
    return created


@router.put("/admin/{upload_id}", response_model=UploadOut)
async def update_upload(upload_id: str, payload: UploadIn, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(upload_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    updated = db.update(upload_id, payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="upload_updated", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"upload_id": upload_id},
    )
    return updated


@router.delete("/admin/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(upload_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(upload_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    db.delete(upload_id)
    await audit.log_event(
        category="content", action="upload_deleted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"upload_id": upload_id}, severity="Alert",
    )
