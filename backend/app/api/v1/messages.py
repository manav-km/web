"""api/v1/messages.py — messages now live in Firebase RTDB (written via the Admin SDK), not Supabase (§21-22)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user
from app.db import notifications as notifications_db
from app.models.chat import DraftUpdate, MessageCreate, MessageOut
from app.services import audit, firebase_rtdb, realtime
from app.services.security_monitor import enforce_rate_limit

router = APIRouter(prefix="/api/v1/messages", tags=["messages"])


def _assert_participant(conversation_id: str, user: CurrentUser) -> None:
    if user.is_admin:
        return
    if not firebase_rtdb.is_participant(conversation_id, user.uid):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")


@router.get("/{conversation_id}", response_model=list[MessageOut])
def list_messages(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    _assert_participant(conversation_id, user)
    firebase_rtdb.mark_read(conversation_id, user.uid)
    return firebase_rtdb.list_messages(conversation_id)


@router.post("/{conversation_id}", response_model=MessageOut, dependencies=[Depends(enforce_rate_limit)])
async def send_message(
    conversation_id: str, payload: MessageCreate, request: Request, user: CurrentUser = Depends(get_current_user)
):
    _assert_participant(conversation_id, user)
    message = firebase_rtdb.send_message(conversation_id, user.uid, payload.content)

    convo = firebase_rtdb.get_conversation(conversation_id)
    recipient = convo["client_uid"] if user.is_admin else None
    if not user.is_admin:
        recipient = get_settings().admin_firebase_uid
    if recipient:
        notifications_db.create(recipient, "new_message", {"conversation_id": conversation_id})
        realtime.signal(recipient, "new_message", {"conversation_id": conversation_id})
        # Note: the message itself is ALSO instantly visible to a recipient whose
        # chat drawer is open and already listening to /messages/{conversation_id}
        # directly in RTDB — this notification+signal pair is what wakes up the
        # bell/badge for a recipient who doesn't have the drawer open right now.

    await audit.log_event(
        category="message", action="message_sent", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"conversation_id": conversation_id}, generate_ai_note=False,
    )
    return message


@router.put("/{conversation_id}/draft")
def save_draft(conversation_id: str, payload: DraftUpdate, user: CurrentUser = Depends(get_current_user)):
    """
    Kept for parity/admin use, but the primary path for drafts is now a
    direct client write to RTDB (see docs/architecture.md) — per-keystroke
    autosave through FastAPI would be needless round-trip latency for
    something this low-stakes. This endpoint exists so the admin side (and
    any fallback client code) can still read/write a draft through the
    backend if needed.
    """
    _assert_participant(conversation_id, user)
    firebase_rtdb.set_draft(conversation_id, user.uid, payload.content)
    return {"ok": True}


@router.get("/{conversation_id}/draft")
def get_draft(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    _assert_participant(conversation_id, user)
    return {"content": firebase_rtdb.get_draft(conversation_id, user.uid)}


@router.delete("/{conversation_id}/draft")
def delete_draft(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    _assert_participant(conversation_id, user)
    firebase_rtdb.delete_draft(conversation_id, user.uid)
    return {"ok": True}
