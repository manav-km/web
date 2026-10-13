"""
services/ai/providers/gemini.py — Google Gemini provider using Gemini's OpenAI-compatible API.
"""
import json

import httpx

from app.core.config import get_settings

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


class GeminiError(Exception):
    pass


async def complete_json(system_prompt: str, user_prompt: str) -> dict:
    """
    Calls Google Gemini using its OpenAI-compatible endpoint and returns parsed JSON.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(
                _GEMINI_URL,
                headers={
                    "Authorization": f"Bearer {settings.gemini_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.gemini_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
        except httpx.HTTPError as exc:
            raise GeminiError(f"network error calling Gemini: {exc}") from exc

    if resp.status_code != 200:
        raise GeminiError(f"Gemini returned {resp.status_code}: {resp.text[:300]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise GeminiError(f"could not parse Gemini response: {exc}") from exc
