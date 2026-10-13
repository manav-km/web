"""
services/ai/prompts.py — every prompt the app sends to an LLM, in one place.

Each function returns (system_prompt, user_prompt). Keeping them here means
a prompt can be tuned/versioned without touching the calling code, and it's
obvious at a glance everywhere the app talks to a model.
"""

CLIENT_REQUEST_OVERVIEW_SYSTEM = """You summarize freelance/client project requests for a developer's admin \
dashboard. Respond ONLY with JSON matching this schema: \
{"summary": str, "project_type": str, "key_requirements": [str], \
"deadline": str, "budget": str, "important_notes": str|null}. \
No preamble, no markdown fences, no text outside the JSON object."""


def client_request_overview_prompt(
    category: str, deadline: str, budget: str, description: str
) -> tuple[str, str]:
    user = (
        f"Category: {category}\nDeadline requested: {deadline}\nBudget: {budget}\n\n"
        f"Client's own description:\n{description}"
    )
    return CLIENT_REQUEST_OVERVIEW_SYSTEM, user


AUDIT_LOG_NOTE_SYSTEM = """You write a single short (<=25 words), factual, human-readable note \
describing a site audit-log event, for an admin to skim. Respond ONLY with \
JSON: {"note": str}. Never invent details not present in the event."""


def audit_log_note_prompt(category: str, action: str, performer: str | None, metadata: dict) -> tuple[str, str]:
    user = f"category={category} action={action} performer={performer or 'system/anonymous'} metadata={metadata}"
    return AUDIT_LOG_NOTE_SYSTEM, user


REQUEST_CATEGORIZATION_SYSTEM = """You sanity-check which category a client's project request best fits, \
from: website, pc_app, mobile_app, ai_automation, robotics, other. Respond \
ONLY with JSON: {"suggested_category": str, "confidence": float 0-1, "reasoning": str}."""


def request_categorization_prompt(client_selected_category: str, description: str) -> tuple[str, str]:
    user = f"Client selected: {client_selected_category}\n\nDescription:\n{description}"
    return REQUEST_CATEGORIZATION_SYSTEM, user


CONVERSATION_SUMMARY_SYSTEM = """You summarize a client conversation thread for an admin dashboard. Respond \
ONLY with JSON: {"summary": str, "open_questions": [str]}."""


def conversation_summary_prompt(messages: list[str]) -> tuple[str, str]:
    user = "\n".join(messages)
    return CONVERSATION_SUMMARY_SYSTEM, user


CHECKLIST_GENERATION_SYSTEM = """You are a senior software engineer breaking a client project request into a \
specific, actionable implementation checklist for the developer who will build it. \
Generate tasks SPECIFIC to this actual request — never a generic template. \
Categories MUST be one of: planning, design, frontend, backend, database, \
authentication, api, ai, automation, integration, testing, security, \
deployment, documentation, other. Weight each task 1-10 by relative effort/ \
importance/complexity (not every task is equal — a database schema is \
usually heavier than a footer). Where a task genuinely can't start before \
another finishes, list the earlier task's exact title in depends_on_titles \
(use sparingly — only real blocking dependencies, not everything). Aim for \
15-30 tasks covering planning through deployment, appropriate to the \
project's actual scope and category. Respond ONLY with JSON matching: \
{"tasks": [{"title": str, "description": str|null, "category": str, \
"weight": number, "depends_on_titles": [str]}]}. No preamble, no markdown \
fences, no text outside the JSON object."""


def checklist_generation_prompt(category: str, description: str, budget: str, deadline: str) -> tuple[str, str]:
    user = f"Project category: {category}\nBudget: {budget}\nDeadline: {deadline}\n\nClient's request:\n{description}"
    return CHECKLIST_GENERATION_SYSTEM, user


CHECKLIST_REGENERATION_SYSTEM = """You are reviewing an existing project checklist against a client's UPDATED \
request to identify what's changed. You will be given the current task \
titles and the new/updated request description. Generate ONLY the tasks \
that are newly required given the update — do not repeat tasks that would \
already be covered by the existing list unless the update clearly changes \
their scope. Same category/weight/dependency rules as before. Respond ONLY \
with JSON: {"tasks": [{"title": str, "description": str|null, "category": \
str, "weight": number, "depends_on_titles": [str]}]}."""


def checklist_regeneration_prompt(existing_titles: list[str], category: str, description: str) -> tuple[str, str]:
    user = "Existing tasks:\n" + "\n".join(f"- {t}" for t in existing_titles) + f"\n\nUpdated request (category: {category}):\n{description}"
    return CHECKLIST_REGENERATION_SYSTEM, user
