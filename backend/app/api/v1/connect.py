"""api/v1/connect.py — the Connect form submission (§17-20 of the original spec)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user
from app.db import client_requests as requests_db
from app.db import notifications as notifications_db
from app.models.client import ClientRequestCreate, ClientRequestOut
from app.services import audit, checklist, firebase_rtdb, realtime, turnstile
from app.services.ai import service as ai_service
from app.services.security_monitor import enforce_rate_limit

router = APIRouter(prefix="/api/v1/connect", tags=["connect"])


@router.get("/mine", response_model=list[ClientRequestOut])
def my_requests(user: CurrentUser = Depends(get_current_user)):
    return requests_db.list_for_uid(user.uid)


@router.post("", response_model=ClientRequestOut, dependencies=[Depends(enforce_rate_limit)])
async def submit_request(
    payload: ClientRequestCreate,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    settings = get_settings()
    ip = get_client_ip(request)

    if not user.email_verified:
        await audit.log_event(
            category="client", action="request_blocked_unverified_email", ip_address=ip,
            performer_uid=user.uid, severity="Low", generate_ai_note=False,
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email before submitting a request — check your inbox for the verification link.")

    if not await turnstile.verify(payload.turnstile_token, ip):
        await audit.log_event(
            category="security", action="turnstile_failed", ip_address=ip,
            performer_uid=user.uid, severity="Alert", generate_ai_note=False,
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, "We couldn't verify you're not a bot. Please reload the page and try again.")

    if not payload.age_confirmed or not payload.privacy_accepted:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You must confirm you are 18+ and accept the Privacy Policy before submitting a request.")

    # 1. Save the ORIGINAL submission first and unconditionally — this row
    #    must exist even if every downstream step (AI, conversation,
    #    notification) fails (§19, §71.5).
    _EXCLUDE = {"turnstile_token", "age_confirmed", "privacy_accepted"}
    db_payload = {k: v for k, v in payload.model_dump(mode="json").items() if k not in _EXCLUDE}
    created = requests_db.create({**db_payload, "firebase_uid": user.uid})

    await audit.log_event(
        category="client", action="request_submitted", ip_address=ip, performer_uid=user.uid,
        metadata={"request_id": created["id"], "category": payload.category},
    )

    # 2. AI overview — best-effort, never blocks the response (§20, §71.5).
    overview = await ai_service.client_request_overview(
        category=payload.category, deadline=str(payload.deadline),
        budget=payload.budget, description=payload.project_description,
    )
    ai_status = "completed" if overview else "failed"
    requests_db.update_ai_overview(created["id"], overview.model_dump() if overview else None, ai_status)

    # 3. AI implementation checklist — also best-effort (§18, §30). The
    #    request is never lost if OpenRouter is unavailable; the admin can
    #    add tasks manually or retry later either way.
    checklist_status = await checklist.generate_initial(
        "request", created["id"], payload.category, payload.project_description, payload.budget, str(payload.deadline),
    )
    requests_db.update_checklist_status(created["id"], checklist_status)

    # 4. Conversation — now created in Firebase RTDB, not Supabase (§4), so
    #    the messenger gets instant delivery the moment it becomes available.
    conversation_id = firebase_rtdb.create_conversation(user.uid, settings.admin_firebase_uid, created["id"])
    requests_db.set_rtdb_conversation(created["id"], conversation_id)

    # 5. Notify the admin — new request needing attention.
    if settings.admin_firebase_uid:
        notifications_db.create(
            settings.admin_firebase_uid, "client_request_submitted",
            {"request_id": created["id"], "full_name": payload.full_name},
        )
        realtime.signal(settings.admin_firebase_uid, "client_request_submitted", {"request_id": created["id"]})

    final = requests_db.get(created["id"])
    return final
