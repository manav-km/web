"""
services/realtime.py — Firebase Realtime Database, used ONLY as a lightweight
"something changed" signal so an already-open browser tab refetches instantly
instead of waiting for its next poll.

Why not put chat itself in RTDB (as the Dnmx sites do): this app's messages,
drafts, and notifications are already authoritative in Supabase — the admin
Overview, the per-client conversation view, the audit log, and the AI
conversation-summary task all read from Postgres. Moving message *content*
into RTDB would split that data across two databases and bypass the
ownership/rate-limit/audit checks every message currently goes through in
FastAPI. So: Supabase stays the single source of truth (§43); RTDB just
carries a millisecond-fast ping at /signals/{uid}. See docs/security.md and
docs/firebase.md for the reasoning and the security rules.

Failure-safe by design, same pattern as services/ai/service.py: if RTDB
isn't enabled/configured yet, or a write fails, the caller (message send,
notification create) must still succeed — the browser just falls back to
its normal poll interval.
"""
import logging
import time

from firebase_admin import db as rtdb

from app.core.config import get_settings
from app.core.firebase import init_firebase

logger = logging.getLogger("realtime")


def signal(uid: str | None, kind: str, payload: dict | None = None) -> None:
    """Writes a tiny, short-lived value to /signals/{uid}. Never raises."""
    if not uid:
        return
    try:
        init_firebase()
        if not get_settings().firebase_database_url:
            return  # Realtime Database not enabled/configured yet — silent no-op, caller unaffected
        rtdb.reference(f"/signals/{uid}").set({"kind": kind, "at": int(time.time() * 1000), **(payload or {})})
    except Exception:  # noqa: BLE001 — a signal failure must never fail the request that triggered it
        logger.warning("Realtime signal failed (uid=%s, kind=%s) — client falls back to polling", uid, kind)
