"""models/chat.py — conversations, messages, drafts, notifications."""
from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_uid: str
    content: str
    created_at: datetime
    read_at: datetime | None = None


class DraftUpdate(BaseModel):
    content: str = Field(max_length=4000)


class NotificationOut(BaseModel):
    id: str
    type: str
    payload: dict
    is_read: bool
    created_at: datetime
