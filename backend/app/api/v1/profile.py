"""api/v1/profile.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user
from app.services import audit
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    country: str | None = None
    profession: str | None = None
    business: str | None = None
    avatar_url: str | None = None


@router.get("")
def get_my_profile(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    return sb.table("profiles").select("*").eq("firebase_uid", user.uid).single().execute().data


class AvatarUploadRequest(BaseModel):
    content_type: str
    size: int


@router.post("/avatar-upload-url")
async def avatar_upload_url(payload: AvatarUploadRequest, user: CurrentUser = Depends(get_current_user)):
    """Self-service version of the admin media-upload pattern — same validation, scoped to the caller's own avatar."""
    import uuid

    allowed = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
    ext = allowed.get(payload.content_type)
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only PNG, JPEG or WebP images are allowed")
    if not 0 < payload.size <= 2_000_000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be 2 MB or smaller")

    path = f"{user.uid}/{uuid.uuid4().hex}.{ext}"
    sb = get_supabase()
    signed = sb.storage.from_("profile-pictures").create_signed_upload_url(path)
    public_url = sb.storage.from_("profile-pictures").get_public_url(path)
    return {"signed_url": signed["signed_url"], "path": path, "public_url": public_url}


@router.put("")
async def update_my_profile(payload: ProfileUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = sb.table("profiles").update(updates).eq("firebase_uid", user.uid).execute().data[0]
    await audit.log_event(
        category="content", action="profile_updated", ip_address=get_client_ip(request), performer_uid=user.uid,
    )
    return updated


@router.get("/export")
async def export_my_data(request: Request, user: CurrentUser = Depends(get_current_user)):
    """GDPR-style data export — returns everything we hold about this user."""
    sb = get_supabase()
    profile = sb.table("profiles").select("*").eq("firebase_uid", user.uid).maybe_single().execute()
    requests = sb.table("client_requests").select("*").eq("firebase_uid", user.uid).execute().data
    reviews = sb.table("reviews").select("*").eq("client_uid", user.uid).execute().data
    await audit.log_event(
        category="privacy", action="data_export", ip_address=get_client_ip(request),
        performer_uid=user.uid, generate_ai_note=False,
    )
    return {"profile": profile.data if profile else None, "requests": requests, "reviews": reviews}


@router.delete("/account")
async def delete_my_account(request: Request, user: CurrentUser = Depends(get_current_user)):
    """Account deletion: wipes the user's personal data."""
    sb = get_supabase()
    await audit.log_event(
        category="privacy", action="account_deletion_requested", ip_address=get_client_ip(request),
        performer_uid=user.uid, generate_ai_note=False,
    )
    sb.table("profiles").update({
        "email": None, "full_name": None, "phone": None, "country": None,
        "profession": None, "business": None, "avatar_url": None,
    }).eq("firebase_uid", user.uid).execute()
    return {"ok": True, "message": "Your personal data has been removed."}

