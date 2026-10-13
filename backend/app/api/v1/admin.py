"""api/v1/admin.py — every route here depends on require_admin (verified server-side)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import audit as audit_db
from app.db import client_requests as requests_db
from app.db import notifications as notifications_db
from app.db import reviews as reviews_db
from app.db import tasks as tasks_db
from app.models.client import StatusChange
from app.services import audit, firebase_rtdb, realtime
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _count(table: str, **filters) -> int:
    q = get_supabase().table(table).select("id", count="exact")
    for k, v in filters.items():
        q = q.eq(k, v)
    return q.execute().count or 0


@router.get("/overview")
def overview(_: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    requests = sb.table("client_requests").select("status,firebase_uid,deadline,id").execute().data
    by_status = {s: 0 for s in ["pending", "in_discussion", "in_progress", "completed", "declined"]}
    for r in requests:
        by_status[r["status"]] += 1

    achievements = sb.table("achievements").select("category").execute().data
    ach_counts: dict[str, int] = {}
    for a in achievements:
        ach_counts[a["category"]] = ach_counts.get(a["category"], 0) + 1

    msg_stats = firebase_rtdb.messaging_stats()
    audit_recent = audit_db.list_filtered(limit=10)

    # ---- completion/checklist rollup (§33) ----
    projects_all = sb.table("projects").select("id,dev_status,deadline").execute().data
    in_progress_projects = [p for p in projects_all if p["dev_status"] == "in_progress"]
    in_progress_requests = [r for r in requests if r["status"] == "in_progress"]

    percents = []
    for p in in_progress_projects:
        percents.append(tasks_db.completion("project", p["id"])["completion_percent"])
    for r in in_progress_requests:
        percents.append(tasks_db.completion("request", r["id"])["completion_percent"])
    avg_completion = round(sum(percents) / len(percents), 1) if percents else 0.0

    blocked_tasks = sb.table("tasks").select("id", count="exact").eq("status", "blocked").execute().count or 0

    from datetime import date, timedelta
    soon = date.today() + timedelta(days=7)
    deadlines_soon = (
        sum(1 for p in projects_all if p.get("deadline") and str(p["deadline"]) <= str(soon) and p["dev_status"] not in ("completed", "archived"))
        + sum(1 for r in requests if r.get("deadline") and str(r["deadline"]) <= str(soon) and r["status"] not in ("completed", "declined"))
    )

    return {
        "people": {
            "registered_users": _count("profiles"),
            "clients_who_contacted": len({r["firebase_uid"] for r in requests}),
            "total_requests": len(requests),
        },
        "requests": by_status,
        "messaging": msg_stats,
        "projects": {
            "total": _count("projects"), "published": _count("projects", status="published"),
            "drafts": _count("projects", status="draft"), "archived": _count("projects", status="archived"),
            "in_progress": len(in_progress_projects),
        },
        "completion": {
            "projects_in_progress": len(in_progress_projects),
            "requests_in_progress": len(in_progress_requests),
            "average_completion_percent": avg_completion,
            "blocked_tasks": blocked_tasks,
            "deadlines_approaching_7d": deadlines_soon,
        },
        "achievements": {"total": len(achievements), "by_category": ach_counts},
        "uploads": {
            "total": _count("uploads"), "published": _count("uploads", status="published"),
            "drafts": _count("uploads", status="draft"),
        },
        "blog": {"published": _count("blog_posts", status="published"), "drafts": _count("blog_posts", status="draft")},
        "reviews": reviews_db.averages(),
        "recent_activity": audit_recent,
        "needs_attention": {
            "pending_requests": by_status["pending"],
            "unread_messages": msg_stats["unread_messages"],
            "draft_projects": _count("projects", status="draft"),
            "draft_achievements": _count("achievements", status="draft"),
            "draft_uploads": _count("uploads", status="draft"),
            "draft_blog_posts": _count("blog_posts", status="draft"),
            "critical_security_events": _count("security_events", severity="Critical"),
            "blocked_tasks": blocked_tasks,
            "deadlines_approaching_7d": deadlines_soon,
        },
    }


@router.get("/clients")
def clients_table(status_filter: str | None = Query(None, alias="status"), _: CurrentUser = Depends(require_admin)):
    return requests_db.list_all_admin(status_filter)


@router.get("/clients/{request_id}")
def client_detail(request_id: str, _: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    req = requests_db.get(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return {
        "request": req,
        "status_history": sb.table("request_status_history").select("*").eq("request_id", request_id).order("changed_at").execute().data,
        "review": reviews_db.get_for_request(request_id),
        "audit": sb.table("audit_logs").select("*").contains("metadata", {"request_id": request_id}).order("occurred_at", desc=True).execute().data,
        "completion": tasks_db.completion("request", request_id),
        "tasks": tasks_db.list_for_owner("request", request_id),
    }


class ConvertToProject(BaseModel):
    name: str
    category: str  # a ProjectCategory value — request/project category enums don't map 1:1, so the admin picks explicitly


@router.post("/clients/{request_id}/convert-to-project")
async def convert_to_project(request_id: str, payload: ConvertToProject, request: Request, user: CurrentUser = Depends(require_admin)):
    """§23 — links a request to the project it becomes, moving (not duplicating) its checklist over."""
    from app.db import projects as projects_db

    req = requests_db.get(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")

    project = projects_db.create({
        "name": payload.name, "description": req["project_description"], "category": payload.category,
        "status": "draft", "dev_status": "planning", "source_request_id": request_id, "deadline": req["deadline"],
    })
    tasks_db.reparent("request", request_id, "project", project["id"])
    await audit.log_event(
        category="content", action="request_converted_to_project", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"request_id": request_id, "project_id": project["id"]}, generate_ai_note=False,
    )
    return project


@router.put("/clients/{request_id}/status")
async def change_status(request_id: str, payload: StatusChange, request: Request, user: CurrentUser = Depends(require_admin)):
    req = requests_db.get(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")

    updated = requests_db.change_status(request_id, payload.new_status.value, user.uid, payload.note)
    await audit.log_event(
        category="client", action="request_status_changed", ip_address=get_client_ip(request),
        performer_uid=user.uid,
        metadata={"request_id": request_id, "from": req["status"], "to": payload.new_status.value},
    )
    notifications_db.create(req["firebase_uid"], "request_status", {"request_id": request_id, "status": payload.new_status.value})
    realtime.signal(req["firebase_uid"], "request_status", {"request_id": request_id})
    if payload.new_status.value == "completed":
        notifications_db.create(req["firebase_uid"], "review_available", {"request_id": request_id})
        realtime.signal(req["firebase_uid"], "review_available", {"request_id": request_id})
    return updated


@router.post("/clients/{request_id}/retry-ai")
async def retry_ai(request_id: str, _: CurrentUser = Depends(require_admin)):
    from app.services.ai import service as ai_service

    req = requests_db.get(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    overview = await ai_service.client_request_overview(
        req["category"], str(req["deadline"]), req["budget"], req["project_description"]
    )
    return requests_db.update_ai_overview(
        request_id, overview.model_dump() if overview else None, "completed" if overview else "failed"
    )


@router.post("/clients/{request_id}/retry-checklist")
async def retry_checklist(request_id: str, _: CurrentUser = Depends(require_admin)):
    from app.services import checklist as checklist_service

    req = requests_db.get(request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if tasks_db.list_for_owner("request", request_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A checklist already exists — use regenerate instead of retry")
    checklist_status = await checklist_service.generate_initial(
        "request", request_id, req["category"], req["project_description"], req["budget"], str(req["deadline"]),
    )
    requests_db.update_checklist_status(request_id, checklist_status)
    return {"checklist_status": checklist_status}


@router.get("/audit")
def audit_log(
    category: str | None = None, severity: str | None = None, performer_uid: str | None = None,
    ip_address: str | None = None, date_from: str | None = None, date_to: str | None = None,
    limit: int = Query(50, le=200), offset: int = 0, _: CurrentUser = Depends(require_admin),
):
    return audit_db.list_filtered(category, severity, performer_uid, ip_address, date_from, date_to, limit, offset)


class NoteEdit(BaseModel):
    note: str


@router.put("/audit/{event_id}/note")
async def edit_audit_note(event_id: str, payload: NoteEdit, request: Request, user: CurrentUser = Depends(require_admin)):
    new_event = await audit.edit_note(event_id, payload.note, user.uid)
    # The edit itself is an auditable event (§37); original row is preserved.
    await audit.log_event(
        category="admin", action="audit_note_edited", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"original_event_id": event_id, "new_event_id": new_event["id"]},
        generate_ai_note=False,
    )
    return new_event


@router.get("/reviews")
def reviews(_: CurrentUser = Depends(require_admin)):
    return {"averages": reviews_db.averages(), "items": reviews_db.list_all_admin()}


def _check_cron(request: Request) -> None:
    """Cron endpoints require `Authorization: Bearer $CRON_SECRET` on GET requests."""
    from app.core.config import get_settings

    secret = get_settings().cron_secret
    if not secret or request.headers.get("authorization") != f"Bearer {secret}":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")


@router.get("/cron/sync-github")
async def cron_sync(request: Request):
    from app.services import github_sync

    _check_cron(request)
    return await github_sync.sync_all()


@router.get("/cron/retry-ai")
async def cron_retry_ai(request: Request):
    """Retries AI overviews AND checklists that failed/are pending (§30, §71.5). Small batch per run."""
    from app.services import checklist as checklist_service
    from app.services.ai import service as ai_service

    _check_cron(request)
    sb = get_supabase()
    done = {"overview": 0, "checklist": 0}

    overview_rows = sb.table("client_requests").select("*").in_("ai_status", ["pending", "failed", "retrying"]).limit(10).execute().data
    for r in overview_rows:
        result = await ai_service.client_request_overview(r["category"], str(r["deadline"]), r["budget"], r["project_description"])
        requests_db.update_ai_overview(r["id"], result.model_dump() if result else None, "completed" if result else "failed")
        done["overview"] += bool(result)

    checklist_rows = sb.table("client_requests").select("*").in_("checklist_status", ["pending", "failed", "retrying"]).limit(10).execute().data
    for r in checklist_rows:
        if tasks_db.list_for_owner("request", r["id"]):
            continue  # already has tasks from a previous partial success — don't duplicate
        status_ = await checklist_service.generate_initial("request", r["id"], r["category"], r["project_description"], r["budget"], str(r["deadline"]))
        requests_db.update_checklist_status(r["id"], status_)
        done["checklist"] += status_ == "completed"

    return {"overview_attempted": len(overview_rows), "checklist_attempted": len(checklist_rows), **done}


@router.get("/cron/cleanup")
async def cron_cleanup(request: Request):
    """Deletes stale rate-limit rows so the table stays small (blocks expire on their own)."""
    from datetime import datetime, timedelta, timezone

    _check_cron(request)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    get_supabase().table("rate_limit_blocks").delete().lt("window_start", cutoff).execute()
    return {"ok": True}


@router.get("/cron/mask-ips")
async def cron_mask_ips(request: Request):
    """Masks IP addresses in audit_logs and security_events older than IP_RETENTION_DAYS (default 90)."""
    from datetime import datetime, timedelta, timezone
    from app.core.config import get_settings

    _check_cron(request)
    settings = get_settings()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=settings.ip_retention_days)).isoformat()
    sb = get_supabase()
    sb.table("audit_logs").update({"ip_address": "[masked]"}).lt("occurred_at", cutoff).neq("ip_address", "[masked]").execute()
    sb.table("security_events").update({"ip_address": "[masked]"}).lt("occurred_at", cutoff).neq("ip_address", "[masked]").execute()
    return {"ok": True, "cutoff": cutoff}


# ---------------------------------------------------------------- media uploads
import uuid

_MEDIA_BUCKETS = {"project-logos", "achievement-images", "upload-thumbnails", "blog-images", "profile-pictures"}
_MEDIA_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}  # no SVG (script-capable) or executables
_MEDIA_MAX_BYTES = 2_000_000


class MediaRequest(BaseModel):
    bucket: str
    content_type: str
    size: int


@router.post("/media/upload-url")
async def media_upload_url(payload: MediaRequest, request: Request, user: CurrentUser = Depends(require_admin)):
    """
    Validates the file's declared type/size, then returns a one-time signed upload URL.
    The browser uploads straight to Supabase Storage; the filename is generated here
    (uuid) so a client-supplied name can never influence the storage path.
    """
    if payload.bucket not in _MEDIA_BUCKETS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown bucket")
    ext = _MEDIA_TYPES.get(payload.content_type)
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only PNG, JPEG or WebP images are allowed")
    if not 0 < payload.size <= _MEDIA_MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be 2 MB or smaller")

    path = f"{uuid.uuid4().hex}.{ext}"
    sb = get_supabase()
    signed = sb.storage.from_(payload.bucket).create_signed_upload_url(path)
    public_url = sb.storage.from_(payload.bucket).get_public_url(path)
    sb.table("media_assets").insert({
        "bucket": payload.bucket, "storage_path": path, "content_type": payload.content_type,
        "size_bytes": payload.size, "uploaded_by": user.uid,
    }).execute()
    await audit.log_event(
        category="content", action="media_upload_authorized", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"bucket": payload.bucket, "path": path}, generate_ai_note=False,
    )
    return {"signed_url": signed["signed_url"], "path": path, "public_url": public_url}
