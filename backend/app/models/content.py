"""models/content.py — projects, repositories(view-only), achievements, uploads, blog posts."""
from datetime import date, datetime

from pydantic import BaseModel

from app.models.common import (
    AchievementCategory,
    BlogCategory,
    ContentStatus,
    ProjectCategory,
    ProjectDevStatus,
    UploadCategory,
)


class ProjectIn(BaseModel):
    name: str
    description: str
    category: ProjectCategory
    logo_url: str | None = None
    github_url: str | None = None
    website_url: str | None = None
    status: ContentStatus = ContentStatus.draft
    dev_status: ProjectDevStatus = ProjectDevStatus.planning
    show_progress_publicly: bool = False
    source_request_id: str | None = None
    deadline: date | None = None
    sort_order: int = 0
    published_at: datetime | None = None


class ProjectOut(ProjectIn):
    id: str
    slug: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class RepositoryOut(BaseModel):
    id: str
    source: str
    repo_name: str
    description: str | None = None
    github_url: str
    languages: list[dict] = []
    stars: int = 0
    forks: int = 0
    github_updated_at: datetime | None = None
    published_on: datetime
    is_visible: bool = True


class AchievementIn(BaseModel):
    title: str
    category: AchievementCategory
    place: str | None = None
    experience: str | None = None
    event_date: date | None = None
    image_url: str | None = None
    status: ContentStatus = ContentStatus.draft


class AchievementOut(AchievementIn):
    id: str
    created_at: datetime
    updated_at: datetime


class UploadIn(BaseModel):
    title: str
    category: UploadCategory
    description: str | None = None
    thumbnail_url: str | None = None
    external_link: str
    status: ContentStatus = ContentStatus.draft


class UploadOut(UploadIn):
    id: str
    uploaded_on: datetime
    created_at: datetime
    updated_at: datetime


class BlogPostIn(BaseModel):
    title: str
    slug: str
    category: BlogCategory
    excerpt: str | None = None
    content: str
    cover_image_url: str | None = None
    status: ContentStatus = ContentStatus.draft
    published_at: datetime | None = None


class BlogPostOut(BlogPostIn):
    id: str
    created_at: datetime
    updated_at: datetime
