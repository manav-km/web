"""services/ai/models.py — one schema per AI task. Never trust free-form text."""
from pydantic import BaseModel


class ClientRequestOverview(BaseModel):
    summary: str
    project_type: str
    key_requirements: list[str]
    deadline: str
    budget: str
    important_notes: str | None = None


class AuditLogNote(BaseModel):
    note: str


class RequestCategorization(BaseModel):
    suggested_category: str
    confidence: float
    reasoning: str


class ConversationSummary(BaseModel):
    summary: str
    open_questions: list[str] = []


class ChecklistTask(BaseModel):
    title: str
    description: str | None = None
    category: str  # validated against TaskCategory by the caller
    weight: float
    depends_on_titles: list[str] = []  # titles, not IDs — the AI doesn't know real task IDs; the caller resolves these


class GeneratedChecklist(BaseModel):
    tasks: list[ChecklistTask]
