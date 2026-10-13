"""api/v1/auth.py — thin wrapper; Firebase does the actual authentication."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user, _upsert_profile
from app.services import audit
from app.services.security_monitor import enforce_rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/bootstrap", dependencies=[Depends(enforce_rate_limit)])
async def bootstrap(request: Request, user: CurrentUser = Depends(get_current_user)):
    """
    Called once right after a successful Firebase sign-in. get_current_user
    already verified the token and upserted the profiles row — this just
    logs the sign-in event and hands back what the frontend needs to render
    the signed-in nav state.
    """
    await audit.log_event(
        category="auth", action="sign_in", ip_address=get_client_ip(request), performer_uid=user.uid,
    )
    return {"uid": user.uid, "email": user.email, "is_admin": user.is_admin}


class AgeConfirmBody(BaseModel):
    age_confirmed: bool
    privacy_accepted: bool


@router.post("/confirm-age")
async def confirm_age(body: AgeConfirmBody, user: CurrentUser = Depends(get_current_user)):
    """
    Records that the authenticated user has confirmed they are 18+ and have
    accepted the Privacy Policy. Timestamps are written to profiles.age_confirmed_at
    and profiles.privacy_accepted_at in Supabase. Best-effort — if the columns
    don't exist yet, the upsert will silently succeed without them.
    """
    if not body.age_confirmed or not body.privacy_accepted:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You must confirm you are 18+ and accept the Privacy Policy.")
    now_iso = datetime.now(timezone.utc).isoformat()
    _upsert_profile(user.uid, user.email, age_confirmed_at=now_iso, privacy_accepted_at=now_iso)
    return {"ok": True}

