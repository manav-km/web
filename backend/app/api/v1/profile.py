"""api/v1/profile.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user
from app.services import audit
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


import json

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    country: str | None = None
    profession: str | None = None
    business: str | None = None
    avatar_url: str | None = None
    # All form fields
    address: str | None = None
    business_org: str | None = None
    business_address: str | None = None
    business_email: str | None = None
    business_phone: str | None = None
    business_type: str | None = None
    business_designation: str | None = None
    dob: str | None = None
    age_confirmed: bool | None = None
    privacy_accepted: bool | None = None


@router.get("")
def get_my_profile(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("firebase_uid", user.uid).maybe_single().execute()
    data = res.data if res and res.data else {
        "firebase_uid": user.uid,
        "email": user.email,
        "is_admin": user.is_admin,
        "full_name": None,
        "phone": None,
        "country": None,
        "profession": None,
        "business": None,
        "avatar_url": None,
    }

    # If business stores packed extra attributes, unpack them
    raw_biz = data.get("business")
    if raw_biz and isinstance(raw_biz, str) and raw_biz.strip().startswith("{"):
        try:
            extra = json.loads(raw_biz)
            if isinstance(extra, dict):
                for k, v in extra.items():
                    data.setdefault(k, v)
                data["business"] = extra.get("business_org") or extra.get("business_raw") or raw_biz
        except Exception:
            pass

    return data


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
    signed_url = (signed.get("signed_url") or signed.get("signedURL") or signed.get("url")) if isinstance(signed, dict) else str(signed)
    return {"signed_url": signed_url, "path": path, "public_url": public_url}


@router.put("")
async def update_my_profile(payload: ProfileUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    
    # Retrieve existing extra attributes if present
    existing_res = sb.table("profiles").select("*").eq("firebase_uid", user.uid).maybe_single().execute()
    existing = existing_res.data if existing_res and existing_res.data else {}
    existing_extra = {}
    if existing and existing.get("business") and isinstance(existing["business"], str) and existing["business"].strip().startswith("{"):
        try:
            existing_extra = json.loads(existing["business"])
        except Exception:
            pass

    extra_data = dict(existing_extra)
    if payload.address is not None:
        extra_data["address"] = payload.address
    if payload.business_org is not None:
        extra_data["business_org"] = payload.business_org
    if payload.business_address is not None:
        extra_data["business_address"] = payload.business_address
    if payload.business_email is not None:
        extra_data["business_email"] = payload.business_email
    if payload.business_phone is not None:
        extra_data["business_phone"] = payload.business_phone
    if payload.business_type is not None:
        extra_data["business_type"] = payload.business_type
    if payload.business_designation is not None:
        extra_data["business_designation"] = payload.business_designation

    # Allow updating DOB
    if payload.dob is not None:
        extra_data["dob"] = payload.dob

    if payload.age_confirmed is not None:
        extra_data["age_confirmed"] = payload.age_confirmed
    if payload.privacy_accepted is not None:
        extra_data["privacy_accepted"] = payload.privacy_accepted

    updates = {
        "firebase_uid": user.uid,
    }
    if payload.email is not None:
        updates["email"] = payload.email
    elif user.email:
        updates["email"] = user.email
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.phone is not None:
        updates["phone"] = payload.phone
    if payload.country is not None:
        updates["country"] = payload.country
    elif payload.address is not None:
        updates["country"] = payload.address

    if payload.profession is not None:
        updates["profession"] = payload.profession
    elif payload.business_designation is not None:
        updates["profession"] = payload.business_designation

    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url

    if extra_data:
        extra_data["business_raw"] = payload.business or extra_data.get("business_org") or ""
        updates["business"] = json.dumps(extra_data)
    elif payload.business is not None:
        updates["business"] = payload.business

    res = sb.table("profiles").upsert(updates, on_conflict="firebase_uid").execute()
    updated = res.data[0] if (res and res.data) else updates

    result = dict(updated)
    for k, v in extra_data.items():
        result[k] = v
    if extra_data.get("business_org"):
        result["business"] = extra_data["business_org"]

    await audit.log_event(
        category="content", action="profile_updated", ip_address=get_client_ip(request), performer_uid=user.uid,
    )
    return result


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

