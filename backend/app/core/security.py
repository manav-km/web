"""
core/security.py — every protected route depends on one of these.

Nothing else in the app is trusted to establish identity or admin status.
The verified Firebase UID from the token is the only thing that counts —
never a client-supplied field, header, or cookie value.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

from app.core.firebase import verify_id_token
from app.core.request_utils import get_client_ip
from app.services import audit
from app.services.supabase_client import get_supabase

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    uid: str
    email: str | None
    is_admin: bool
    email_verified: bool = False


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    try:
        decoded = verify_id_token(credentials.credentials)
    except (firebase_auth.InvalidIdTokenError, firebase_auth.ExpiredIdTokenError, firebase_auth.RevokedIdTokenError):
        await audit.log_security_event(
            action="invalid_token",
            category="authentication",
            ip_address=get_client_ip(request),
            reason="Rejected an invalid/expired/revoked Firebase ID token",
            severity="Low",
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    uid = decoded["uid"]
    email = decoded.get("email")
    is_admin = bool(decoded.get("admin", False))  # Firebase custom claim — the source of truth
    email_verified = bool(decoded.get("email_verified", False))

    _upsert_profile(uid, email)
    return CurrentUser(uid=uid, email=email, is_admin=is_admin, email_verified=email_verified)


async def require_admin(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if not user.is_admin:
        await audit.log_security_event(
            action="unauthorized_admin_access",
            category="authorization",
            ip_address=get_client_ip(request),
            performer_uid=user.uid,
            reason=f"Non-admin uid attempted {request.method} {request.url.path}",
            severity="Alert",
        )
        # Deliberately vague — never confirm/deny that the resource exists
        # or that admin-ness is the specific thing missing beyond a 403.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
    return user


def assert_owns_request(row_firebase_uid: str, user: CurrentUser) -> None:
    """Raise 403 unless the row belongs to this user (admins bypass ownership checks explicitly, per-route)."""
    if row_firebase_uid != user.uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")


def _upsert_profile(uid: str, email: str | None, age_confirmed_at: str | None = None, privacy_accepted_at: str | None = None) -> None:
    sb = get_supabase()
    data: dict = {"firebase_uid": uid, "email": email}
    if age_confirmed_at:
        data["age_confirmed_at"] = age_confirmed_at
    if privacy_accepted_at:
        data["privacy_accepted_at"] = privacy_accepted_at
    sb.table("profiles").upsert(data, on_conflict="firebase_uid").execute()
