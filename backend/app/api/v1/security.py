"""api/v1/security.py — Security View data (§38). Distinct from the full Audit Log."""
from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, require_admin
from app.db import security as db

router = APIRouter(prefix="/api/v1/security", tags=["security"])


@router.get("/events")
def security_events(
    severity: str | None = None, action: str | None = None, ip_address: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    limit: int = Query(50, le=200), offset: int = 0, _: CurrentUser = Depends(require_admin),
):
    return db.list_filtered(severity, action, ip_address, date_from, date_to, limit, offset)
