"""models/common.py — enums mirroring the Postgres types in the migration."""
from enum import Enum


class ContentStatus(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class ProjectCategory(str, Enum):
    websites = "websites"
    pc_apps = "pc_apps"
    mobile_apps = "mobile_apps"
    robotics = "robotics"


class AchievementCategory(str, Enum):
    development = "development"
    hackathon = "hackathon"
    robotics = "robotics"
    gaming = "gaming"
    education = "education"


class UploadCategory(str, Enum):
    project_demo = "project_demo"
    tutorial = "tutorial"
    experiment = "experiment"
    showcase = "showcase"
    other = "other"


class BlogCategory(str, Enum):
    development = "development"
    ai = "ai"
    robotics = "robotics"
    projects = "projects"
    tutorials = "tutorials"
    other = "other"


class RequestCategory(str, Enum):
    website = "website"
    pc_app = "pc_app"
    mobile_app = "mobile_app"
    ai_automation = "ai_automation"
    robotics = "robotics"
    other = "other"


class RequestStatus(str, Enum):
    pending = "pending"
    in_discussion = "in_discussion"
    in_progress = "in_progress"
    completed = "completed"
    declined = "declined"


class Severity(str, Enum):
    low = "Low"
    alert = "Alert"
    critical = "Critical"


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"
    skipped = "skipped"


class TaskCategory(str, Enum):
    planning = "planning"
    design = "design"
    frontend = "frontend"
    backend = "backend"
    database = "database"
    authentication = "authentication"
    api = "api"
    ai = "ai"
    automation = "automation"
    integration = "integration"
    testing = "testing"
    security = "security"
    deployment = "deployment"
    documentation = "documentation"
    other = "other"


class TaskSource(str, Enum):
    ai = "ai"
    admin = "admin"


class TaskOwnerType(str, Enum):
    request = "request"
    project = "project"


class ProjectDevStatus(str, Enum):
    planning = "planning"
    in_progress = "in_progress"
    review = "review"
    completed = "completed"
    archived = "archived"
