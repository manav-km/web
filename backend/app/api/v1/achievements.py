"""api/v1/achievements.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import achievements as db
from app.models.content import AchievementIn, AchievementOut
from app.services import audit

router = APIRouter(prefix="/api/v1/achievements", tags=["achievements"])


@router.get("", response_model=list[AchievementOut])
def list_achievements(category: str | None = None):
    return db.list_published(category)


@router.get("/admin", response_model=list[AchievementOut])
def list_achievements_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.post("/admin", response_model=AchievementOut, status_code=status.HTTP_201_CREATED)
async def create_achievement(payload: AchievementIn, request: Request, user: CurrentUser = Depends(require_admin)):
    created = db.create(payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="achievement_created", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"achievement_id": created["id"]},
    )
    return created


@router.put("/admin/{achievement_id}", response_model=AchievementOut)
async def update_achievement(achievement_id: str, payload: AchievementIn, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(achievement_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Achievement not found")
    updated = db.update(achievement_id, payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="achievement_updated", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"achievement_id": achievement_id},
    )
    return updated


@router.delete("/admin/{achievement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_achievement(achievement_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(achievement_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Achievement not found")
    db.delete(achievement_id)
    await audit.log_event(
        category="content", action="achievement_deleted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"achievement_id": achievement_id}, severity="Alert",
    )
