"""
core/firebase.py — one-time Firebase Admin SDK init.

Runs once per container startup, not once per request — firebase_admin
guards against double-initialization itself, but we guard too for clarity
when running locally with a reloader.
"""
import json

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import get_settings

_initialized = False


def init_firebase() -> None:
    global _initialized
    if _initialized or firebase_admin._apps:
        _initialized = True
        return

    settings = get_settings()
    raw = settings.firebase_service_account_json

    # Accept either a file path or the raw JSON contents in the env var —
    # both are common depending on how the host injects the secret.
    if raw.strip().startswith("{"):
        cred = credentials.Certificate(json.loads(raw))
    else:
        cred = credentials.Certificate(raw)

    firebase_admin.initialize_app(cred, _app_options(settings))
    _initialized = True


def _app_options(settings) -> dict:
    options = {"projectId": settings.firebase_project_id}
    if settings.firebase_database_url:
        options["databaseURL"] = settings.firebase_database_url
    return options


def verify_id_token(token: str) -> dict:
    """Raises firebase_admin.auth.InvalidIdTokenError / ExpiredIdTokenError on failure."""
    init_firebase()
    return firebase_auth.verify_id_token(token, check_revoked=True)
