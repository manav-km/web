"""api/v1/conversations.py — conversation metadata now reads from Firebase RTDB, not Supabase."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import CurrentUser, get_current_user
from app.services import firebase_rtdb

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])


@router.get("")
def my_conversations(user: CurrentUser = Depends(get_current_user)):
    return firebase_rtdb.list_conversations_for_uid(user.uid)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    if not firebase_rtdb.is_participant(conversation_id, user.uid) and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
    convo = firebase_rtdb.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return {"id": conversation_id, **convo}
