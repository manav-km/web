"""api/v1/repositories.py"""
import logging
from fastapi import APIRouter, Depends, Request

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import repositories as db
from app.models.content import RepositoryOut
from app.services import audit, github_sync

logger = logging.getLogger("repositories")
router = APIRouter(prefix="/api/v1/repositories", tags=["repositories"])


@router.get("", response_model=list[RepositoryOut])
async def list_repositories():
    repos = db.list_visible()
    if len(repos) < 16:
        try:
            await github_sync.sync_all()
            repos = db.list_visible()
        except Exception as exc:
            logger.warning("GitHub auto-sync failed during list_repositories: %s", exc)
    return repos


@router.get("/admin", response_model=list[RepositoryOut])
def list_repositories_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.patch("/admin/{repo_id}/visibility", response_model=RepositoryOut)
async def set_visibility(repo_id: str, is_visible: bool, request: Request, user: CurrentUser = Depends(require_admin)):
    updated = db.set_visibility(repo_id, is_visible)
    await audit.log_event(
        category="content", action="repository_visibility_changed", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"repo_id": repo_id, "is_visible": is_visible},
    )
    return updated


@router.post("/admin/sync")
async def trigger_sync(request: Request, user: CurrentUser = Depends(require_admin)):
    """
    Manual sync trigger from the admin panel. The scheduled version of this
    same call happens via a scheduled cron job hitting an internal endpoint —
    see docs/architecture.md.
    """
    result = await github_sync.sync_all()
    await audit.log_event(
        category="content", action="github_sync_run", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata=result,
    )
    return result
