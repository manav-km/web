"""api/v1/notifications.py"""
from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, get_current_user
from app.db import notifications as db
from app.models.chat import NotificationOut

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(unread_only: bool = False, user: CurrentUser = Depends(get_current_user)):
    return db.list_for_uid(user.uid, unread_only)


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, user: CurrentUser = Depends(get_current_user)):
    db.mark_read(notification_id, user.uid)
    return {"ok": True}
