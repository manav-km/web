"""models/tasks.py — the checklist behind completion % for requests and projects (§17-32)."""
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import TaskCategory, TaskOwnerType, TaskSource, TaskStatus


class TaskIn(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    category: TaskCategory = TaskCategory.other
    weight: float = Field(gt=0, default=5)
    status: TaskStatus = TaskStatus.todo
    sort_order: int = 0
    blocked_reason: str | None = None
    depends_on: list[str] = []


class TaskOut(TaskIn):
    id: str
    owner_type: TaskOwnerType
    owner_id: str
    source: TaskSource
    is_manual_override: bool
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class CompletionOut(BaseModel):
    """What both the admin detail view and the client-safe progress view are built from."""
    completion_percent: float
    total_weight: float
    completed_weight: float
    task_count: int
    completed_count: int
    blocked_count: int


class ChecklistDiffItem(BaseModel):
    title: str
    category: TaskCategory
    weight: float
    description: str | None = None
    depends_on_titles: list[str] = []


class ChecklistPreview(BaseModel):
    """
    Result of a regenerate PREVIEW — nothing is written to the database yet.
    §29: completed and manually-edited tasks are never silently touched, so
    they're reported as `to_keep`, not `to_add`/`to_obsolete`.
    """
    to_add: list[ChecklistDiffItem]
    to_obsolete: list[TaskOut]   # AI-sourced, not completed, not manually edited, no longer suggested — flagged SKIPPED, never deleted
    to_keep: list[TaskOut]       # completed and/or manually-overridden tasks — untouched regardless of what the AI suggests this time
    summary: str


class ChecklistApply(BaseModel):
    """What the admin actually confirmed, after reviewing a ChecklistPreview."""
    add: list[ChecklistDiffItem]
    obsolete_task_ids: list[str] = []
