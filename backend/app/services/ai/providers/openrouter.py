"""
services/ai/providers/openrouter.py — the ONLY file in the app that knows
OpenRouter's HTTP shape. Everything else calls services/ai/service.py.
"""
import json

import httpx

from app.core.config import get_settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(Exception):
    pass


async def complete_json(system_prompt: str, user_prompt: str) -> dict:
    """
    Calls OpenRouter with the configured model and returns parsed JSON.
    Raises OpenRouterError on any failure (network, non-200, unparsable
    response) — callers (services/ai/service.py) decide what to do about
    it; this function never silently returns a fabricated fallback.
    """
    settings = get_settings()

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(
                _OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
        except httpx.HTTPError as exc:
            raise OpenRouterError(f"network error calling OpenRouter: {exc}") from exc

    if resp.status_code != 200:
        raise OpenRouterError(f"OpenRouter returned {resp.status_code}: {resp.text[:300]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise OpenRouterError(f"could not parse OpenRouter response: {exc}") from exc
