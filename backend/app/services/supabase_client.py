"""
services/supabase_client.py — one client, service-role key.

This key is powerful (bypasses RLS) precisely so the backend can be the
single point of authorization. Never import this key or client into
anything that could end up shipped to the browser.
"""
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


import logging

logger = logging.getLogger("app.supabase")

@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    url = settings.supabase_url.strip()
    key = settings.supabase_service_role_key.strip()
    logger.info("Initializing Supabase client: url=%s, key_len=%d, key_prefix=%s", url, len(key), key[:10] if key else "EMPTY")
    client = create_client(url, key)
    # Ensure underlying postgrest client explicitly authenticates requests with the key
    try:
        client.postgrest.auth(key)
    except Exception as e:
        logger.warning("Could not set postgrest auth: %s", e)
    return client
