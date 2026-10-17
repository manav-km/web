"""api/v1/repositories.py"""
import asyncio
import logging
import time

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import repositories as db
from app.models.content import RepositoryOut
from app.services import audit, github_sync

logger = logging.getLogger("repositories")
router = APIRouter(prefix="/api/v1/repositories", tags=["repositories"])

_EXPECTED_REPO_COUNT = 16
_MIN_BG_SYNC_INTERVAL = 1800.0  # 30 minutes debouncing
_bg_sync_lock = asyncio.Lock()
_last_bg_sync = 0.0


@router.get("", response_model=list[RepositoryOut])
async def list_repositories(background_tasks: BackgroundTasks):
    repos = db.list_visible()
    now = time.time()
    # Trigger background sync if DB is completely empty, or if below expected count and debounce interval passed
    should_sync = (len(repos) == 0) or (len(repos) < _EXPECTED_REPO_COUNT and (now - _last_bg_sync > _MIN_BG_SYNC_INTERVAL))
    if should_sync and not _bg_sync_lock.locked():
        background_tasks.add_task(_run_sync_quietly)
    return repos


async def _run_sync_quietly() -> None:
    """Run a full GitHub sync debounced and concurrency-locked; never raises."""
    global _last_bg_sync
    if _bg_sync_lock.locked():
        return
    async with _bg_sync_lock:
        _last_bg_sync = time.time()
        try:
            result = await github_sync.sync_all()
            logger.info("Background sync complete: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.error("Background sync failed: %s", exc)


@router.get("/admin", response_model=list[RepositoryOut])
def list_repositories_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.patch("/admin/{repo_id}/visibility", response_model=RepositoryOut)
async def set_visibility(
    repo_id: str, is_visible: bool, request: Request,
    user: CurrentUser = Depends(require_admin),
):
    updated = db.set_visibility(repo_id, is_visible)
    await audit.log_event(
        category="content", action="repository_visibility_changed",
        ip_address=get_client_ip(request),
        performer_uid=user.uid,
        metadata={"repo_id": repo_id, "is_visible": is_visible},
    )
    return updated


@router.post("/admin/sync")
async def trigger_sync(request: Request, user: CurrentUser = Depends(require_admin)):
    """
    Manual sync trigger from the admin panel. The scheduled version hits
    /admin/cron/sync-github — see docs/architecture.md.
    """
    result = await github_sync.sync_all()
    await audit.log_event(
        category="content", action="github_sync_run",
        ip_address=get_client_ip(request),
        performer_uid=user.uid,
        metadata=result,
    )
    return result
