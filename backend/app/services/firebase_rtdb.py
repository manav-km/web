"""
services/firebase_rtdb.py — conversations and messages now live in Firebase
Realtime Database, not Supabase (architecture change: RTDB now owns all
"live communication" data; Supabase stays the structured/permanent store —
see docs/architecture.md §13c).

WRITE PATH: every message/conversation write in this file goes through
FastAPI first — the client never writes directly to /conversations or
/messages. This is deliberate, not an oversight: "the frontend must NOT be
trusted simply because it can communicate with Firebase" means validation,
rate limiting, ownership checks, and audit logging all still have to happen
somewhere, and FastAPI is that somewhere. The Admin SDK write bypasses the
RTDB rules the same way the Supabase service-role key bypasses Postgres
RLS — see firebase/database.rules.json, whose `.write: false` on these
paths is what actually enforces "clients never write directly" at the data
layer, not just at the app layer.

READ PATH: the client reads /conversations/{id} and /messages/{id} directly
via the Firebase JS SDK for instant delivery — that's the whole point of
using RTDB here. The rules restrict reads to conversation participants.

Ephemeral state (typing, presence) and drafts are the one part of this file
that ISN'T mirrored by a client-side write path — those ARE written directly
by the client (see docs/architecture.md), because they're low-stakes,
per-keystroke/per-connection, and would make chat feel laggy if they had to
round-trip through FastAPI. This module still exposes helpers for them
(used by the admin side, and by anything server-side that needs to read
current typing/presence state) but the primary writer for those three is
the browser.
"""
import logging
import time
import uuid

from firebase_admin import db as rtdb

from app.core.firebase import init_firebase

logger = logging.getLogger("firebase_rtdb")


def _ref(path: str):
    init_firebase()
    return rtdb.reference(path)


# ---------------------------------------------------------------- conversations
def create_conversation(client_uid: str, admin_uid: str | None, request_id: str) -> str:
    """Server-created only (§4) — the participant list backing every RTDB rule check is set here, once, by a trusted caller."""
    conversation_id = uuid.uuid4().hex
    participants = {client_uid: True}
    if admin_uid:
        participants[admin_uid] = True
    _ref(f"/conversations/{conversation_id}").set({
        "request_id": request_id,
        "client_uid": client_uid,
        "participants": participants,
        "created_at": int(time.time() * 1000),
        "latest_message_preview": None,
        "latest_message_at": None,
        "active": True,
    })
    return conversation_id


def get_conversation(conversation_id: str) -> dict | None:
    return _ref(f"/conversations/{conversation_id}").get()


def is_participant(conversation_id: str, uid: str) -> bool:
    convo = get_conversation(conversation_id)
    return bool(convo and convo.get("participants", {}).get(uid))


def list_conversations_for_uid(uid: str) -> list[dict]:
    """
    Admin SDK reads bypass rules, so this can do what a client-side query
    can't (RTDB has no "where participants contains me" query) — used by
    the admin panel and by /connect/mine's server-side lookups, never
    exposed as a raw client query.
    """
    all_convos = _ref("/conversations").get() or {}
    return [{"id": cid, **data} for cid, data in all_convos.items() if uid in (data.get("participants") or {})]


# ---------------------------------------------------------------- messages
def send_message(conversation_id: str, sender_uid: str, content: str) -> dict:
    message_id = uuid.uuid4().hex
    now_ms = int(time.time() * 1000)
    message = {"id": message_id, "conversation_id": conversation_id, "sender_uid": sender_uid, "content": content, "created_at": now_ms, "read_at": None}
    _ref(f"/messages/{conversation_id}/{message_id}").set(message)
    _ref(f"/conversations/{conversation_id}").update({"latest_message_preview": content[:120], "latest_message_at": now_ms})
    # Sending clears the sender's own draft (§7) — the draft path is client-written, but the backend clearing it
    # on successful send keeps "sent -> draft gone" guaranteed even if the client's own cleanup call never fires.
    _ref(f"/drafts/{conversation_id}/{sender_uid}").delete()
    return message


def list_messages(conversation_id: str) -> list[dict]:
    raw = _ref(f"/messages/{conversation_id}").get() or {}
    return sorted(raw.values(), key=lambda m: m["created_at"])


def mark_read(conversation_id: str, reader_uid: str) -> None:
    raw = _ref(f"/messages/{conversation_id}").get() or {}
    now_ms = int(time.time() * 1000)
    updates = {f"{mid}/read_at": now_ms for mid, m in raw.items() if m["sender_uid"] != reader_uid and m.get("read_at") is None}
    if updates:
        _ref(f"/messages/{conversation_id}").update(updates)


# ---------------------------------------------------------------- drafts / typing / presence (read-side helpers)
def get_draft(conversation_id: str, uid: str) -> str:
    """Drafts are primarily client-written (see module docstring); this read helper is for the admin side."""
    val = _ref(f"/drafts/{conversation_id}/{uid}").get()
    return (val or {}).get("content", "") if isinstance(val, dict) else ""


def set_draft(conversation_id: str, uid: str, content: str) -> None:
    """Fallback/admin write path — the browser normally writes drafts directly to RTDB (see module docstring)."""
    if content:
        _ref(f"/drafts/{conversation_id}/{uid}").set({"content": content, "updated_at": int(time.time() * 1000)})
    else:
        delete_draft(conversation_id, uid)


def delete_draft(conversation_id: str, uid: str) -> None:
    _ref(f"/drafts/{conversation_id}/{uid}").delete()


def get_typing(conversation_id: str) -> dict:
    return _ref(f"/typing/{conversation_id}").get() or {}


def get_presence(uid: str) -> dict:
    return _ref(f"/presence/{uid}").get() or {"online": False}


# ---------------------------------------------------------------- admin overview stats
def messaging_stats() -> dict:
    """
    Admin-only aggregate (Admin SDK read, bypasses rules) for the Overview
    dashboard. Fine to pull the whole /conversations and /messages trees at
    this project's scale; revisit if the conversation count ever gets large.
    """
    convos = _ref("/conversations").get() or {}
    messages = _ref("/messages").get() or {}
    unread = sum(1 for thread in messages.values() for m in (thread or {}).values() if m.get("read_at") is None)
    return {"active_conversations": len(convos), "unread_messages": unread}
