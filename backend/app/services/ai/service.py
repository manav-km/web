"""
services/ai/service.py — the ONLY module the rest of the app imports for AI.

Every function here is failure-safe: on any AI error, it returns None
rather than raising, so a failed AI call never blocks the request that
triggered it (§71.5). Callers store None as "pending"/"failed" and move on.
"""
import logging

from pydantic import ValidationError

from app.core.config import get_settings
from app.services.ai import prompts
from app.services.ai.models import (
    AuditLogNote,
    ClientRequestOverview,
    ConversationSummary,
    GeneratedChecklist,
    RequestCategorization,
)
from app.services.ai.providers import gemini, openrouter

logger = logging.getLogger("ai_service")


async def client_request_overview(category: str, deadline: str, budget: str, description: str) -> ClientRequestOverview | None:
    system, user = prompts.client_request_overview_prompt(category, deadline, budget, description)
    return await _run(system, user, ClientRequestOverview)


async def audit_log_note(category: str, action: str, performer: str | None, metadata: dict) -> str | None:
    system, user = prompts.audit_log_note_prompt(category, action, performer, metadata)
    result = await _run(system, user, AuditLogNote)
    return result.note if result else None


async def request_categorization(client_selected_category: str, description: str) -> RequestCategorization | None:
    system, user = prompts.request_categorization_prompt(client_selected_category, description)
    return await _run(system, user, RequestCategorization)


async def conversation_summary(messages: list[str]) -> ConversationSummary | None:
    system, user = prompts.conversation_summary_prompt(messages)
    return await _run(system, user, ConversationSummary)


async def generate_checklist(category: str, description: str, budget: str, deadline: str) -> GeneratedChecklist | None:
    system, user = prompts.checklist_generation_prompt(category, description, budget, deadline)
    return await _run(system, user, GeneratedChecklist)


async def regenerate_checklist(existing_titles: list[str], category: str, description: str) -> GeneratedChecklist | None:
    system, user = prompts.checklist_regeneration_prompt(existing_titles, category, description)
    return await _run(system, user, GeneratedChecklist)


async def _run(system: str, user: str, schema):
    settings = get_settings()
    try:
        if settings.gemini_api_key:
            raw = await gemini.complete_json(system, user)
        elif settings.openrouter_api_key:
            raw = await openrouter.complete_json(system, user)
        else:
            logger.warning("No AI API key configured (neither GEMINI_API_KEY nor OPENROUTER_API_KEY)")
            return None
        return schema.model_validate(raw)
    except (gemini.GeminiError, openrouter.OpenRouterError, ValidationError) as exc:
        logger.warning("AI task failed, leaving field pending: %s", exc)
        return None
